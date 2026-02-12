/**
 * @fileoverview Server-side functions for the consignments module database.
 */
"use server";

import { connectDb, getCompanySettings } from '@/modules/core/lib/db';
import { getAllUsers as getAllUsersFromMain } from '@/modules/core/lib/auth';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory, User, Product } from '@/modules/core/types';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';
import { sendEmail } from '@/modules/core/lib/email-service';
import { getPlannerSettings } from '@/modules/planner/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CONSIGNMENTS_DB_FILE = 'consignments.db';

export async function initializeConsignmentsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS consignment_agreements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT UNIQUE NOT NULL,
            client_name TEXT NOT NULL,
            erp_warehouse_id TEXT,
            next_boleta_number INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS consignment_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE,
            UNIQUE(agreement_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS counting_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS counting_session_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            counted_quantity REAL NOT NULL,
            FOREIGN KEY (session_id) REFERENCES counting_sessions(id) ON DELETE CASCADE,
            UNIQUE(session_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS restock_boletas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            agreement_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT,
            approved_by TEXT,
            approved_at TEXT,
            erp_invoice_number TEXT,
            notes TEXT,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS boleta_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boleta_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            product_description TEXT NOT NULL,
            counted_quantity REAL NOT NULL,
            replenish_quantity REAL NOT NULL,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (boleta_id) REFERENCES restock_boletas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS boleta_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boleta_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (boleta_id) REFERENCES restock_boletas(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);
    console.log(`Database ${CONSIGNMENTS_DB_FILE} initialized for Consignments module.`);
}

export async function runConsignmentsMigrations(db: import('better-sqlite3').Database) {
    const tableInfo = db.prepare(`PRAGMA table_info(restock_boletas)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));
    if (!columns.has('notes')) {
        db.exec('ALTER TABLE restock_boletas ADD COLUMN notes TEXT');
    }
}

export async function getAgreements(): Promise<(ConsignmentAgreement & { product_count?: number})[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreements = db.prepare(`
        SELECT ca.*, COUNT(cp.id) as product_count
        FROM consignment_agreements ca
        LEFT JOIN consignment_products cp ON ca.id = cp.agreement_id
        GROUP BY ca.id
        ORDER BY ca.client_name
    `).all() as (ConsignmentAgreement & { product_count?: number })[];
    return JSON.parse(JSON.stringify(agreements));
}

export async function saveAgreement(agreement: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id?: number }, products: Omit<ConsignmentProduct, 'id' | 'agreement_id'>[]): Promise<ConsignmentAgreement> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const transaction = db.transaction(() => {
        let agreementId = agreement.id;
        if (agreementId) { // Update
            db.prepare('UPDATE consignment_agreements SET client_id = ?, client_name = ?, erp_warehouse_id = ?, notes = ?, is_active = ? WHERE id = ?')
              .run(agreement.client_id, agreement.client_name, agreement.erp_warehouse_id, agreement.notes, agreement.is_active, agreementId);
        } else { // Create
            const info = db.prepare('INSERT INTO consignment_agreements (client_id, client_name, erp_warehouse_id, notes, is_active) VALUES (?, ?, ?, ?, ?)')
              .run(agreement.client_id, agreement.client_name, agreement.erp_warehouse_id, agreement.notes, agreement.is_active);
            agreementId = info.lastInsertRowid as number;
        }

        // Only modify products if a new list is provided for a new or existing agreement
        if (products && products.length >= 0) {
            db.prepare('DELETE FROM consignment_products WHERE agreement_id = ?').run(agreementId);
            const insertProduct = db.prepare('INSERT INTO consignment_products (agreement_id, product_id, max_stock, price) VALUES (?, ?, ?, ?)');
            for (const product of products) {
                insertProduct.run(agreementId, product.product_id, product.max_stock, product.price);
            }
        }
        return db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(agreementId) as ConsignmentAgreement;
    });
    return transaction();
}

export async function deleteAgreement(agreementId: number): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);

    const transaction = db.transaction(() => {
        // Check for dependencies first.
        const boletaCount = db.prepare('SELECT COUNT(*) as count FROM restock_boletas WHERE agreement_id = ?').get(agreementId) as { count: number };
        if (boletaCount.count > 0) {
            throw new Error(`No se puede eliminar el acuerdo porque tiene ${boletaCount.count} boleta(s) asociadas. Por favor, elimina las boletas primero.`);
        }

        // The ON DELETE CASCADE constraint on consignment_products will handle product deletion.
        const result = db.prepare('DELETE FROM consignment_agreements WHERE id = ?').run(agreementId);

        if (result.changes === 0) {
            throw new Error('No se encontró el acuerdo a eliminar.');
        }
    });

    try {
        transaction();
        logInfo(`Consignment agreement with ID ${agreementId} was deleted.`);
    } catch (error: any) {
        logError('Failed to delete consignment agreement', { error: error.message, agreementId });
        throw error;
    }
}

export async function getAgreementDetails(agreementId: number): Promise<{ agreement: ConsignmentAgreement, products: ConsignmentProduct[] } | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(agreementId) as ConsignmentAgreement | undefined;
    if (!agreement) return null;
    const products = db.prepare('SELECT * FROM consignment_products WHERE agreement_id = ?').all(agreementId) as ConsignmentProduct[];
    return JSON.parse(JSON.stringify({ agreement, products }));
}

export async function getActiveCountingSessionForUser(userId: number): Promise<(CountingSession & { lines: CountingSessionLine[] }) | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    // Find any in-progress session for this user
    const session = db.prepare(`SELECT * FROM counting_sessions WHERE user_id = ? AND status = 'in-progress'`).get(userId) as CountingSession | undefined;
    if (!session) return null;
    const lines = db.prepare('SELECT * FROM counting_session_lines WHERE session_id = ?').all(session.id) as CountingSessionLine[];
    return { ...session, lines };
}

export async function startOrContinueCountingSession(agreementId: number, userId: number): Promise<CountingSession & { lines: CountingSessionLine[] }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    
    // First, check if another user has locked this agreement.
    const otherUserSession = db.prepare(`
        SELECT * FROM counting_sessions 
        WHERE agreement_id = ? AND status = 'in-progress' AND user_id != ?
    `).get(agreementId, userId) as CountingSession | undefined;
    
    if (otherUserSession) {
        const allUsers = await getAllUsersFromMain();
        const otherUserName = allUsers.find((u: User) => u.id === otherUserSession.user_id)?.name || 'otro usuario';
        throw new Error(`El acuerdo ya está siendo inventariado por ${otherUserName}.`);
    }

    // Now, check if the current user has a session for this agreement.
    let session = db.prepare(`SELECT * FROM counting_sessions WHERE agreement_id = ? AND user_id = ? AND status = 'in-progress'`).get(agreementId, userId) as CountingSession | undefined;
    
    if (session) {
        // Session already exists for this user and agreement, return it.
        const lines = db.prepare('SELECT * FROM counting_session_lines WHERE session_id = ?').all(session.id) as CountingSessionLine[];
        return { ...session, lines };
    }

    // No session exists, create a new one.
    const info = db.prepare(`INSERT INTO counting_sessions (agreement_id, user_id, status, created_at) VALUES (?, ?, 'in-progress', datetime('now'))`).run(agreementId, userId);
    const newSession = db.prepare('SELECT * FROM counting_sessions WHERE id = ?').get(info.lastInsertRowid) as CountingSession;
    return { ...newSession, lines: [] };
}


export async function saveCountLine(sessionId: number, productId: string, quantity: number): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    db.prepare('INSERT OR REPLACE INTO counting_session_lines (session_id, product_id, counted_quantity) VALUES (?, ?, ?)')
      .run(sessionId, productId, quantity);
}

export async function abandonCountingSession(sessionId: number, userId: number): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    db.transaction(() => {
        db.prepare('DELETE FROM counting_session_lines WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM counting_sessions WHERE id = ? AND user_id = ?').run(sessionId, userId);
    })();
}

export async function generateBoletaFromSession(sessionId: number, userId: number, userName: string): Promise<RestockBoleta> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const mainDb = await connectDb();

    const transaction = db.transaction(() => {
        const session = db.prepare('SELECT * FROM counting_sessions WHERE id = ?').get(sessionId) as CountingSession;
        if (!session) throw new Error("Session not found");
        
        const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(session.agreement_id) as ConsignmentAgreement;
        if (!agreement) throw new Error("Agreement not found");

        const sessionLines = db.prepare('SELECT * FROM counting_session_lines WHERE session_id = ?').all(sessionId) as CountingSessionLine[];
        const productIds = sessionLines.map(sl => sl.product_id);
        const placeholders = productIds.map(() => '?').join(',');

        const agreementProducts = productIds.length > 0 ? db.prepare(`SELECT * FROM consignment_products WHERE agreement_id = ? AND product_id IN (${placeholders})`).all(agreement.id, ...productIds) as ConsignmentProduct[] : [];
        const mainDbProducts = productIds.length > 0 ? mainDb.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...productIds) as Product[] : [];

        const consecutive = `${agreement.client_id}-${String(agreement.next_boleta_number).padStart(4, '0')}`;
        const boletaInfo = db.prepare(`INSERT INTO restock_boletas (consecutive, agreement_id, status, created_by, created_at) VALUES (?, ?, 'pending', ?, datetime('now'))`)
            .run(consecutive, agreement.id, userName);
        const boletaId = boletaInfo.lastInsertRowid as number;

        const insertLine = db.prepare('INSERT INTO boleta_lines (boleta_id, product_id, product_description, counted_quantity, replenish_quantity, max_stock, price) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        for (const line of sessionLines) {
            const agreementProduct = agreementProducts.find(p => p.product_id === line.product_id);
            if (!agreementProduct) continue;
            
            const replenishQty = Math.max(0, agreementProduct.max_stock - line.counted_quantity);
            const productDescription = mainDbProducts.find(p => p.id === line.product_id)?.description || 'Desconocido';
            
            insertLine.run(boletaId, line.product_id, productDescription, line.counted_quantity, replenishQty, agreementProduct.max_stock, agreementProduct.price);
        }

        db.prepare(`UPDATE consignment_agreements SET next_boleta_number = ? WHERE id = ?`).run(agreement.next_boleta_number + 1, agreement.id);
        
        db.prepare('DELETE FROM counting_session_lines WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM counting_sessions WHERE id = ?').run(sessionId);

        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta;
    });

    const newBoleta = transaction();

    // Send email notification outside the transaction
    try {
        const agreement = db.prepare('SELECT client_name FROM consignment_agreements WHERE id = ?').get(newBoleta.agreement_id) as { client_name: string };
        const subject = `Nueva Boleta de Consignación Pendiente: ${newBoleta.consecutive}`;
        const body = `<p>Se ha generado una nueva boleta de reposición (${newBoleta.consecutive}) para el cliente <strong>${agreement.client_name}</strong>.</p><p>La boleta fue creada por ${userName} y está pendiente de aprobación.</p>`;
        
        // This is a placeholder for getting supervisor emails. In a real app, this would be more robust.
        // For now, it sends to the user who created it as a confirmation.
        const user = await getAllUsersFromMain().then((users: User[]) => users.find((u: User) => u.id === userId));
        if (user?.email) {
            sendEmail({ to: user.email, subject, html: body });
        }
    } catch (e: any) {
        logError('Failed to send new boleta notification email', { boletaId: newBoleta.id, error: e.message });
    }


    return newBoleta;
}

export async function getBoletas(filters: { status: string[], dateRange?: { from?: Date, to?: Date } }): Promise<RestockBoleta[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    let query = 'SELECT * FROM restock_boletas';
    const params: any[] = [];
    const whereClauses: string[] = [];
    
    if (filters.status && filters.status.length > 0) {
        whereClauses.push(`status IN (${filters.status.map(() => '?').join(',')})`);
        params.push(...filters.status);
    }
    // Add date range filter if needed
    //...

    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    query += ' ORDER BY created_at DESC';

    const boletas = db.prepare(query).all(...params) as RestockBoleta[];
    return JSON.parse(JSON.stringify(boletas));
}

export async function updateBoletaStatus(payload: { boletaId: number, status: string, notes: string, updatedBy: string, erpInvoiceNumber?: string }): Promise<RestockBoleta> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const { boletaId, status, notes, updatedBy, erpInvoiceNumber } = payload;
    
    const transaction = db.transaction(() => {
        let updateQuery = 'UPDATE restock_boletas SET status = ?';
        const queryParams: any[] = [status];

        if (status === 'approved') {
            updateQuery += ', approved_by = ?, approved_at = datetime(\'now\')';
            queryParams.push(updatedBy);
        }
        if (status === 'invoiced' && erpInvoiceNumber) {
            updateQuery += ', erp_invoice_number = ?';
            queryParams.push(erpInvoiceNumber);
        }
        
        updateQuery += ' WHERE id = ?';
        queryParams.push(boletaId);

        db.prepare(updateQuery).run(...queryParams);
        
        db.prepare('INSERT INTO boleta_history (boleta_id, timestamp, status, updatedBy, notes) VALUES (?, datetime(\'now\'), ?, ?, ?)')
          .run(boletaId, status, updatedBy, notes);
        
        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta;
    });

    const updatedBoleta = transaction();
    // Send email notification outside transaction
    try {
        const creator = await getAllUsersFromMain().then((users: User[]) => users.find((u: User) => u.name === updatedBoleta.created_by));
        if (creator?.email && status === 'approved') {
            const subject = `Boleta de Consignación Aprobada: ${updatedBoleta.consecutive}`;
            const body = `<p>La boleta de reposición <strong>${updatedBoleta.consecutive}</strong> que creaste ha sido aprobada por <strong>${updatedBy}</strong>.</p><p>Ya puedes proceder con la impresión y el despacho.</p>`;
            sendEmail({ to: creator.email, subject, html: body });
        }
    } catch (e: any) {
        logError('Failed to send boleta status update email', { boletaId, error: e.message });
    }


    return updatedBoleta;
}

export async function getBoletaDetails(boletaId: number): Promise<{ boleta: RestockBoleta, lines: BoletaLine[], history: BoletaHistory[] } | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const boleta = db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta | undefined;
    if (!boleta) return null;

    const lines = db.prepare('SELECT * FROM boleta_lines WHERE boleta_id = ?').all(boletaId) as BoletaLine[];
    const history = db.prepare('SELECT * FROM boleta_history WHERE boleta_id = ? ORDER BY timestamp DESC').all(boletaId) as BoletaHistory[];

    return JSON.parse(JSON.stringify({ boleta, lines, history }));
}

export async function updateBoleta(boleta: RestockBoleta, lines: BoletaLine[], updatedBy: string): Promise<RestockBoleta> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    
    const transaction = db.transaction(() => {
        // Only update certain fields on the main boleta table
        db.prepare('UPDATE restock_boletas SET notes = ? WHERE id = ?').run(boleta.notes, boleta.id);
        
        const updateLineStmt = db.prepare('UPDATE boleta_lines SET replenish_quantity = ? WHERE id = ?');
        for (const line of lines) {
            updateLineStmt.run(line.replenish_quantity, line.id);
        }
        
        db.prepare('INSERT INTO boleta_history (boleta_id, timestamp, status, updatedBy, notes) VALUES (?, datetime(\'now\'), ?, ?, ?)')
          .run(boleta.id, boleta.status, updatedBy, 'Líneas de boleta editadas.');

        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boleta.id) as RestockBoleta;
    });
    
    return transaction();
}

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }): Promise<{ boletas: (RestockBoleta & { lines: BoletaLine[] })[] }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const boletas = db.prepare(`
            SELECT * FROM restock_boletas 
            WHERE agreement_id = ? AND created_at BETWEEN ? AND ?
        `).all(agreementId, dateRange.from.toISOString(), dateRange.to.toISOString()) as RestockBoleta[];
    
    if (boletas.length === 0) return { boletas: [] };

    const boletaIds = boletas.map(b => b.id);
    const placeholders = boletaIds.map(() => '?').join(',');

    const allLines = db.prepare(`SELECT * FROM boleta_lines WHERE boleta_id IN (${placeholders})`).all(...boletaIds) as BoletaLine[];

    const boletasWithLines = boletas.map(b => ({
        ...b,
        lines: allLines.filter(l => l.boleta_id === b.id)
    }));

    return { boletas: JSON.parse(JSON.stringify(boletasWithLines)) };
}

export async function getActiveConsignmentSessions(): Promise<(CountingSession & { agreement_name: string; user_name: string; })[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const mainDb = await connectDb();

    const sessions = db.prepare(`
        SELECT cs.id, cs.agreement_id, cs.user_id, cs.created_at, ca.client_name
        FROM counting_sessions cs
        JOIN consignment_agreements ca ON cs.agreement_id = ca.id
        WHERE cs.status = 'in-progress'
    `).all() as (CountingSession & { client_name: string })[];

    if (sessions.length === 0) return [];
    
    const userIds = sessions.map(s => s.user_id);
    const users = mainDb.prepare(`SELECT id, name FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds) as { id: number; name: string }[];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const results = sessions.map(s => ({
        ...s,
        agreement_name: s.client_name,
        user_name: userMap.get(s.user_id) || 'Usuario Desconocido'
    }));
    
    return JSON.parse(JSON.stringify(results));
}

export async function forceReleaseConsignmentSession(sessionId: number, updatedBy: string): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const session = db.prepare('SELECT * FROM counting_sessions WHERE id = ?').get(sessionId) as CountingSession | undefined;

    if (!session) {
        throw new Error('No se encontró la sesión a liberar.');
    }
    
    db.transaction(() => {
        db.prepare('DELETE FROM counting_session_lines WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM counting_sessions WHERE id = ?').run(sessionId);
    })();
    
    logWarn(`Consignment session ${sessionId} was forcibly released by ${updatedBy}.`);
}
