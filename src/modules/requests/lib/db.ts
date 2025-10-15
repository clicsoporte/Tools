/**
 * @fileoverview Server-side functions for the purchase requests database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { PurchaseRequest, RequestSettings, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, UpdatePurchaseRequestPayload, RejectCancellationPayload, PurchaseRequestStatus, DateRange, AdministrativeAction, AdministrativeActionPayload } from '../../core/types';
import { format, parseISO } from 'date-fns';
import { executeQuery } from '@/modules/core/lib/sql-service';

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
            arrivalDate TEXT,
            receivedDate TEXT,
            clientId TEXT NOT NULL,
            clientName TEXT NOT NULL,
            clientTaxId TEXT,
            itemId TEXT NOT NULL,
            itemDescription TEXT NOT NULL,
            quantity REAL NOT NULL,
            deliveredQuantity REAL,
            inventory REAL,
            priority TEXT DEFAULT 'medium',
            purchaseType TEXT DEFAULT 'single',
            unitSalePrice REAL,
            erpOrderNumber TEXT,
            erpOrderLine INTEGER,
            manualSupplier TEXT,
            route TEXT,
            shippingMethod TEXT,
            status TEXT NOT NULL,
            pendingAction TEXT DEFAULT 'none',
            notes TEXT,
            requestedBy TEXT NOT NULL,
            approvedBy TEXT,
            receivedInWarehouseBy TEXT,
            lastStatusUpdateBy TEXT,
            lastStatusUpdateNotes TEXT,
            reopened BOOLEAN DEFAULT FALSE,
            previousStatus TEXT,
            lastModifiedBy TEXT,
            lastModifiedAt TEXT,
            hasBeenModified BOOLEAN DEFAULT FALSE
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

    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('requestPrefix', 'SC-')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('nextRequestNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('routes', '["Ruta GAM", "Fuera de GAM"]')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('shippingMethods', '["Mensajería", "Encomienda", "Transporte Propio"]')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('useWarehouseReception', 'false')`).run();
    db.prepare(`INSERT OR IGNORE INTO request_settings (key, value) VALUES ('showCustomerTaxId', 'true')`).run();
    
    console.log(`Database ${REQUESTS_DB_FILE} initialized for Purchase Requests.`);
    
    await runRequestMigrations(db);
}


export async function runRequestMigrations(db: import('better-sqlite3').Database) {
    const requestsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_requests'`).get();
    if (!requestsTable) {
        return;
    }

    const tableInfo = db.prepare(`PRAGMA table_info(purchase_requests)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));

    if (!columns.has('shippingMethod')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN shippingMethod TEXT`);
    if (!columns.has('deliveredQuantity')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN deliveredQuantity REAL;`);
    if (!columns.has('receivedInWarehouseBy')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN receivedInWarehouseBy TEXT;`);
    if (!columns.has('inventory')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN inventory REAL;`);
    if (!columns.has('priority')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN priority TEXT DEFAULT 'medium'`);
    if (!columns.has('receivedDate')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN receivedDate TEXT`);
    if (!columns.has('previousStatus')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN previousStatus TEXT`);
    if (!columns.has('purchaseType')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN purchaseType TEXT DEFAULT 'single'`);
    if (!columns.has('arrivalDate')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN arrivalDate TEXT`);
    if (!columns.has('purchaseOrder')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN purchaseOrder TEXT`);
    if (!columns.has('unitSalePrice')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN unitSalePrice REAL`);
    if (!columns.has('erpOrderNumber')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN erpOrderNumber TEXT`);
    if (!columns.has('erpOrderLine')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN erpOrderLine INTEGER`);
    if (!columns.has('manualSupplier')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN manualSupplier TEXT`);
    if (!columns.has('pendingAction')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN pendingAction TEXT DEFAULT 'none'`);
    if (!columns.has('lastModifiedBy')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN lastModifiedBy TEXT`);
    if (!columns.has('lastModifiedAt')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN lastModifiedAt TEXT`);
    if (!columns.has('hasBeenModified')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN hasBeenModified BOOLEAN DEFAULT FALSE`);
    if (!columns.has('clientTaxId')) db.exec(`ALTER TABLE purchase_requests ADD COLUMN clientTaxId TEXT`);
    
    const settingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='request_settings'`).get();
    if(settingsTable){
        if (!db.prepare(`SELECT key FROM request_settings WHERE key = 'requestPrefix'`).get()) {
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('requestPrefix', 'SC-')`).run();
        }
        if (!db.prepare(`SELECT key FROM request_settings WHERE key = 'nextRequestNumber'`).get()) {
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('nextRequestNumber', '1')`).run();
        }
        const pdfTopLegendRow = db.prepare(`SELECT value FROM request_settings WHERE key = 'pdfTopLegend'`).get() as { value: string } | undefined;
        if (!pdfTopLegendRow) {
            console.log("MIGRATION (requests.db): Adding pdfTopLegend to settings.");
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('pdfTopLegend', '')`).run();
        }
         const pdfExportColumnsRow = db.prepare(`SELECT value FROM request_settings WHERE key = 'pdfExportColumns'`).get() as { value: string } | undefined;
        if (!pdfExportColumnsRow) {
            console.log("MIGRATION (requests.db): Adding pdfExportColumns to settings.");
            const defaultColumns = ['consecutive', 'itemDescription', 'quantity', 'clientName', 'requiredDate', 'status'];
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('pdfExportColumns', ?)`).run(JSON.stringify(defaultColumns));
        }
        const pdfPaperSizeRow = db.prepare(`SELECT value FROM request_settings WHERE key = 'pdfPaperSize'`).get() as { value: string } | undefined;
        if (!pdfPaperSizeRow) {
            console.log("MIGRATION (requests.db): Adding pdfPaperSize and pdfOrientation to settings.");
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('pdfPaperSize', 'letter')`).run();
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('pdfOrientation', 'portrait')`).run();
        }
        if (!db.prepare(`SELECT key FROM request_settings WHERE key = 'showCustomerTaxId'`).get()) {
            console.log("MIGRATION (requests.db): Adding showCustomerTaxId to settings.");
            db.prepare(`INSERT INTO request_settings (key, value) VALUES ('showCustomerTaxId', 'true')`).run();
        }
    }
}


export async function getSettings(): Promise<RequestSettings> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const settingsRows = db.prepare('SELECT * FROM request_settings').all() as { key: string; value: string }[];
    
    const settings: RequestSettings = {
        requestPrefix: 'SC-',
        nextRequestNumber: 1,
        showCustomerTaxId: true,
        routes: [],
        shippingMethods: [],
        useWarehouseReception: false,
        pdfTopLegend: '',
        pdfExportColumns: [],
        pdfPaperSize: 'letter',
        pdfOrientation: 'portrait',
    };

    for (const row of settingsRows) {
        if (row.key === 'nextRequestNumber') settings.nextRequestNumber = Number(row.value);
        else if (row.key === 'requestPrefix') settings.requestPrefix = row.value;
        else if (row.key === 'routes') settings.routes = JSON.parse(row.value);
        else if (row.key === 'shippingMethods') settings.shippingMethods = JSON.parse(row.value);
        else if (row.key === 'useWarehouseReception') settings.useWarehouseReception = row.value === 'true';
        else if (row.key === 'showCustomerTaxId') settings.showCustomerTaxId = row.value === 'true';
        else if (row.key === 'pdfTopLegend') settings.pdfTopLegend = row.value;
        else if (row.key === 'pdfExportColumns') settings.pdfExportColumns = JSON.parse(row.value);
        else if (row.key === 'pdfPaperSize') settings.pdfPaperSize = row.value as 'letter' | 'legal';
        else if (row.key === 'pdfOrientation') settings.pdfOrientation = row.value as 'portrait' | 'landscape';
    }
    return settings;
}

export async function saveSettings(settings: RequestSettings): Promise<void> {
    const db = await connectDb(REQUESTS_DB_FILE);
    
    const transaction = db.transaction((settingsToUpdate) => {
        const keys: (keyof RequestSettings)[] = ['requestPrefix', 'nextRequestNumber', 'routes', 'shippingMethods', 'useWarehouseReception', 'showCustomerTaxId', 'pdfTopLegend', 'pdfExportColumns', 'pdfPaperSize', 'pdfOrientation'];
        for (const key of keys) {
             if (settingsToUpdate[key] !== undefined) {
                const value = typeof settingsToUpdate[key] === 'object' ? JSON.stringify(settingsToUpdate[key]) : String(settingsToUpdate[key]);
                db.prepare('INSERT OR REPLACE INTO request_settings (key, value) VALUES (?, ?)').run(key, value);
            }
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

        const whereClauses: string[] = [];
        const params: any[] = [];
        
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
    const prefix = settings.requestPrefix || 'SC-';

    const newRequest: Omit<PurchaseRequest, 'id'> = {
        ...request,
        requestedBy: requestedBy,
        consecutive: `${prefix}${nextNumber.toString().padStart(5, '0')}`,
        requestDate: new Date().toISOString(),
        status: 'pending',
        reopened: false,
    };

    const stmt = db.prepare(`
        INSERT INTO purchase_requests (
            consecutive, requestDate, requiredDate, clientId, clientName, clientTaxId,
            itemId, itemDescription, quantity, unitSalePrice, erpOrderNumber, erpOrderLine, manualSupplier, route, shippingMethod, purchaseOrder,
            status, pendingAction, notes, requestedBy, reopened, inventory, priority, purchaseType, arrivalDate
        ) VALUES (
            @consecutive, @requestDate, @requiredDate, @clientId, @clientName, @clientTaxId,
            @itemId, @itemDescription, @quantity, @unitSalePrice, @erpOrderNumber, @erpOrderLine, @manualSupplier, @route, @shippingMethod, @purchaseOrder,
            @status, @pendingAction, @notes, @requestedBy, @reopened, @inventory, @priority, @purchaseType, @arrivalDate
        )
    `);

    const preparedRequest = {
        ...newRequest,
        unitSalePrice: newRequest.unitSalePrice ?? null,
        erpOrderNumber: newRequest.erpOrderNumber || null,
        erpOrderLine: newRequest.erpOrderLine || null,
        manualSupplier: newRequest.manualSupplier || null,
        route: newRequest.route || null,
        shippingMethod: newRequest.shippingMethod || null,
        purchaseOrder: newRequest.purchaseOrder || null,
        notes: newRequest.notes || null,
        inventory: newRequest.inventory ?? null,
        reopened: newRequest.reopened ? 1 : 0,
        purchaseType: newRequest.purchaseType || 'single',
        arrivalDate: newRequest.arrivalDate || null,
        clientTaxId: newRequest.clientTaxId || null,
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
    
    let hasBeenModified = currentRequest.hasBeenModified;
    if (['approved', 'ordered'].includes(currentRequest.status)) {
        hasBeenModified = true;
    }

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE purchase_requests SET
                requiredDate = @requiredDate,
                clientId = @clientId,
                clientName = @clientName,
                clientTaxId = @clientTaxId,
                itemId = @itemId,
                itemDescription = @itemDescription,
                quantity = @quantity,
                unitSalePrice = @unitSalePrice,
                erpOrderNumber = @erpOrderNumber,
                erpOrderLine = @erpOrderLine,
                manualSupplier = @manualSupplier,
                route = @route,
                shippingMethod = @shippingMethod,
                purchaseOrder = @purchaseOrder,
                notes = @notes,
                inventory = @inventory,
                priority = @priority,
                purchaseType = @purchaseType,
                arrivalDate = @arrivalDate,
                lastModifiedBy = @updatedBy,
                lastModifiedAt = @lastModifiedAt,
                hasBeenModified = @hasBeenModified
            WHERE id = @requestId
        `).run({ 
            requestId, 
            ...dataToUpdate,
            updatedBy,
            lastModifiedAt: new Date().toISOString(),
            hasBeenModified: hasBeenModified ? 1 : 0
        });

        if (hasBeenModified) {
            const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
            historyStmt.run(requestId, new Date().toISOString(), currentRequest.status, updatedBy, 'Solicitud editada después de aprobación.');
        }
    });

    transaction();
    const updatedRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest;
    return updatedRequest;
}

export async function updateStatus(payload: UpdateRequestStatusPayload): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { requestId, status, notes, updatedBy, reopen, manualSupplier, erpOrderNumber, deliveredQuantity, arrivalDate } = payload;

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
    } else if (status === 'approved' && currentRequest.status === 'ordered') {
        // Allow reverting from ordered to approved
    } else {
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
                arrivalDate = @arrivalDate,
                previousStatus = @previousStatus,
                pendingAction = 'none'
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
            arrivalDate: arrivalDate !== undefined ? arrivalDate : currentRequest.arrivalDate,
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

export async function rejectCancellation(payload: RejectCancellationPayload): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { entityId: requestId, notes, updatedBy } = payload;

    const currentRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest | undefined;
    if (!currentRequest) {
        throw new Error("La solicitud no fue encontrada.");
    }
    
    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE purchase_requests SET
                pendingAction = 'none',
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                previousStatus = NULL
            WHERE id = @requestId
        `).run({
            notes,
            updatedBy,
            requestId,
        });

        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(requestId, new Date().toISOString(), currentRequest.status, updatedBy, `Rechazada solicitud de cancelación: ${notes}`);
    });

    transaction();
    return db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId) as PurchaseRequest;
}

export async function updatePendingAction(payload: AdministrativeActionPayload): Promise<PurchaseRequest> {
    const db = await connectDb(REQUESTS_DB_FILE);
    const { entityId, action, notes, updatedBy } = payload;

    const currentRequest = db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(entityId) as PurchaseRequest | undefined;
    if (!currentRequest) throw new Error("Request not found.");

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE purchase_requests SET
                pendingAction = @action,
                previousStatus = CASE WHEN @action != 'none' THEN status ELSE previousStatus END
            WHERE id = @entityId
        `).run({ action, entityId });
        
        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        const historyNote = action === 'none' 
            ? 'Acción administrativa rechazada/cancelada' 
            : `Solicitud de ${action === 'unapproval-request' ? 'desaprobación' : 'cancelación'} iniciada`;
        historyStmt.run(entityId, new Date().toISOString(), currentRequest.status, updatedBy, `${historyNote}: ${notes}`);
    });
    
    transaction();
    return db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(entityId) as PurchaseRequest;
}

export async function getErpOrderData(orderNumber: string): Promise<{header: any, lines: any[]}> {
    const db = await connectDb();
    
    const headerQueryRow = db.prepare('SELECT query FROM import_queries WHERE type = ?').get('erp_order_headers') as { query: string } | undefined;
    if (!headerQueryRow || !headerQueryRow.query) {
        throw new Error(`No hay una consulta SQL configurada para importar erp_order_headers.`);
    }

    const linesQueryRow = db.prepare('SELECT query FROM import_queries WHERE type = ?').get('erp_order_lines') as { query: string } | undefined;
     if (!linesQueryRow || !linesQueryRow.query) {
        throw new Error(`No hay una consulta SQL configurada para importar erp_order_lines.`);
    }

    const buildQuery = (baseQuery: string, value: string) => {
        if (baseQuery.includes('?')) {
            // Placeholder exists, assume it's for the WHERE clause value
            return baseQuery.replace('?', `'${value}'`);
        } else {
            // No placeholder, so we append the WHERE clause.
            const condition = `[PEDIDO] = '${value}'`;
            if (baseQuery.toLowerCase().includes('where')) {
                return `${baseQuery} AND ${condition}`;
            } else {
                return `${baseQuery} WHERE ${condition}`;
            }
        }
    };

    const headerQuery = buildQuery(headerQueryRow.query, orderNumber);
    const linesQuery = buildQuery(linesQueryRow.query, orderNumber);

    const [headerResult, linesResult] = await Promise.all([
        executeQuery(headerQuery),
        executeQuery(linesQuery)
    ]);
    
    if (headerResult.length === 0) {
        throw new Error(`No se encontró el pedido ERP con el número: ${orderNumber}`);
    }

    return { header: headerResult[0], lines: linesResult };
}


    
