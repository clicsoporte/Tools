
/**
 * @fileoverview Server-side functions for the consignments module database.
 */
"use server";

import { connectDb, getCompanySettings, getAllProducts as getAllProductsFromMainDb, getAllRoles as getAllRolesFromDb } from '@/modules/core/lib/db';
import { getAllUsers as getAllUsersFromMain } from '@/modules/core/lib/auth';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory, User, Product, RestockBoletaStatus, ConsignmentSettings } from '@/modules/core/types';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';
import { format, parseISO } from 'date-fns';
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
            submitted_by TEXT,
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
         CREATE TABLE IF NOT EXISTS consignments_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);

    const defaultPdfColumns = ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'];
    db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfTopLegend', 'Documento de Reposición')`).run();
    db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfExportColumns', ?)`).run(JSON.stringify(defaultPdfColumns));

    console.log(`Database ${CONSIGNMENTS_DB_FILE} initialized for Consignments module.`);
}

export async function runConsignmentsMigrations(db: import('better-sqlite3').Database) {
    const boletasTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='restock_boletas'`).get();
    if (!boletasTable) {
        // Table doesn't exist, likely a fresh install handled by initialize.
        return;
    }
    const tableInfo = db.prepare(`PRAGMA table_info(restock_boletas)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));
    if (!columns.has('notes')) {
        db.exec('ALTER TABLE restock_boletas ADD COLUMN notes TEXT');
    }
    if (!columns.has('submitted_by')) {
        db.exec('ALTER TABLE restock_boletas ADD COLUMN submitted_by TEXT');
    }

    const settingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='consignments_settings'`).get();
    if (!settingsTable) {
        db.exec(`CREATE TABLE consignments_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
        const defaultPdfColumns = ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'];
        db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfTopLegend', 'Documento de Reposición')`).run();
        db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfExportColumns', ?)`).run(JSON.stringify(defaultPdfColumns));
        db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('notificationUserIds', '[]')`).run();
        db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('additionalNotificationEmails', '')`).run();
    } else {
        const notificationUserIdsRow = db.prepare(`SELECT value FROM consignments_settings WHERE key = 'notificationUserIds'`).get() as { value: string } | undefined;
        if (!notificationUserIdsRow) {
            db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('notificationUserIds', '[]')`).run();
        }
        const additionalEmailsRow = db.prepare(`SELECT value FROM consignments_settings WHERE key = 'additionalNotificationEmails'`).get() as { value: string } | undefined;
        if (!additionalEmailsRow) {
            db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('additionalNotificationEmails', '')`).run();
        }
    }
}

export async function getSettings(): Promise<ConsignmentSettings> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const defaults: ConsignmentSettings = {
        pdfTopLegend: 'Documento de Reposición',
        pdfExportColumns: ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'],
        notificationUserIds: [],
        additionalNotificationEmails: '',
    };
    try {
        const rows = db.prepare(`SELECT key, value FROM consignments_settings`).all() as { key: string; value: string }[];
        if (rows.length === 0) return defaults;
        
        const settings: Partial<ConsignmentSettings> = {};
        for (const row of rows) {
            const key = row.key as keyof ConsignmentSettings;
            try {
                (settings as any)[key] = JSON.parse(row.value);
            } catch {
                (settings as any)[key] = row.value;
            }
        }
        return { ...defaults, ...settings };
    } catch (error) {
        console.error("Error fetching consignment settings", error);
        return defaults;
    }
}

export async function saveSettings(settings: ConsignmentSettings): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const transaction = db.transaction(() => {
        const keys: (keyof ConsignmentSettings)[] = ['pdfTopLegend', 'pdfExportColumns', 'notificationUserIds', 'additionalNotificationEmails'];
        for (const key of keys) {
            if (settings[key] !== undefined) {
                const value = typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : String(settings[key]);
                db.prepare(`INSERT OR REPLACE INTO consignments_settings (key, value) VALUES (?, ?)`).run(key, value);
            }
        }
    });
    transaction();
}

export async function getAgreements(): Promise<(ConsignmentAgreement & { product_count?: number; boleta_count?: number })[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreements = db.prepare(`
        SELECT 
            ca.*, 
            COUNT(DISTINCT cp.id) as product_count,
            (SELECT COUNT(*) FROM restock_boletas rb WHERE rb.agreement_id = ca.id) as boleta_count
        FROM consignment_agreements ca
        LEFT JOIN consignment_products cp ON ca.id = cp.agreement_id
        GROUP BY ca.id
        ORDER BY ca.client_name
    `).all() as (ConsignmentAgreement & { product_count?: number; boleta_count?: number })[];
    return JSON.parse(JSON.stringify(agreements));
}


export async function saveAgreement(agreement: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id?: number }, products: Omit<ConsignmentProduct, 'id' | 'agreement_id'>[]) {
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

export async function deleteAgreement(agreementId: number): Promise<{ success: boolean; message: string }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    try {
        const boletaCount = db.prepare('SELECT COUNT(*) as count FROM restock_boletas WHERE agreement_id = ?').get(agreementId) as { count: number };
        if (boletaCount.count > 0) {
            return { success: false, message: `No se puede eliminar. El acuerdo tiene ${boletaCount.count} boleta(s) asociada(s).` };
        }

        const deleteResult = db.prepare('DELETE FROM consignment_agreements WHERE id = ?').run(agreementId);
        
        if (deleteResult.changes === 0) {
            return { success: false, message: 'No se encontró el acuerdo a eliminar.' };
        }

        await logInfo(`Consignment agreement with ID ${agreementId} was deleted.`);
        return { success: true, message: 'Acuerdo eliminado con éxito.' };

    } catch (error: any) {
        logError('Failed to delete consignment agreement', { error: error.message, agreementId });

        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return { success: false, message: 'No se puede eliminar. El acuerdo tiene documentos (boletas) asociados.' };
        }
        
        return { success: false, message: 'Ocurrió un error inesperado en la base de datos.' };
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
        const allUsers: User[] = await getAllUsersFromMain();
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
        const boletaInfo = db.prepare(`INSERT INTO restock_boletas (consecutive, agreement_id, status, created_by, created_at) VALUES (?, ?, 'review', ?, datetime('now'))`)
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
        const currentBoleta = db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta | undefined;
        if (!currentBoleta) {
            throw new Error("Boleta no encontrada.");
        }
        
        if (status === 'invoiced' && !erpInvoiceNumber?.trim()) {
            throw new Error("El número de factura del ERP es requerido para marcar como facturada.");
        }

        let setClauses = ['status = @status'];
        const params: any = { status, boletaId };

        if (status === 'approved') {
            setClauses.push('approved_by = @approvedBy', 'approved_at = datetime(\'now\')');
            params.approvedBy = updatedBy;
        } else if (status === 'pending') {
            setClauses.push('submitted_by = @updatedBy');
            params.updatedBy = updatedBy;
        } else if (status === 'pending-revert') { // Special internal status for reverting
             setClauses.push('status = @newStatus', 'approved_by = NULL', 'approved_at = NULL');
             params.newStatus = 'pending';
        }
        
        if (status === 'invoiced') {
            setClauses.push('erp_invoice_number = @erpInvoiceNumber');
            params.erpInvoiceNumber = erpInvoiceNumber;
        } else if (currentBoleta.status === 'invoiced' && status === 'sent') {
            // This is a revert action. Clear the invoice number.
            setClauses.push('erp_invoice_number = NULL');
        }

        const updateQuery = `UPDATE restock_boletas SET ${setClauses.join(', ')} WHERE id = @boletaId`;
        db.prepare(updateQuery).run(params);
        
        db.prepare('INSERT INTO boleta_history (boleta_id, timestamp, status, updatedBy, notes) VALUES (?, datetime(\'now\'), ?, ?, ?)')
          .run(boletaId, status, updatedBy, notes);
        
        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta;
    });

    return transaction();
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
        db.prepare('UPDATE restock_boletas SET notes = ? WHERE id = ?').run(boleta.notes, boleta.id);
        
        const updateLineStmt = db.prepare('UPDATE boleta_lines SET replenish_quantity = ?, max_stock = ?, price = ? WHERE id = ?');
        for (const line of lines) {
            updateLineStmt.run(line.replenish_quantity, line.max_stock, line.price, line.id);
        }
        
        db.prepare('INSERT INTO boleta_history (boleta_id, timestamp, status, updatedBy, notes) VALUES (?, datetime(\'now\'), ?, ?, ?)')
          .run(boleta.id, boleta.status, updatedBy, 'Líneas de boleta editadas y recalculadas.');

        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boleta.id) as RestockBoleta;
    });
    
    return transaction();
}

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }, statuses: RestockBoletaStatus[] = []): Promise<{ boletas: (RestockBoleta & { lines: BoletaLine[] })[] }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    
    let query = `
        SELECT * FROM restock_boletas 
        WHERE agreement_id = ? AND created_at BETWEEN ? AND ?
    `;
    const params: any[] = [agreementId, dateRange.from.toISOString(), dateRange.to.toISOString()];

    if (statuses.length > 0) {
        query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
    }
    
    query += ' ORDER BY created_at ASC'; // Order by oldest to newest to process chronologically

    const boletas = db.prepare(query).all(...params) as RestockBoleta[];
    
    if (boletas.length === 0) return { boletas: [] };

    const boletaIds = boletas.map(b => b.id);
    const placeholders = boletaIds.map(() => '?').join(',');

    const allLines = db.prepare(`SELECT * FROM boleta_lines WHERE boleta_id IN (${placeholders})`).all(...boletaIds) as BoletaLine[];

    const boletasWithLines = boletas.map(b => ({
        ...b,
        lines: allLines.filter(l => l.boleta_id === b.id)
    }));

    return JSON.parse(JSON.stringify(boletasWithLines));
}

export async function getLatestBoletaBeforeDate(agreementId: number, date: Date): Promise<(RestockBoleta & { lines: BoletaLine[] }) | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const boleta = db.prepare(`
        SELECT * FROM restock_boletas
        WHERE agreement_id = ? AND created_at < ? AND status != 'canceled'
        ORDER BY created_at DESC
        LIMIT 1
    `).get(agreementId, date.toISOString()) as RestockBoleta | undefined;

    if (!boleta) return null;

    const lines = db.prepare('SELECT * FROM boleta_lines WHERE boleta_id = ?').all(boleta.id) as BoletaLine[];

    return JSON.parse(JSON.stringify({ ...boleta, lines }));
}


export async function getActiveConsignmentSessions(): Promise<(CountingSession & { agreement_name: string; user_name: string; })[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);

    const sessions = db.prepare(`
        SELECT cs.id, cs.agreement_id, cs.user_id, cs.created_at, ca.client_name
        FROM counting_sessions cs
        JOIN consignment_agreements ca ON cs.agreement_id = ca.id
        WHERE cs.status = 'in-progress'
    `).all() as (CountingSession & { client_name: string })[];

    if (sessions.length === 0) return [];
    
    const userIds = sessions.map(s => s.user_id);
    const users: User[] = await getAllUsersFromMain();
    const userMap = new Map(users.map((u: User) => [u.id, u.name]));

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
