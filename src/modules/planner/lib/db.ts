/**
 * @fileoverview Server-side functions for the planner database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { ProductionOrder, PlannerSettings, UpdateStatusPayload, UpdateOrderDetailsPayload, ProductionOrderHistoryEntry, RejectCancellationPayload, ProductionOrderStatus, Warehouse, UpdateProductionOrderPayload, CustomStatus } from '../../core/types';
import { format, parseISO } from 'date-fns';

const PLANNER_DB_FILE = 'planner.db';

export async function initializePlannerDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS planner_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS production_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            purchaseOrder TEXT,
            requestDate TEXT NOT NULL,
            deliveryDate TEXT NOT NULL,
            scheduledStartDate TEXT,
            scheduledEndDate TEXT,
            customerId TEXT NOT NULL,
            customerName TEXT NOT NULL,
            productId TEXT NOT NULL,
            productDescription TEXT NOT NULL,
            quantity REAL NOT NULL,
            inventory REAL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            requestedBy TEXT NOT NULL,
            approvedBy TEXT,
            lastStatusUpdateBy TEXT,
            lastStatusUpdateNotes TEXT,
            deliveredQuantity REAL,
            erpPackageNumber TEXT,
            erpTicketNumber TEXT,
            reopened BOOLEAN DEFAULT FALSE,
            machineId TEXT,
            previousStatus TEXT
        );
         CREATE TABLE IF NOT EXISTS production_order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (orderId) REFERENCES production_orders(id)
        );
    `;
    db.exec(schema);

    const defaultCustomStatuses: CustomStatus[] = [
        { id: 'custom-1', label: '', color: '#8884d8', isActive: false },
        { id: 'custom-2', label: '', color: '#82ca9d', isActive: false },
        { id: 'custom-3', label: '', color: '#ffc658', isActive: false },
        { id: 'custom-4', label: '', color: '#ff8042', isActive: false },
    ];

    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('nextOrderNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('useWarehouseReception', 'false')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('machines', '[]')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('requireMachineForStart', 'false')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('assignmentLabel', 'Máquina Asignada')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('customStatuses', ?)`).run(JSON.stringify(defaultCustomStatuses));
    console.log(`Database ${PLANNER_DB_FILE} initialized for Production Planner.`);
}

export async function runPlannerMigrations(db: import('better-sqlite3').Database) {
    const plannerTableInfo = db.prepare(`PRAGMA table_info(production_orders)`).all() as { name: string }[];
    const plannerColumns = new Set(plannerTableInfo.map(c => c.name));
    
    if (!plannerColumns.has('deliveredQuantity')) {
        console.log("MIGRATION (planner.db): Adding deliveredQuantity column to production_orders.");
        db.exec(`ALTER TABLE production_orders ADD COLUMN deliveredQuantity REAL`);
    }
    if (!plannerColumns.has('purchaseOrder')) {
        console.log("MIGRATION (planner.db): Adding purchaseOrder column to production_orders.");
        db.exec(`ALTER TABLE production_orders ADD COLUMN purchaseOrder TEXT`);
    }
    if (!plannerColumns.has('scheduledStartDate')) {
        console.log("MIGRATION (planner.db): Adding scheduledStartDate column to production_orders.");
        db.exec(`ALTER TABLE production_orders ADD COLUMN scheduledStartDate TEXT`);
    }
    if (!plannerColumns.has('scheduledEndDate')) {
        console.log("MIGRATION (planner.db): Adding scheduledEndDate column to production_orders.");
        db.exec(`ALTER TABLE production_orders ADD COLUMN scheduledEndDate TEXT`);
    }

    const historyTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='production_order_history'`).get();
    if (!historyTable) {
         console.log("MIGRATION (planner.db): Creating production_order_history table.");
         db.exec(`
            CREATE TABLE production_order_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderId INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                updatedBy TEXT NOT NULL,
                FOREIGN KEY (orderId) REFERENCES production_orders(id)
            );
         `);
    }

    // Migration for custom statuses
    const customStatusesRow = db.prepare(`SELECT value FROM planner_settings WHERE key = 'customStatuses'`).get() as { value: string } | undefined;
    if (!customStatusesRow) {
        console.log("MIGRATION (planner.db): Adding customStatuses to settings.");
         const defaultCustomStatuses: CustomStatus[] = [
            { id: 'custom-1', label: '', color: '#8884d8', isActive: false },
            { id: 'custom-2', label: '', color: '#82ca9d', isActive: false },
            { id: 'custom-3', label: '', color: '#ffc658', isActive: false },
            { id: 'custom-4', label: '', color: '#ff8042', isActive: false },
        ];
        db.prepare(`INSERT INTO planner_settings (key, value) VALUES ('customStatuses', ?)`).run(JSON.stringify(defaultCustomStatuses));
    }
}


export async function getSettings(): Promise<PlannerSettings> {
    const db = await connectDb(PLANNER_DB_FILE);
    const settingsRows = db.prepare('SELECT * FROM planner_settings').all() as { key: string; value: string }[];
    
    const settings: PlannerSettings = {
        nextOrderNumber: 1,
        useWarehouseReception: false,
        machines: [],
        requireMachineForStart: false,
        assignmentLabel: 'Máquina Asignada',
        customStatuses: [],
    };

    for (const row of settingsRows) {
        if (row.key === 'nextOrderNumber') {
            settings.nextOrderNumber = Number(row.value);
        } else if (row.key === 'useWarehouseReception') {
            settings.useWarehouseReception = row.value === 'true';
        } else if (row.key === 'machines') {
            try {
                settings.machines = JSON.parse(row.value);
            } catch {
                settings.machines = [];
            }
        } else if (row.key === 'requireMachineForStart') {
            settings.requireMachineForStart = row.value === 'true';
        } else if (row.key === 'assignmentLabel') {
            settings.assignmentLabel = row.value;
        } else if (row.key === 'customStatuses') {
            try {
                settings.customStatuses = JSON.parse(row.value);
            } catch {
                settings.customStatuses = [];
            }
        }
    }
    return settings;
}

export async function saveSettings(settings: PlannerSettings): Promise<void> {
    const db = await connectDb(PLANNER_DB_FILE);
    
    const transaction = db.transaction((settingsToUpdate) => {
        if (settingsToUpdate.nextOrderNumber !== undefined) {
            db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('nextOrderNumber', settingsToUpdate.nextOrderNumber.toString());
        }
        if (settingsToUpdate.useWarehouseReception !== undefined) {
            db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('useWarehouseReception', settingsToUpdate.useWarehouseReception.toString());
        }
        if (settingsToUpdate.machines !== undefined) {
            db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('machines', JSON.stringify(settingsToUpdate.machines));
        }
        if (settingsToUpdate.requireMachineForStart !== undefined) {
             db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('requireMachineForStart', settingsToUpdate.requireMachineForStart.toString());
        }
        if (settingsToUpdate.assignmentLabel !== undefined) {
            db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('assignmentLabel', settingsToUpdate.assignmentLabel);
        }
        if (settingsToUpdate.customStatuses !== undefined) {
            db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run('customStatuses', JSON.stringify(settingsToUpdate.customStatuses));
        }
    });

    transaction(settings);
}

export async function getOrders(): Promise<ProductionOrder[]> {
    const db = await connectDb(PLANNER_DB_FILE);
    return db.prepare('SELECT * FROM production_orders ORDER BY requestDate DESC').all() as ProductionOrder[];
}

export async function addOrder(order: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'machineId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate' | 'requestedBy'>, requestedBy: string): Promise<ProductionOrder> {
    const db = await connectDb(PLANNER_DB_FILE);
    
    const settings = await getSettings();
    const nextNumber = settings.nextOrderNumber || 1;

    const newOrder: Omit<ProductionOrder, 'id'> = {
        ...order,
        requestedBy: requestedBy,
        consecutive: `OP-${nextNumber.toString().padStart(5, '0')}`,
        requestDate: new Date().toISOString(),
        status: 'pending',
        reopened: false,
        machineId: null,
        previousStatus: null,
        scheduledStartDate: null,
        scheduledEndDate: null,
    };

    const stmt = db.prepare(`
        INSERT INTO production_orders (
            consecutive, purchaseOrder, requestDate, deliveryDate, customerId, customerName,
            productId, productDescription, quantity, inventory, priority,
            status, notes, requestedBy, reopened, machineId, previousStatus, scheduledStartDate, scheduledEndDate
        ) VALUES (
            @consecutive, @purchaseOrder, @requestDate, @deliveryDate, @customerId, @customerName,
            @productId, @productDescription, @quantity, @inventory, @priority,
            @status, @notes, @requestedBy, @reopened, @machineId, @previousStatus, @scheduledStartDate, @scheduledEndDate
        )
    `);

    const preparedOrder = {
        ...newOrder,
        purchaseOrder: newOrder.purchaseOrder || null,
        inventory: newOrder.inventory ?? null,
        notes: newOrder.notes || null,
        reopened: newOrder.reopened ? 1 : 0
    };

    const info = stmt.run(preparedOrder);
    const newOrderId = info.lastInsertRowid as number;

    await saveSettings({ ...settings, nextOrderNumber: nextNumber + 1 });
    
    const historyStmt = db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
    historyStmt.run(newOrderId, new Date().toISOString(), 'pending', newOrder.requestedBy, 'Orden creada');

    const createdOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(newOrderId) as ProductionOrder;
    return createdOrder;
}

export async function updateOrder(payload: UpdateProductionOrderPayload): Promise<ProductionOrder> {
    const db = await connectDb(PLANNER_DB_FILE);
    const { orderId, updatedBy, ...dataToUpdate } = payload;
    
    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) {
        throw new Error("Order not found.");
    }

    const changes: string[] = [];
    if (Number(currentOrder.quantity) !== Number(dataToUpdate.quantity)) {
        changes.push(`Cantidad: de ${currentOrder.quantity} a ${dataToUpdate.quantity}.`);
    }
    if ((currentOrder.purchaseOrder || '') !== (dataToUpdate.purchaseOrder || '')) {
        changes.push(`Nº OC: de '${currentOrder.purchaseOrder || 'N/A'}' a '${dataToUpdate.purchaseOrder || 'N/A'}'.`);
    }
    if (currentOrder.deliveryDate !== dataToUpdate.deliveryDate) {
        changes.push(`Fecha Entrega: de ${format(parseISO(currentOrder.deliveryDate), 'dd/MM/yy')} a ${format(parseISO(dataToUpdate.deliveryDate), 'dd/MM/yy')}.`);
    }
     if ((currentOrder.notes || '') !== (dataToUpdate.notes || '')) {
        changes.push(`Notas actualizadas.`);
    }

    if (changes.length > 0) {
        const historyNotes = `Orden editada. ${changes.join(' ')}`;

        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE production_orders SET
                    deliveryDate = @deliveryDate,
                    customerId = @customerId,
                    customerName = @customerName,
                    productId = @productId,
                    productDescription = @productDescription,
                    quantity = @quantity,
                    inventory = @inventory,
                    notes = @notes,
                    purchaseOrder = @purchaseOrder
                WHERE id = @orderId
            `).run({ orderId, ...dataToUpdate });

            const historyStmt = db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
            historyStmt.run(orderId, new Date().toISOString(), currentOrder.status, updatedBy, historyNotes);
        });

        transaction();
    }
    
    const updatedOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
    return updatedOrder;
}

export async function updateStatus(payload: UpdateStatusPayload): Promise<ProductionOrder> {
    const db = await connectDb(PLANNER_DB_FILE);
    const { orderId, status, notes, updatedBy, deliveredQuantity, erpPackageNumber, erpTicketNumber, reopen } = payload;

    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) {
        throw new Error("Order not found.");
    }
    
    let approvedBy = currentOrder.approvedBy;
    if (status === 'approved' && !currentOrder.approvedBy) {
        approvedBy = updatedBy;
    }
    
    let previousStatus = currentOrder.previousStatus;
    if (status === 'cancellation-request' && currentOrder.status !== 'cancellation-request') {
        previousStatus = currentOrder.status;
    } else if (status !== 'cancellation-request') {
        previousStatus = null; // Clear previous status if we are moving out of cancellation request
    }

    const transaction = db.transaction(() => {
        const stmt = db.prepare(`
            UPDATE production_orders SET
                status = @status,
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                approvedBy = @approvedBy,
                deliveredQuantity = @deliveredQuantity,
                erpPackageNumber = @erpPackageNumber,
                erpTicketNumber = @erpTicketNumber,
                reopened = @reopened,
                previousStatus = @previousStatus
            WHERE id = @orderId
        `);

        stmt.run({
            status,
            notes: notes || null,
            updatedBy,
            approvedBy,
            orderId,
            deliveredQuantity: deliveredQuantity !== undefined ? deliveredQuantity : currentOrder.deliveredQuantity,
            erpPackageNumber: erpPackageNumber !== undefined ? erpPackageNumber : currentOrder.erpPackageNumber,
            erpTicketNumber: erpTicketNumber !== undefined ? erpTicketNumber : currentOrder.erpTicketNumber,
            reopened: reopen ? 1 : (currentOrder.reopened ? 1 : 0),
            previousStatus: previousStatus
        });
        
        const historyStmt = db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(orderId, new Date().toISOString(), status, updatedBy, notes);
    });

    transaction();
    const updatedOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
    return updatedOrder;
}

export async function updateDetails(payload: UpdateOrderDetailsPayload): Promise<ProductionOrder> {
    const db = await connectDb(PLANNER_DB_FILE);
    const { orderId, priority, machineId, scheduledDateRange, updatedBy } = payload;
    
    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) throw new Error("Order not found.");

    let query = 'UPDATE production_orders SET';
    const params: any = { orderId };
    const updates: string[] = [];
    const historyItems: string[] = [];

    if (priority && currentOrder.priority !== priority) {
        updates.push('priority = @priority');
        params.priority = priority;
        historyItems.push(`Prioridad: de ${currentOrder.priority} a ${priority}`);
    }
    if (machineId !== undefined && currentOrder.machineId !== machineId) {
        const settings = await getSettings();
        const oldMachineName = currentOrder.machineId ? settings.machines.find(m => m.id === currentOrder.machineId)?.name : 'N/A';
        const newMachineName = machineId ? settings.machines.find(m => m.id === machineId)?.name : 'N/A';
        updates.push('machineId = @machineId');
        params.machineId = machineId;
        historyItems.push(`${settings.assignmentLabel || 'Máquina'}: de ${oldMachineName} a ${newMachineName}`);
    }
     if (scheduledDateRange) {
        const newStartDate = scheduledDateRange.from ? scheduledDateRange.from.toISOString().split('T')[0] : null;
        const newEndDate = scheduledDateRange.to ? scheduledDateRange.to.toISOString().split('T')[0] : null;
        if (currentOrder.scheduledStartDate !== newStartDate || currentOrder.scheduledEndDate !== newEndDate) {
            updates.push('scheduledStartDate = @scheduledStartDate', 'scheduledEndDate = @scheduledEndDate');
            params.scheduledStartDate = newStartDate;
            params.scheduledEndDate = newEndDate;
            
            const oldStart = currentOrder.scheduledStartDate ? format(parseISO(currentOrder.scheduledStartDate), 'dd/MM/yy') : 'N/A';
            const oldEnd = currentOrder.scheduledEndDate ? format(parseISO(currentOrder.scheduledEndDate), 'dd/MM/yy') : 'N/A';
            const newStart = newStartDate ? format(parseISO(newStartDate), 'dd/MM/yy') : 'N/A';
            const newEnd = newEndDate ? format(parseISO(newEndDate), 'dd/MM/yy') : 'N/A';
            historyItems.push(`Fecha Prog.: de ${oldStart}-${oldEnd} a ${newStart}-${newEnd}`);
        }
    }
    
    if (updates.length === 0) {
        const orderWithoutChanges = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
        return orderWithoutChanges;
    };

    query += ` ${updates.join(', ')} WHERE id = @orderId`;
    const historyNotes = `Detalles actualizados: ${historyItems.join('. ')}`;
    
    const transaction = db.transaction(() => {
        db.prepare(query).run(params);
        
        const historyStmt = db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        const currentStatus = (db.prepare('SELECT status FROM production_orders WHERE id = ?').get(orderId) as { status: string }).status;
        historyStmt.run(orderId, new Date().toISOString(), currentStatus, updatedBy, historyNotes);
    });

    transaction();
    const updatedOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
    return updatedOrder;
}


export async function getOrderHistory(orderId: number): Promise<ProductionOrderHistoryEntry[]> {
    const db = await connectDb(PLANNER_DB_FILE);
    return db.prepare('SELECT * FROM production_order_history WHERE orderId = ? ORDER BY timestamp DESC').all(orderId) as ProductionOrderHistoryEntry[];
}


export async function rejectCancellation(payload: RejectCancellationPayload): Promise<void> {
    const db = await connectDb(PLANNER_DB_FILE);
    const { orderId, notes, updatedBy } = payload;

    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder || currentOrder.status !== 'cancellation-request') {
        throw new Error("La orden no está en estado de solicitud de cancelación.");
    }

    const statusToRevertTo = currentOrder.previousStatus || 'approved'; 

    const transaction = db.transaction(() => {
        const stmt = db.prepare(`
            UPDATE production_orders SET
                status = @status,
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                previousStatus = NULL
            WHERE id = @orderId
        `);

        stmt.run({
            status: statusToRevertTo,
            notes: notes || null,
            updatedBy: updatedBy,
            orderId: orderId,
        });

        const historyStmt = db.prepare('INSERT INTO purchase_request_history (requestId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)');
        historyStmt.run(orderId, new Date().toISOString(), statusToRevertTo, updatedBy, notes);
    });

    transaction();
}
