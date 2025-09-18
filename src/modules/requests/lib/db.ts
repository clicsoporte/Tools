/**
 * @fileoverview Server-side functions for the purchase requests database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { PurchaseRequest, RequestSettings, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, UpdatePurchaseRequestPayload, RejectCancellationPayload, PurchaseRequestStatus, DateRange } from '../../core/types';
import { format, parseISO } from 'date-fns';

const REQUESTS_DB_FILE = 'requests.db';

export async function initializeRequestsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS request_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS purchase_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            purchaseOrder TEXT,
            requestDate TEXT NOT NULL,
            requiredDate TEXT NOT NULL,
            receivedDate TEXT,
            clientId TEXT NOT NULL,
            clientName TEXT NOT NULL,
            itemId TEXT NOT NULL,
            itemDescription TEXT NOT NULL,
            quantity REAL NOT NULL,
            deliveredQuantity REAL,
            inventory REAL,
            priority TEXT DEFAULT 'medium',
            purchaseType TEXT DEFAULT 'single',
            unitSalePrice REAL,
            erpOrderNumber TEXT,
            manualSupplier TEXT,
            route TEXT,
            shippingMethod TEXT,
            status TEXT NOT NULL,
            notes TEXT,
            requestedBy TEXT NOT NULL,
            approvedBy TEXT,
            receivedInWarehouseBy TEXT,
            lastStatusUpdateBy TEXT,
            lastStatusUpdateNotes TEXT,
            reopened BOOLEAN DEFAULT FALSE,
            previousStatus TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_request_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requestId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (requestId) REFERENCES purchase_requests(id)
        );
    `;
    db.exec(schema);
    
    await runRequestMigrations(db);

    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('nextRequestNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('routes', '["Ruta GAM", "Fuera de GAM"]')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('shippingMethods', '["Mensajería", "Encomienda", "Transporte Propio"]')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('useWarehouseReception', 'false')`).run();
    console.log(`Database ${REQUESTS_DB_FILE} initialized for Purchase Requests.`);
}


export async function runRequestMigrations(db: import('better-sqlite3').Database) {
    // Ensure all tables exist before trying to alter them.
    const requestsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_requests'`).get();
    if (!requestsTable) {
        // If the main table is missing, the DB is likely uninitialized or corrupt.
        // Let the standard initialization handle it.
        return;
    }

    const tableInfo = db.prepare(`PRAGMA table_info(purchase_requests)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));

    if (!columns.has('shippingMethod')) {
        console.log("MIGRATION (requests.db): Adding shippingMethod column to purchase_requests.");
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN shippingMethod TEXT`);
    }
    if (!columns.has('deliveredQuantity')) {
        console.log("MIGRATION (requests.db): Adding deliveredQuantity column to purchase_requests.");
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN deliveredQuantity REAL;`);
    }
    if (!columns.has('receivedInWarehouseBy')) {
         console.log("MIGRATION (requests.db): Adding receivedInWarehouseBy column to purchase_requests.");
         db.exec(`ALTER TABLE purchase_requests ADD COLUMN receivedInWarehouseBy TEXT;`);
    }
    if (!columns.has('inventory')) {
         console.log("MIGRATION (requests.db): Adding inventory column to purchase_requests.");
         db.exec(`ALTER TABLE purchase_requests ADD COLUMN inventory REAL;`);
    }
    if (!columns.has('priority')) {
         console.log("MIGRATION (requests.db): Adding priority column to purchase_requests.");
         db.exec(`ALTER TABLE purchase_requests ADD COLUMN priority TEXT DEFAULT 'medium'`);
    }
     if (!columns.has('receivedDate')) {
         console.log("MIGRATION (requests.db): Adding receivedDate column to purchase_requests.");
         db.exec(`ALTER TABLE purchase_requests ADD COLUMN receivedDate TEXT`);
    }
     if (!columns.has('previousStatus')) {
        console.log("MIGRATION (requests.db): Adding previousStatus column to purchase_requests.");
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN previousStatus TEXT`);
    }
    if (!columns.has('purchaseType')) {
        console.log("MIGRATION (requests.db): Adding purchaseType column to purchase_requests.");
        db.exec(`ALTER TABLE purchase_requests ADD COLUMN purchaseType TEXT DEFAULT 'single'`);
    }
}


export async function getSettings(): Promise<RequestSettings> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const settingsRows = db.prepare('SELECT * FROM request_settings').all() as { key: string; value: string }[];
    
    const settings: RequestSettings = {
        nextRequestNumber: 1,
        routes: [],
        shippingMethods: [],
        useWarehouseReception: false,
    };

    for (const row of settingsRows) {
        if (row.key === 'nextRequestNumber') {
            settings.nextRequestNumber = Number(row.value);
        } else if (row.key === 'routes') {
            try {
                settings.routes = JSON.parse(row.value);
            } catch {
                settings.routes = [];
            }
        } else if (row.key === 'shippingMethods') {
             try {
                settings.shippingMethods = JSON.parse(row.value);
            } catch {
                settings.shippingMethods = [];
            }
        } else if (row.key === 'useWarehouseReception') {
            settings.useWarehouseReception = row.value === 'true';
        }
    }
    return settings;
}

export async function saveSettings(settings: RequestSettings): Promise<void> {
    const db = await connectDb(REQUESTS_DB_FILE);
    
    const transaction = db.transaction((settingsToUpdate) => {
        if (settingsToUpdate.nextRequestNumber !== undefined) {
            db.prepare('INSERT OR REPLACE INTO request_settings (key, value) VALUES (?, ?)').run('nextRequestNumber', settingsToUpdate.nextRequestNumber.toString());
        }
        if (settingsToUpdate.routes !== undefined) {
            db.prepare('INSERT OR REPLACE INTO request_settings (key, value) VALUES (?, ?)').run('routes', JSON.stringify(settingsToUpdate.routes));
        }
        if (settingsToUpdate.shippingMethods !== undefined) {
            db.prepare('INSERT OR REPLACE INTO request_settings (key, value) VALUES (?, ?)').run('shippingMethods', JSON.stringify(settingsToUpdate.shippingMethods));
        }
        if (settingsToUpdate.useWarehouseReception !== undefined) {
            db.prepare('INSERT OR REPLACE INTO request_settings (key, value) VALUES (?, ?)').run('useWarehouseReception', settingsToUpdate.useWarehouseReception.toString());
        }
    });

    transaction(settings);
}

export async function getRequests(options: { 
    page?: number; 
    pageSize?: number;
    filters?: {
        searchTerm?: string;
        status?: string;
        classification?: string;
        dateRange?: DateRange;
    };
}): Promise<{ requests: PurchaseRequest[], totalArchivedCount: number }> {
    const db = await connectDb(REQUESTS_DB_FILE);
    
    let allRequests: PurchaseRequest[] = [];
    let totalArchivedCount = 0;
    
    const { page, pageSize, filters } = options;

    if (filters && page !== undefined && pageSize !== undefined) {
        const { searchTerm, status, dateRange } = filters;

        // Build the WHERE clause dynamically
        const whereClauses: string[] = [];
        const params: any[] = [];
        
        // This query will only target archived items
        const settings = await getSettings();
        const archivedStatuses = settings.useWarehouseReception
            ? ['received-in-warehouse', 'canceled']
            : ['received', 'canceled'];
        whereClauses.push(`status IN (${archivedStatuses.map(s => `'${s}'`).join(',')})`);


        if (searchTerm) {
            whereClauses.push(`(consecutive LIKE ? OR clientName LIKE ? OR itemDescription LIKE ?)`);
            const likeTerm = `%${searchTerm}%`;
            params.push(likeTerm, likeTerm, likeTerm);
        }
        if (status && status !== 'all') {
            whereClauses.push(`status = ?`);
            params.push(status);
        }
        if (dateRange?.from) {
            whereClauses.push(`requiredDate >= ?`);
            params.push(dateRange.from.toISOString().split('T')[0]);
        }
        if (dateRange?.to) {
            whereClauses.push(`requiredDate <= ?`);
            params.push(dateRange.to.toISOString().split('T')[0]);
        }

        const finalWhere = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const countQuery = `SELECT COUNT(*) as count FROM purchase_requests ${finalWhere}`;
        totalArchivedCount = (db.prepare(countQuery).get(...params) as { count: number }).count;
        
        const query = `SELECT * FROM purchase_requests ${finalWhere} ORDER BY requestDate DESC LIMIT ? OFFSET ?`;
        allRequests = db.prepare(query).all(...params, pageSize, page * pageSize) as PurchaseRequest[];

    } else {
        // Default behavior: fetch all requests
        allRequests = db.prepare(`SELECT * FROM purchase_requests ORDER BY requestDate DESC`).all() as PurchaseRequest[];
        const settings = await getSettings();
        const archivedStatuses = settings.useWarehouseReception
            ? ['received-in-warehouse', 'canceled']
            : ['received', 'canceled'];
        const archivedWhereClause = `status IN (${archivedStatuses.map(s => `'${s}'`).join(',')})`;
        totalArchivedCount = (db.prepare(`SELECT COUNT(*) as count FROM purchase_requests WHERE ${archivedWhereClause}`).get() as { count: number }).count;
    }
    
    return { requests: allRequests, totalArchivedCount };
}

export async function addRequest(request: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus'>, requestedBy: string): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    
    const settings = await getSettings();
    const nextNumber = settings.nextRequestNumber || 1;

    const newRequest: Omit<PurchaseRequest, 'id'> = {
        ...request,
        requestedBy: requestedBy,
        consecutive: `SC-${nextNumber.toString().padStart(5, '0')}`,
        requestDate: new Date().toISOString(),
        status: 'pending',
        reopened: false,
    };

    const stmt = db.prepare(`
        INSERT INTO purchase_requests (
            consecutive, requestDate, requiredDate, clientId, clientName,
            itemId, itemDescription, quantity, unitSalePrice, erpOrderNumber, manualSupplier, route, shippingMethod, purchaseOrder,
            status, notes, requestedBy, reopened, inventory, priority, purchaseType
        ) VALUES (
            @consecutive, @requestDate, @requiredDate, @clientId, @clientName,
            @itemId, @itemDescription, @quantity, @unitSalePrice, @erpOrderNumber, @manualSupplier, @route, @shippingMethod, @purchaseOrder,
            @status, @notes, @requestedBy, @reopened, @inventory, @priority, @purchaseType
        )
    `);

    const preparedRequest = {
        ...newRequest,
        unitSalePrice: newRequest.unitSalePrice ?? null,
        erpOrderNumber: newRequest.erpOrderNumber || null,
        manualSupplier: newRequest.manualSupplier || null,
        route: newRequest.route || null,
        shippingMethod: newRequest.shippingMethod || null,
        purchaseOrder: newRequest.purchaseOrder || null,
        notes: newRequest.notes || null,
        inventory: newRequest.inventory ?? null,
        reopened: newRequest.reopened ? 1 : 0,
        purchaseType: newRequest.purchaseType || 'single',
    };

    const info = stmt.run(preparedRequest);
    const newRequestId = info.lastInsertRowid as number;

    await saveSettings({ ...settings, nextRequestNumber: nextNumber + 1 });
    
    const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
    historyStmt.run(newRequestId, new Date().toISOString(), 'pending', newRequest.requestedBy, 'Solicitud creada');

    const createdRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(newRequestId) as PurchaseRequest;
    return createdRequest;
}

export async function updateRequest(payload: UpdatePurchaseRequestPayload): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { requestId, updatedBy, ...dataToUpdate } = payload;
    
    const currentRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest | undefined;
    if (!currentRequest) {
        throw new Error("Request not found.");
    }

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE purchase_requests SET
                requiredDate = @requiredDate,
                clientId = @clientId,
                clientName = @clientName,
                itemId = @itemId,
                itemDescription = @itemDescription,
                quantity = @quantity,
                unitSalePrice = @unitSalePrice,
                erpOrderNumber = @erpOrderNumber,
                manualSupplier = @manualSupplier,
                route = @route,
                shippingMethod = @shippingMethod,
                purchaseOrder = @purchaseOrder,
                notes = @notes,
                inventory = @inventory,
                priority = @priority,
                purchaseType = @purchaseType
            WHERE id = @requestId
        `).run({ requestId, ...dataToUpdate });

        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(requestId, new Date().toISOString(), currentRequest.status, updatedBy, 'Solicitud editada.');
    });

    transaction();
    const updatedRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest;
    return updatedRequest;
}

export async function updateStatus(payload: UpdateRequestStatusPayload): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { requestId, status, notes, updatedBy, reopen, manualSupplier, erpOrderNumber, deliveredQuantity } = payload;

    const currentRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest | undefined;
    if (!currentRequest) {
        throw new Error("Request not found.");
    }
    
    let approvedBy = currentRequest.approvedBy;
    if (status === 'approved' && !currentRequest.approvedBy) {
        approvedBy = updatedBy;
    }

    let receivedInWarehouseBy = currentRequest.receivedInWarehouseBy;
    if (status === 'received-in-warehouse') {
        receivedInWarehouseBy = updatedBy;
    }

    let receivedDate = currentRequest.receivedDate;
    if(status === 'received'){
        receivedDate = new Date().toISOString();
    }
    
    let previousStatus = currentRequest.previousStatus;
    if (status === 'canceled' && currentRequest.status !== 'canceled') {
        previousStatus = currentRequest.status;
    } else if (status !== 'canceled') {
        previousStatus = null;
    }


    const transaction = db.transaction(() => {
        const stmt = db.prepare(`
            UPDATE purchase_requests SET
                status = @status,
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                approvedBy = @approvedBy,
                reopened = @reopened,
                manualSupplier = @manualSupplier,
                erpOrderNumber = @erpOrderNumber,
                deliveredQuantity = @deliveredQuantity,
                receivedInWarehouseBy = @receivedInWarehouseBy,
                receivedDate = @receivedDate,
                previousStatus = @previousStatus
            WHERE id = @requestId
        `);

        stmt.run({
            status,
            notes: notes || null,
            updatedBy,
            approvedBy,
            requestId,
            reopened: reopen ? 1 : (currentRequest.reopened ? 1 : 0),
            manualSupplier: manualSupplier !== undefined ? manualSupplier : currentRequest.manualSupplier,
            erpOrderNumber: erpOrderNumber !== undefined ? erpOrderNumber : currentRequest.erpOrderNumber,
            deliveredQuantity: deliveredQuantity !== undefined ? deliveredQuantity : currentRequest.deliveredQuantity,
            receivedInWarehouseBy: receivedInWarehouseBy !== undefined ? receivedInWarehouseBy : currentRequest.receivedInWarehouseBy,
            receivedDate: receivedDate,
            previousStatus: previousStatus
        });
        
        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(requestId, new Date().toISOString(), status, updatedBy, notes);
    });

    transaction();
    const updatedRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest;
    return updatedRequest;
}

export async function getRequestHistory(requestId: number): Promise<PurchaseRequestHistoryEntry[]> {
    const db = await connectDb(REQUESTS_DB_FILE);
    return db.prepare('SELECT * FROM purchase_request_history WHERE requestId = ? ORDER BY timestamp DESC').all(requestId) as PurchaseRequestHistoryEntry[];
}

export async function rejectCancellation(payload: RejectCancellationPayload): Promise<void> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { entityId: requestId, notes, updatedBy } = payload;

    const currentRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest | undefined;
    if (!currentRequest || currentRequest.status !== 'canceled') { // Assuming 'canceled' is the state to revert from
        throw new Error("La solicitud no está en un estado que se pueda revertir.");
    }

    const statusToRevertTo = currentRequest.previousStatus || 'approved'; 

    const transaction = db.transaction(() => {
        const stmt = db.prepare(`
            UPDATE purchase_requests SET
                status = @status,
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                previousStatus = NULL
            WHERE id = @requestId
        `);

        stmt.run({
            status: statusToRevertTo,
            notes: notes || null,
            updatedBy: updatedBy,
            requestId: requestId,
        });

        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(requestId, new Date().toISOString(), statusToRevertTo, updatedBy, notes);
    });

    transaction();
}
