
/**
 * @fileoverview Server-side functions for the consignments module database.
 */
"use server";

import { connectDb, getAllProducts as getAllProductsFromMainDb } from '@/modules/core/lib/db';
import { getAllUsers as getAllUsersFromMain } from '@/modules/core/lib/auth';
import type { ConsignmentAgreement, ConsignmentProduct, RestockBoleta, BoletaLine, BoletaHistory, User, Product, RestockBoletaStatus, ConsignmentSettings, PeriodClosure, PhysicalCount, BoletaType } from '@/modules/core/types';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';

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
            is_active BOOLEAN NOT NULL DEFAULT 1,
            product_code_display_mode TEXT NOT NULL DEFAULT 'erp_only',
            notification_user_ids TEXT,
            operation_mode TEXT NOT NULL DEFAULT 'auto',
            locked_by TEXT,
            locked_by_user_id INTEGER,
            locked_at TEXT
        );

        CREATE TABLE IF NOT EXISTS consignment_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            client_product_code TEXT,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE,
            UNIQUE(agreement_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS restock_boletas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            agreement_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'REPOSITION',
            created_by TEXT,
            submitted_by TEXT,
            created_at TEXT,
            approved_by TEXT,
            approved_at TEXT,
            erp_invoice_number TEXT,
            erp_movement_id TEXT,
            delivery_date TEXT,
            notes TEXT,
            previousStatus TEXT,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS boleta_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boleta_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            client_product_code TEXT,
            product_description TEXT NOT NULL,
            counted_quantity REAL NOT NULL,
            replenish_quantity REAL NOT NULL,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            is_manually_edited BOOLEAN DEFAULT FALSE,
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
         CREATE TABLE IF NOT EXISTS physical_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            quantity REAL NOT NULL,
            counted_at TEXT NOT NULL,
            counted_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS period_closures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            agreement_id INTEGER NOT NULL,
            status TEXT NOT NULL, -- pending, approved, rejected, invoiced
            closure_boleta_id INTEGER,
            physical_count_ref TEXT,
            previous_closure_id INTEGER,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            approved_at TEXT,
            approved_by TEXT,
            notes TEXT,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id),
            FOREIGN KEY (closure_boleta_id) REFERENCES restock_boletas(id),
            FOREIGN KEY (previous_closure_id) REFERENCES period_closures(id)
        );
    `;
    db.exec(schema);

    const defaultPdfColumns = ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'];
    db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfTopLegend', 'Documento de Reposición')`).run();
    db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('pdfExportColumns', ?)`).run(JSON.stringify(defaultPdfColumns));
    db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('next_closure_number', '1')`).run();

    console.log(`Database ${CONSIGNMENTS_DB_FILE} initialized for Consignments module.`);
}

export async function runConsignmentsMigrations(db: import('better-sqlite3').Database) {
    try {
        const agreementsTableInfo = db.prepare(`PRAGMA table_info(consignment_agreements)`).all() as { name: string }[];
        if (agreementsTableInfo.length > 0) {
            const agreementColumns = new Set(agreementsTableInfo.map(c => c.name));
            if (!agreementColumns.has('operation_mode')) db.exec(`ALTER TABLE consignment_agreements ADD COLUMN operation_mode TEXT NOT NULL DEFAULT 'auto'`);
            if (!agreementColumns.has('locked_by')) db.exec(`ALTER TABLE consignment_agreements ADD COLUMN locked_by TEXT`);
            if (!agreementColumns.has('locked_by_user_id')) db.exec(`ALTER TABLE consignment_agreements ADD COLUMN locked_by_user_id INTEGER`);
            if (!agreementColumns.has('locked_at')) db.exec(`ALTER TABLE consignment_agreements ADD COLUMN locked_at TEXT`);
        }

        const boletasTableInfo = db.prepare(`PRAGMA table_info(restock_boletas)`).all() as { name: string }[];
        if (boletasTableInfo.length > 0 && !boletasTableInfo.some(c => c.name === 'type')) {
            db.exec(`ALTER TABLE restock_boletas ADD COLUMN type TEXT NOT NULL DEFAULT 'REPOSITION'`);
        }
        
        const physicalCountsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='physical_counts'`).get();
        if (!physicalCountsTable) {
            db.exec(`CREATE TABLE physical_counts (id INTEGER PRIMARY KEY AUTOINCREMENT, agreement_id INTEGER NOT NULL, product_id TEXT NOT NULL, quantity REAL NOT NULL, counted_at TEXT NOT NULL, counted_by TEXT NOT NULL)`);
        }

        const periodClosuresTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='period_closures'`).get();
        if (!periodClosuresTable) {
            db.exec(`CREATE TABLE period_closures (id INTEGER PRIMARY KEY AUTOINCREMENT, consecutive TEXT UNIQUE NOT NULL, agreement_id INTEGER NOT NULL, status TEXT NOT NULL, closure_boleta_id INTEGER, physical_count_ref TEXT, previous_closure_id INTEGER, created_at TEXT NOT NULL, created_by TEXT NOT NULL, approved_at TEXT, approved_by TEXT, notes TEXT, FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id), FOREIGN KEY (closure_boleta_id) REFERENCES restock_boletas(id), FOREIGN KEY (previous_closure_id) REFERENCES period_closures(id))`);
        } else {
             const closureTableInfo = db.prepare(`PRAGMA table_info(period_closures)`).all() as { name: string }[];
             if (!closureTableInfo.some(c => c.name === 'closure_boleta_id')) {
                 db.exec(`ALTER TABLE period_closures ADD COLUMN closure_boleta_id INTEGER REFERENCES restock_boletas(id)`);
             }
             if (!closureTableInfo.some(c => c.name === 'physical_count_ref')) {
                 db.exec(`ALTER TABLE period_closures ADD COLUMN physical_count_ref TEXT`);
             }
        }
        
        const settingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='consignments_settings'`).get();
        if (settingsTable) {
             const nextClosureRow = db.prepare(`SELECT key FROM consignments_settings WHERE key = 'next_closure_number'`).get();
            if (!nextClosureRow) {
                db.prepare(`INSERT OR IGNORE INTO consignments_settings (key, value) VALUES ('next_closure_number', '1')`).run();
            }
        }
    } catch(error) {
        logError('Error running consignments migrations', { error: (error as Error).message });
    }
}
// Keep other functions from original file
export async function getSettings(): Promise<ConsignmentSettings> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const defaults: ConsignmentSettings = {
        pdfTopLegend: 'Documento de Reposición',
        pdfExportColumns: ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'],
        notificationUserIds: [],
        additionalNotificationEmails: '',
        next_closure_number: 1,
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
    const transaction = db.transaction((settingsToUpdate: ConsignmentSettings) => {
        const keys: (keyof ConsignmentSettings)[] = ['pdfTopLegend', 'pdfExportColumns', 'notificationUserIds', 'additionalNotificationEmails', 'next_closure_number'];
        for (const key of keys) {
            if (settingsToUpdate[key] !== undefined) {
                const value = typeof settingsToUpdate[key] === 'object' ? JSON.stringify(settingsToUpdate[key]) : String(settingsToUpdate[key]);
                db.prepare(`INSERT OR REPLACE INTO consignments_settings (key, value) VALUES (?, ?)`).run(key, value);
            }
        }
    });
    transaction(settings);
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
        const notificationUserIdsJson = JSON.stringify(agreement.notification_user_ids || []);
        if (agreementId) { // Update
            db.prepare('UPDATE consignment_agreements SET client_id = ?, client_name = ?, erp_warehouse_id = ?, notes = ?, is_active = ?, product_code_display_mode = ?, notification_user_ids = ?, operation_mode = ? WHERE id = ?')
              .run(agreement.client_id, agreement.client_name, agreement.erp_warehouse_id, agreement.notes, agreement.is_active, agreement.product_code_display_mode, notificationUserIdsJson, agreement.operation_mode || 'auto', agreementId);
        } else { // Create
            const info = db.prepare('INSERT INTO consignment_agreements (client_id, client_name, erp_warehouse_id, notes, is_active, product_code_display_mode, notification_user_ids, operation_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(agreement.client_id, agreement.client_name, agreement.erp_warehouse_id, agreement.notes, agreement.is_active, agreement.product_code_display_mode, notificationUserIdsJson, agreement.operation_mode || 'auto');
            agreementId = info.lastInsertRowid as number;
        }

        if (products && products.length >= 0) {
            db.prepare('DELETE FROM consignment_products WHERE agreement_id = ?').run(agreementId);
            const insertProduct = db.prepare('INSERT INTO consignment_products (agreement_id, product_id, max_stock, price, client_product_code) VALUES (@agreement_id, @product_id, @max_stock, @price, @client_product_code)');
            for (const product of products) {
                insertProduct.run({
                    agreement_id: agreementId,
                    product_id: product.product_id,
                    max_stock: product.max_stock,
                    price: product.price,
                    client_product_code: product.client_product_code || null,
                });
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
            return { success: false, message: `No se puede eliminar. El acuerdo tiene ${boletaCount.count} boleta(s) asociada(s). Por favor, elimínelas primero.` };
        }

        const deleteResult = db.prepare('DELETE FROM consignment_agreements WHERE id = ?').run(agreementId);
        
        if (deleteResult.changes === 0) {
            return { success: false, message: 'No se encontró el acuerdo a eliminar.' };
        }

        logInfo(`Consignment agreement with ID ${agreementId} was deleted.`);
        return { success: true, message: 'Acuerdo eliminado con éxito.' };

    } catch (error: any) {
        logError('Failed to delete consignment agreement', { error: error.message, agreementId });
        return { success: false, message: 'Ocurrió un error inesperado en la base de datos.' };
    }
}


export async function getAgreementDetails(agreementId: number): Promise<{ agreement: ConsignmentAgreement, products: ConsignmentProduct[] } | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(agreementId) as ConsignmentAgreement | undefined;
    if (!agreement) return null;
    if (agreement.notification_user_ids && typeof agreement.notification_user_ids === 'string') {
        agreement.notification_user_ids = JSON.parse(agreement.notification_user_ids);
    } else {
        agreement.notification_user_ids = [];
    }
    const products = db.prepare('SELECT * FROM consignment_products WHERE agreement_id = ?').all(agreementId) as ConsignmentProduct[];
    return JSON.parse(JSON.stringify({ agreement, products }));
}

export async function getBoletas(filters: { status: string[], dateRange?: { from?: Date, to?: Date }, type?: BoletaType }) {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    let query = `
        SELECT 
            rb.*,
            SUM(bl.replenish_quantity) as total_replenish_quantity
        FROM restock_boletas rb
        LEFT JOIN boleta_lines bl ON rb.id = bl.boleta_id
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];
    
    if (filters.status && filters.status.length > 0) {
        whereClauses.push(`rb.status IN (${filters.status.map(() => '?').join(',')})`);
        params.push(...filters.status);
    }
    
    if (filters.type) {
        whereClauses.push(`rb.type = ?`);
        params.push(filters.type);
    }

    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    query += ' GROUP BY rb.id ORDER BY rb.created_at DESC';

    const boletas = db.prepare(query).all(...params) as RestockBoleta[];
    return JSON.parse(JSON.stringify(boletas));
}

export async function updateBoletaStatus(payload: { boletaId: number, status: string, notes: string, updatedBy: string, erpInvoiceNumber?: string, erpMovementId?: string }): Promise<RestockBoleta> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const { boletaId, status, notes, updatedBy, erpInvoiceNumber, erpMovementId } = payload;
    
    const transaction = db.transaction(() => {
        const currentBoleta = db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta | undefined;
        if (!currentBoleta) {
            throw new Error("Boleta no encontrada.");
        }
        
        if (status === 'pending') {
            if (!erpMovementId || !erpMovementId.trim()) {
                throw new Error("El número de movimiento de inventario del ERP es requerido para poder enviar a aprobación.");
            }
            const lines = db.prepare('SELECT * FROM boleta_lines WHERE boleta_id = ?').all(boletaId) as BoletaLine[];
            const totalReplenish = lines.reduce((sum, line) => sum + line.replenish_quantity, 0);

            const hasUntouchedManualLines = lines.some(line => line.max_stock === 0 && line.is_manually_edited === 0);
            if (hasUntouchedManualLines) {
                throw new Error("Hay productos que requieren una cantidad manual. Por favor, edita la boleta y asigna una cantidad (incluso 0) a todas las líneas antes de enviar a aprobación.");
            }

            if (totalReplenish <= 0) {
                 throw new Error("No se puede enviar a aprobación una boleta sin cantidad total a reponer.");
            }
        }
        
        let approved_by = currentBoleta.approved_by;
        if (status === 'approved' && !currentBoleta.approved_by) {
            approved_by = updatedBy;
        }

        let submittedBy = currentBoleta.submitted_by;
        if (status === 'pending') {
            submittedBy = updatedBy;
        }

        let previousStatus = currentBoleta.previousStatus;
        if (status === 'review') {
            previousStatus = currentBoleta.status;
        } else {
            previousStatus = null; // Clear it for forward movements
        }

        const updateParams: any = {
            status,
            id: boletaId,
            approved_by,
            submittedBy,
            previousStatus,
        };

        let setClauses = [
            'status = @status',
            'approved_by = @approved_by',
            'submitted_by = @submittedBy',
            'previousStatus = @previousStatus',
        ];

        if (status === 'approved') {
            setClauses.push('approved_at = datetime(\'now\')');
        } else if (status === 'pending') {
            if (erpMovementId) {
                setClauses.push('erp_movement_id = @erpMovementId');
                updateParams.erpMovementId = erpMovementId;
            }
        } else if (status === 'invoiced') {
            if (!erpInvoiceNumber?.trim()) {
                throw new Error("El número de factura del ERP es requerido para marcar como facturada.");
            }
            setClauses.push('erp_invoice_number = @erpInvoiceNumber');
            updateParams.erpInvoiceNumber = erpInvoiceNumber;
        } else if (currentBoleta.status === 'invoiced' && status === 'sent') {
            setClauses.push('erp_invoice_number = NULL');
        }
        
        const updateQuery = `UPDATE restock_boletas SET ${setClauses.join(', ')} WHERE id = @id`;
        db.prepare(updateQuery).run(updateParams);
        
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
        db.prepare('UPDATE restock_boletas SET notes = ?, delivery_date = ?, erp_movement_id = ? WHERE id = ?').run(boleta.notes, boleta.delivery_date, boleta.erp_movement_id, boleta.id);
        
        const updateLineStmt = db.prepare('UPDATE boleta_lines SET replenish_quantity = ?, max_stock = ?, price = ?, is_manually_edited = ? WHERE id = ?');
        for (const line of lines) {
            updateLineStmt.run(line.replenish_quantity, line.max_stock, line.price, line.is_manually_edited ? 1 : 0, line.id);
        }
        
        db.prepare('INSERT INTO boleta_history (boleta_id, timestamp, status, updatedBy, notes) VALUES (?, datetime(\'now\'), ?, ?, ?)')
          .run(boleta.id, boleta.status, updatedBy, 'Líneas de boleta editadas y recalculadas.');

        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boleta.id) as RestockBoleta;
    });
    
    return transaction();
}

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }, statuses?: RestockBoletaStatus[]): Promise<(RestockBoleta & { lines: BoletaLine[]; history: BoletaHistory[]; })[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    
    let query = `
        SELECT * FROM restock_boletas 
        WHERE agreement_id = ? AND created_at BETWEEN ? AND ?
    `;
    const params: any[] = [agreementId, dateRange.from.toISOString(), dateRange.to.toISOString()];

    if (statuses && statuses.length > 0) {
        query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
    }
    
    query += ' ORDER BY created_at ASC'; // Order by oldest to newest to process chronologically

    const boletas = db.prepare(query).all(...params) as RestockBoleta[];
    
    if (boletas.length === 0) return [];

    const boletaIds = boletas.map(b => b.id);
    const placeholders = boletaIds.map(() => '?').join(',');

    const allLines = db.prepare(`SELECT * FROM boleta_lines WHERE boleta_id IN (${placeholders})`).all(...boletaIds) as BoletaLine[];
    const allHistory = db.prepare(`SELECT * FROM boleta_history WHERE boleta_id IN (${placeholders})`).all(...boletaIds) as BoletaHistory[];

    const historyMap = new Map<number, BoletaHistory[]>();
    allHistory.forEach(h => {
        if (!historyMap.has(h.boleta_id)) {
            historyMap.set(h.boleta_id, []);
        }
        historyMap.get(h.boleta_id)!.push(h);
    });

    const boletasWithDetails = boletas.map(b => ({
        ...b,
        lines: allLines.filter(l => l.boleta_id === b.id),
        history: historyMap.get(b.id) || []
    }));

    return JSON.parse(JSON.stringify(boletasWithDetails));
}


export async function getLatestBoletaBeforeDate(agreementId: number, date: Date): Promise<(RestockBoleta & { lines: BoletaLine[] }) | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const boleta = db.prepare(`
        SELECT * FROM restock_boletas
        WHERE agreement_id = ? AND created_at < ? AND type = 'INVENTORY_COUNT'
        ORDER BY created_at DESC
        LIMIT 1
    `).get(agreementId, date.toISOString()) as RestockBoleta | undefined;

    if (!boleta) return null;

    const lines = db.prepare('SELECT * FROM boleta_lines WHERE boleta_id = ?').all(boleta.id) as BoletaLine[];

    return JSON.parse(JSON.stringify({ ...boleta, lines }));
}


export async function savePhysicalCount(agreementId: number, lines: { productId: string; quantity: number }[], userName: string) {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const transaction = db.transaction(() => {
        // Here we just save, we don't delete. The "last" is determined by timestamp.
        const stmt = db.prepare('INSERT INTO physical_counts (agreement_id, product_id, quantity, counted_at, counted_by) VALUES (?, ?, ?, ?, ?)');
        const now = new Date().toISOString();
        for (const line of lines) {
            stmt.run(agreementId, line.productId, line.quantity, now, userName);
        }
    });
    transaction();
}

function getSettingsTx(db: import('better-sqlite3').Database): ConsignmentSettings {
     const defaults: ConsignmentSettings = {
        pdfTopLegend: 'Documento de Reposición',
        pdfExportColumns: ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'],
        notificationUserIds: [],
        additionalNotificationEmails: '',
        next_closure_number: 1,
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
        console.error("Error fetching consignment settings in TX, returning default.", error);
        return defaults;
    }
}

export async function createClosureFromCount(agreementId: number, lines: { productId: string; quantity: number }[], userName: string): Promise<PeriodClosure> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    
    return db.transaction(() => {
        const settings = getSettingsTx(db);
        const nextClosureNumber = settings.next_closure_number || 1;
        const closureConsecutive = `CIERRE-${String(nextClosureNumber).padStart(6, '0')}`;
        
        const countRef = new Date().toISOString();

        // Save this count to physical_counts table, which will be used if approved
        const stmt = db.prepare('INSERT INTO physical_counts (agreement_id, product_id, quantity, counted_at, counted_by) VALUES (?, ?, ?, ?, ?)');
        for (const line of lines) {
            stmt.run(agreementId, line.productId, line.quantity, countRef, userName);
        }

        const closureInfo = db.prepare('INSERT INTO period_closures (consecutive, agreement_id, status, physical_count_ref, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            .run(closureConsecutive, agreementId, 'pending', countRef, new Date().toISOString(), userName);
        
        db.prepare(`INSERT OR REPLACE INTO consignments_settings (key, value) VALUES ('next_closure_number', ?)`).run(nextClosureNumber + 1);

        return db.prepare('SELECT * FROM period_closures WHERE id = ?').get(closureInfo.lastInsertRowid) as PeriodClosure;
    })();
}

export async function getLatestPhysicalCount(agreementId: number): Promise<PhysicalCount[] | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const counts = db.prepare('SELECT * FROM physical_counts WHERE agreement_id = ?').all(agreementId) as PhysicalCount[];
    return counts.length > 0 ? counts : null;
}

export async function getPhysicalCountByRef(agreementId: number, countedAt: string): Promise<PhysicalCount[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const counts = db.prepare('SELECT * FROM physical_counts WHERE agreement_id = ? AND counted_at = ?').all(agreementId, countedAt) as PhysicalCount[];
    return JSON.parse(JSON.stringify(counts));
}

export async function getPeriodClosures(filters: {}): Promise<(PeriodClosure & { client_name: string; is_initial_inventory: boolean; })[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const closures = db.prepare(`
        SELECT 
            pc.*, 
            ca.client_name,
            CASE WHEN pc.previous_closure_id IS NULL THEN 1 ELSE 0 END as is_initial_inventory
        FROM period_closures pc
        JOIN consignment_agreements ca ON pc.agreement_id = ca.id
        ORDER BY pc.created_at DESC
    `).all() as (PeriodClosure & { client_name: string; is_initial_inventory: 0 | 1 })[];
    
    const result = closures.map(c => ({
        ...c,
        is_initial_inventory: c.is_initial_inventory === 1
    }));
    
    return JSON.parse(JSON.stringify(result));
}


export async function getPeriodClosureDetails(closureId: number): Promise<PeriodClosure | null> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const closure = db.prepare('SELECT * FROM period_closures WHERE id = ?').get(closureId) as PeriodClosure | undefined;
    return closure ? JSON.parse(JSON.stringify(closure)) : null;
}

export async function approvePeriodClosure(closureId: number, previousClosureId: number | null, updatedBy: string): Promise<PeriodClosure> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const mainDb = await connectDb();

    return db.transaction(() => {
        const closure = db.prepare('SELECT * FROM period_closures WHERE id = ?').get(closureId) as PeriodClosure;
        if (!closure || !closure.physical_count_ref) throw new Error("Cierre inválido o sin conteo físico asociado.");
        
        const counts = db.prepare('SELECT * FROM physical_counts WHERE agreement_id = ? AND counted_at = ?').all(closure.agreement_id, closure.physical_count_ref) as PhysicalCount[];
        if (counts.length === 0) throw new Error("No se encontraron los datos del conteo físico para este cierre.");
        
        const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(closure.agreement_id) as ConsignmentAgreement;

        // Create the official boleta from the physical counts
        const boletaConsecutive = `CIERRE-B-${closure.consecutive}`;
        const boletaInfo = db.prepare(`INSERT INTO restock_boletas (consecutive, agreement_id, status, created_by, created_at, type) VALUES (?, ?, 'approved', ?, ?, 'INVENTORY_COUNT')`)
            .run(boletaConsecutive, closure.agreement_id, updatedBy, closure.created_at);
        const boletaId = boletaInfo.lastInsertRowid as number;

        const allProducts = mainDb.prepare('SELECT * FROM products').all() as Product[];
        const agreementProducts = db.prepare('SELECT * FROM consignment_products WHERE agreement_id = ?').all(closure.agreement_id) as ConsignmentProduct[];
        const insertLine = db.prepare('INSERT INTO boleta_lines (boleta_id, product_id, product_description, client_product_code, counted_quantity, replenish_quantity, max_stock, price, is_manually_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)');
        
        for (const count of counts) {
            const agreementProduct = agreementProducts.find(p => p.product_id === count.product_id);
            if (!agreementProduct) continue;
            
            const productDescription = allProducts.find(p => p.id === count.product_id)?.description || 'Desconocido';
            insertLine.run(boletaId, count.product_id, productDescription, agreementProduct.client_product_code, count.quantity, 0, agreementProduct.max_stock, agreementProduct.price);
        }
        
        // Update the closure to link it to the newly created boleta
        db.prepare('UPDATE period_closures SET status = ?, previous_closure_id = ?, approved_at = ?, approved_by = ?, closure_boleta_id = ? WHERE id = ?')
          .run('approved', previousClosureId, new Date().toISOString(), updatedBy, boletaId, closureId);

        return db.prepare('SELECT * FROM period_closures WHERE id = ?').get(closureId) as PeriodClosure;
    })();
}

export async function rejectPeriodClosure(closureId: number, notes: string, updatedBy: string): Promise<PeriodClosure> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    db.prepare('UPDATE period_closures SET status = ?, notes = ?, approved_by = ?, approved_at = ? WHERE id = ?')
      .run('rejected', notes, updatedBy, new Date().toISOString(), closureId);
    return db.prepare('SELECT * FROM period_closures WHERE id = ?').get(closureId) as PeriodClosure;
}

export async function getConsignmentsBillingReportData(closureId: number): Promise<any> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const currentClosure = db.prepare('SELECT ca.client_name, pc.* FROM period_closures pc JOIN consignment_agreements ca ON pc.agreement_id = ca.id WHERE pc.id = ?').get(closureId) as (PeriodClosure & { client_name: string });
    if (!currentClosure) throw new Error('Cierre no encontrado.');
    if (currentClosure.status !== 'approved') throw new Error('El cierre debe estar aprobado para generar el reporte de facturación.');

    const previousClosure = currentClosure.previous_closure_id ? db.prepare('SELECT * FROM period_closures WHERE id = ?').get(currentClosure.previous_closure_id) as PeriodClosure : null;

    const startDate = previousClosure ? new Date(previousClosure.created_at) : new Date(0);
    const endDate = new Date(currentClosure.created_at);

    const boletasInPeriod = await getBoletasByDateRange(String(currentClosure.agreement_id), { from: startDate, to: endDate }, ['approved', 'sent', 'invoiced']);
    const replenishmentBoletas = boletasInPeriod.filter(b => b.type === 'REPOSITION');

    const [currentClosureDetails, previousClosureDetails] = await Promise.all([
        currentClosure.closure_boleta_id ? getBoletaDetails(currentClosure.closure_boleta_id) : Promise.resolve(null),
        previousClosure && previousClosure.closure_boleta_id ? getBoletaDetails(previousClosure.closure_boleta_id) : Promise.resolve(null),
    ]);

    if (!currentClosureDetails) throw new Error('Boleta de cierre actual no encontrada.');

    const initialStockMap = new Map<string, number>();
    previousClosureDetails?.lines.forEach(line => initialStockMap.set(line.product_id, line.counted_quantity));

    const finalStockMap = new Map<string, number>();
    currentClosureDetails.lines.forEach(line => finalStockMap.set(line.product_id, line.counted_quantity));
    
    const replenishedMap = new Map<string, number>();
    replenishmentBoletas.forEach(boleta => {
        boleta.lines.forEach(line => {
            const current = replenishedMap.get(line.product_id) || 0;
            replenishedMap.set(line.product_id, current + line.replenish_quantity);
        });
    });

    const allProductIds = new Set([
        ...initialStockMap.keys(),
        ...finalStockMap.keys(),
        ...replenishedMap.keys()
    ]);

    const reportRows = Array.from(allProductIds).map(productId => {
        const productDetails = currentClosureDetails.lines.find(l => l.product_id === productId) || previousClosureDetails?.lines.find(l => l.product_id === productId);
        const initialStock = initialStockMap.get(productId) || 0;
        const totalReplenished = replenishedMap.get(productId) || 0;
        const finalStock = finalStockMap.get(productId) || 0;
        const consumption = (initialStock + totalReplenished) - finalStock;

        return {
            productId,
            productDescription: productDetails?.product_description || 'Desconocido',
            clientProductCode: productDetails?.client_product_code || '',
            initialStock,
            totalReplenished,
            finalStock,
            consumption: consumption > 0 ? consumption : 0,
            price: productDetails?.price || 0,
            totalValue: (consumption > 0 ? consumption : 0) * (productDetails?.price || 0),
        };
    }).filter(row => row.consumption > 0);

    return { reportRows, boletas: replenishmentBoletas, currentClosure, previousClosure };
}

export async function saveReplenishmentBoleta(agreementId: number, lines: { productId: string; quantity: number }[], userName: string): Promise<RestockBoleta> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const mainDb = await connectDb();
    
    return db.transaction(() => {
        const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(agreementId) as ConsignmentAgreement;
        if (!agreement) throw new Error("Agreement not found");

        const consecutive = `${agreement.client_id}-${String(agreement.next_boleta_number).padStart(4, '0')}`;
        const boletaInfo = db.prepare(`INSERT INTO restock_boletas (consecutive, agreement_id, status, created_by, created_at, type) VALUES (?, ?, 'review', ?, datetime('now'), 'REPOSITION')`)
            .run(consecutive, agreement.id, userName);
        const boletaId = boletaInfo.lastInsertRowid as number;

        const allProducts = mainDb.prepare('SELECT * FROM products').all() as Product[];
        const agreementProducts = db.prepare('SELECT * FROM consignment_products WHERE agreement_id = ?').all(agreementId) as ConsignmentProduct[];
        const insertLine = db.prepare('INSERT INTO boleta_lines (boleta_id, product_id, product_description, client_product_code, counted_quantity, replenish_quantity, max_stock, price, is_manually_edited) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1)');
        
        for (const line of lines) {
            const agreementProduct = agreementProducts.find(p => p.product_id === line.productId);
            if (!agreementProduct) continue;
            
            const productDescription = allProducts.find(p => p.id === line.productId)?.description || 'Desconocido';
            
            insertLine.run(boletaId, line.productId, productDescription, agreementProduct.client_product_code, line.quantity, agreementProduct.max_stock, agreementProduct.price);
        }

        db.prepare(`UPDATE consignment_agreements SET next_boleta_number = ? WHERE id = ?`).run(agreement.next_boleta_number + 1, agreement.id);
        
        return db.prepare('SELECT * FROM restock_boletas WHERE id = ?').get(boletaId) as RestockBoleta;
    })();
}

export async function lockAgreement(agreementId: number, userId: number, userName: string): Promise<{ success: boolean, locked: boolean, message: string }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreement = db.prepare('SELECT * FROM consignment_agreements WHERE id = ?').get(agreementId) as (ConsignmentAgreement & { locked_by?: string });
    if (!agreement) {
        return { success: false, locked: false, message: 'Acuerdo no encontrado.' };
    }
    if (agreement.locked_by && agreement.locked_by !== userName) {
        return { success: false, locked: true, message: `El acuerdo está siendo usado por ${agreement.locked_by}.` };
    }
    db.prepare('UPDATE consignment_agreements SET locked_by = ?, locked_by_user_id = ?, locked_at = datetime(\'now\') WHERE id = ?').run(userName, userId, agreementId);
    return { success: true, locked: false, message: 'Acuerdo bloqueado para ti.' };
}

export async function forceRelayLock(agreementId: number, userId: number, userName: string): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    logWarn(`Lock for agreement ${agreementId} was force-relayed to ${userName}.`);
    db.prepare('UPDATE consignment_agreements SET locked_by = ?, locked_by_user_id = ?, locked_at = datetime(\'now\') WHERE id = ?').run(userName, userId, agreementId);
}

export async function releaseAgreementLock(agreementId: number, userId: number): Promise<void> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    // Only release the lock if the current user is the one who holds it.
    db.prepare('UPDATE consignment_agreements SET locked_by = NULL, locked_by_user_id = NULL, locked_at = NULL WHERE id = ? AND locked_by_user_id = ?').run(agreementId, userId);
}

    