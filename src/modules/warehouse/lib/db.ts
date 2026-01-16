/**
 * @fileoverview Server-side functions for the warehouse database.
 */
"use server";

import { connectDb, getAllStock as getAllStockFromMain, getStockSettings as getStockSettingsFromMain } from '@/modules/core/lib/db';
import type { WarehouseLocation, WarehouseInventoryItem, MovementLog, WarehouseSettings, StockSettings, StockInfo, ItemLocation, InventoryUnit, DateRange, User } from '@/modules/core/types';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';
import path from 'path';

const WAREHOUSE_DB_FILE = 'warehouse.db';

// This function is automatically called when the database is first created.
export async function initializeWarehouseDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL, -- 'building', 'zone', 'rack', 'shelf', 'bin'
            parentId INTEGER,
            isLocked INTEGER DEFAULT 0,
            lockedBy TEXT,
            lockedBySessionId TEXT,
            FOREIGN KEY (parentId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL, -- Corresponds to Product['id'] from main DB
            locationId INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            lastUpdated TEXT NOT NULL,
            updatedBy TEXT,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId)
        );

         CREATE TABLE IF NOT EXISTS item_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL,
            locationId INTEGER NOT NULL,
            clientId TEXT,
            isExclusive INTEGER DEFAULT 0,
            requiresCertificate INTEGER DEFAULT 0,
            updatedBy TEXT,
            updatedAt TEXT,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId, clientId)
        );

        CREATE TABLE IF NOT EXISTS inventory_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unitCode TEXT UNIQUE,
            productId TEXT NOT NULL,
            humanReadableId TEXT,
            documentId TEXT,
            erpDocumentId TEXT,
            locationId INTEGER,
            quantity REAL DEFAULT 1,
            notes TEXT,
            createdAt TEXT NOT NULL,
            createdBy TEXT NOT NULL,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL,
            quantity REAL NOT NULL,
            fromLocationId INTEGER,
            toLocationId INTEGER,
            timestamp TEXT NOT NULL,
            userId INTEGER NOT NULL,
            notes TEXT,
            FOREIGN KEY (fromLocationId) REFERENCES locations(id) ON DELETE CASCADE,
            FOREIGN KEY (toLocationId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS warehouse_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);

    // Insert default settings
    const defaultSettings: Partial<WarehouseSettings> = {
        locationLevels: [
            { type: 'building', name: 'Edificio' },
            { type: 'zone', name: 'Zona' },
            { type: 'rack', name: 'Rack' },
            { type: 'shelf', name: 'Estante' },
            { type: 'bin', name: 'Casilla' }
        ],
        unitPrefix: 'U',
        nextUnitNumber: 1,
    };
    db.prepare(`
        INSERT OR IGNORE INTO warehouse_config (key, value) VALUES ('settings', ?)
    `).run(JSON.stringify(defaultSettings));
    
    console.log(`Database ${WAREHOUSE_DB_FILE} initialized for Warehouse Management.`);
    await runWarehouseMigrations(db);
};

export async function runWarehouseMigrations(db: import('better-sqlite3').Database) {
    try {
        // The problematic foreign key checks that were causing table rewrites have been removed.
        // The application logic for deletions now manually handles dependencies,
        // making this aggressive migration unnecessary and resolving the IIS reload issue.

        const inventoryTableInfo = db.prepare(`PRAGMA table_info(inventory)`).all() as { name: string }[];
        if (inventoryTableInfo.length > 0 && !inventoryTableInfo.some(c => c.name === 'updatedBy')) {
            db.exec('ALTER TABLE inventory ADD COLUMN updatedBy TEXT');
        }

        const itemLocationsTableInfo = db.prepare(`PRAGMA table_info(item_locations)`).all() as { name: string }[];
        if (itemLocationsTableInfo.length > 0) {
            if (!itemLocationsTableInfo.some(c => c.name === 'updatedBy')) db.exec('ALTER TABLE item_locations ADD COLUMN updatedBy TEXT');
            if (!itemLocationsTableInfo.some(c => c.name === 'updatedAt')) db.exec('ALTER TABLE item_locations ADD COLUMN updatedAt TEXT');
            if (!itemLocationsTableInfo.some(c => c.name === 'isExclusive')) db.exec('ALTER TABLE item_locations ADD COLUMN isExclusive INTEGER DEFAULT 0');
            if (!itemLocationsTableInfo.some(c => c.name === 'requiresCertificate')) db.exec('ALTER TABLE item_locations ADD COLUMN requiresCertificate INTEGER DEFAULT 0');
        }
        
        const locationsTableInfo = db.prepare(`PRAGMA table_info(locations)`).all() as { name: string }[];
        if (locationsTableInfo.length > 0) {
            if (!locationsTableInfo.some(c => c.name === 'isLocked')) db.exec('ALTER TABLE locations ADD COLUMN isLocked INTEGER DEFAULT 0');
            if (!locationsTableInfo.some(c => c.name === 'lockedBy')) db.exec('ALTER TABLE locations ADD COLUMN lockedBy TEXT');
            if (!locationsTableInfo.some(c => c.name === 'lockedBySessionId')) db.exec('ALTER TABLE locations ADD COLUMN lockedBySessionId TEXT');
        }
        
        const unitsTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_units'`).get();
        if (!unitsTableExists) {
            db.exec(`CREATE TABLE inventory_units (id INTEGER PRIMARY KEY AUTOINCREMENT, unitCode TEXT UNIQUE, productId TEXT NOT NULL, humanReadableId TEXT, documentId TEXT, erpDocumentId TEXT, locationId INTEGER, quantity REAL DEFAULT 1, notes TEXT, createdAt TEXT NOT NULL, createdBy TEXT NOT NULL, FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE);`);
        } else {
            const unitsTableInfo = db.prepare(`PRAGMA table_info(inventory_units)`).all() as { name: string }[];
            if (!unitsTableInfo.some(c => c.name === 'documentId')) db.exec('ALTER TABLE inventory_units ADD COLUMN documentId TEXT');
            if (!unitsTableInfo.some(c => c.name === 'quantity')) db.exec('ALTER TABLE inventory_units ADD COLUMN quantity REAL DEFAULT 1');
            if (!unitsTableInfo.some(c => c.name === 'erpDocumentId')) db.exec('ALTER TABLE inventory_units ADD COLUMN erpDocumentId TEXT');
        }

        const configTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='warehouse_config'`).get();
        if (configTable) {
             const settingsRow = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string } | undefined;
             if (settingsRow) {
                 const settings = JSON.parse(settingsRow.value);
                 if (settings.dispatchNotificationEmails === undefined) {
                     settings.dispatchNotificationEmails = '';
                     db.prepare(`UPDATE warehouse_config SET value = ? WHERE key = 'settings'`).run(JSON.stringify(settings));
                 }
             }
        }

    } catch (error) {
        console.error("Error during warehouse migrations:", error);
        logError("Error during warehouse migrations", { error: (error as Error).message });
    }
}


export async function getWarehouseSettings(): Promise<WarehouseSettings> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const defaults: WarehouseSettings = {
        locationLevels: [
            { type: 'building', name: 'Edificio' },
            { type: 'zone', name: 'Zona' },
            { type: 'rack', name: 'Rack' },
            { type: 'shelf', name: 'Estante' },
            { type: 'bin', name: 'Casilla' }
        ],
        unitPrefix: 'U',
        nextUnitNumber: 1,
        dispatchNotificationEmails: '',
    };
    try {
        const row = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string } | undefined;
        if (row) {
            const settings = JSON.parse(row.value);
            return { ...defaults, ...settings };
        }
    } catch (error) {
        console.error("Error fetching warehouse settings, returning default.", error);
    }
    return defaults;
}

export async function saveWarehouseSettings(settings: WarehouseSettings): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare(`
        INSERT OR REPLACE INTO warehouse_config (key, value) VALUES ('settings', ?)
    `).run(JSON.stringify(settings));
}

// Helper function to recursively find all final child nodes (bins) of a location.
function getAllFinalChildren(locationId: number, allLocations: WarehouseLocation[]): number[] {
    let finalChildren: number[] = [];
    const queue: number[] = [locationId];
    const visited = new Set<number>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const children = allLocations.filter(l => l.parentId === currentId);
        if (children.length === 0) {
            finalChildren.push(currentId);
        } else {
            queue.push(...children.map(c => c.id));
        }
    }
    return finalChildren;
}


/**
 * Gets all locations and enriches them with completion status for wizard.
 * @returns {Promise<WarehouseLocation[]>} A promise that resolves to an array of all locations.
 */
export async function getLocations(): Promise<(WarehouseLocation & { isCompleted?: boolean })[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const allLocations = db.prepare('SELECT * FROM locations ORDER BY parentId, name').all() as WarehouseLocation[];
    const allItemLocations = db.prepare('SELECT locationId FROM item_locations').all() as { locationId: number }[];
    const populatedLocationIds = new Set(allItemLocations.map(il => il.locationId));

    const enrichedLocations = allLocations.map(loc => {
        // Check if a location is a 'level' (has children)
        const children = allLocations.filter(l => l.parentId === loc.id);
        if (children.length > 0) {
            // It's a parent, let's see if all its final children are populated
            const finalChildren = getAllFinalChildren(loc.id, allLocations);
            const isCompleted = finalChildren.length > 0 && finalChildren.every(childId => populatedLocationIds.has(childId));
            return { ...loc, isCompleted };
        }
        return loc;
    });

    return JSON.parse(JSON.stringify(enrichedLocations));
}

export async function getSelectableLocations(): Promise<WarehouseLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const allLocations = db.prepare('SELECT * FROM locations').all() as WarehouseLocation[];
    const parentIds = new Set(allLocations.map(l => l.parentId).filter(Boolean));
    const selectable = allLocations.filter(l => !parentIds.has(l.id));
    return JSON.parse(JSON.stringify(selectable));
}

export async function addLocation(location: Omit<WarehouseLocation, 'id'>): Promise<WarehouseLocation> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { name, code, type, parentId } = location;

    // Validate for duplicate code before attempting to insert.
    const existing = db.prepare('SELECT id FROM locations WHERE code = ?').get(code);
    if (existing) {
        throw new Error(`El código de ubicación '${code}' ya está en uso. Por favor, elige otro.`);
    }

    const info = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(name, code, type, parentId ?? null);
    const newLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(info.lastInsertRowid) as WarehouseLocation;
    return newLocation;
}

export async function addBulkLocations(payload: { type: 'rack' | 'clone'; params: any; }): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { type, params } = payload;
    const settings = await getWarehouseSettings();

    const transaction = db.transaction(() => {
        if (type === 'rack') {
            const { name, prefix, levels, positions, depth, parentId } = params;

            // Check for existing code before trying to insert
            const existing = db.prepare('SELECT id FROM locations WHERE code = ?').get(prefix);
            if (existing) {
                throw new Error(`El código de prefijo '${prefix}' ya está en uso. Por favor, elige otro.`);
            }

            const rackType = settings.locationLevels.find(l => l.name.toLowerCase().includes('rack'))?.type || 'rack';
            const info = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(name, prefix, rackType, parentId || null);
            const rackId = info.lastInsertRowid as number;

            for (let i = 0; i < levels; i++) {
                const levelName = String.fromCharCode(65 + i);
                const levelType = settings.locationLevels[3]?.type || 'shelf';
                const levelInfo = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(`Nivel ${levelName}`, `${prefix}-${levelName}`, levelType, rackId);
                const levelId = levelInfo.lastInsertRowid as number;

                for (let j = 1; j <= positions; j++) {
                    const posName = String(j).padStart(2, '0');
                    const posType = settings.locationLevels[4]?.type || 'bin';
                    const posCode = `${prefix}-${levelName}-${posName}`;
                    const posInfo = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(`Posición ${posName}`, posCode, posType, levelId);
                    
                    if (depth > 0) {
                        const posId = posInfo.lastInsertRowid as number;
                        if (depth === 1) {
                            db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run('Frente', `${posCode}-F`, posType, posId);
                        } else if (depth >= 2) {
                            db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run('Frente', `${posCode}-F`, posType, posId);
                            db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run('Fondo', `${posCode}-T`, posType, posId);
                        }
                    }
                }
            }
        } else if (type === 'clone') {
            const { sourceRackId, newName, newPrefix } = params;

            const existing = db.prepare('SELECT id FROM locations WHERE code = ?').get(newPrefix);
            if (existing) {
                throw new Error(`El nuevo código de prefijo '${newPrefix}' ya está en uso.`);
            }

            const allLocations = db.prepare('SELECT * FROM locations').all() as WarehouseLocation[];
            const sourceRack = allLocations.find(l => l.id === Number(sourceRackId));
            if (!sourceRack) throw new Error('Rack de origen no encontrado.');

            const mapping = new Map<number, number>();
            
            const newRackInfo = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(newName, newPrefix, sourceRack.type, sourceRack.parentId);
            const newRackId = newRackInfo.lastInsertRowid as number;
            mapping.set(sourceRack.id, newRackId);

            function cloneChildren(oldParentId: number, newParentId: number, originalRackCode: string) {
                const children = allLocations.filter(l => l.parentId === oldParentId);
                for (const child of children) {
                    const newCode = child.code.replace(originalRackCode, newPrefix);
                    const newChildInfo = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(child.name, newCode, child.type, newParentId);
                    const newChildId = newChildInfo.lastInsertRowid as number;
                    mapping.set(child.id, newChildId);
                    cloneChildren(child.id, newChildId, originalRackCode);
                }
            }

            cloneChildren(sourceRack.id, newRackId, sourceRack.code);
        }
    });

    transaction();
}


export async function updateLocation(location: WarehouseLocation): Promise<WarehouseLocation> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { id, name, code, type, parentId } = location;
    db.prepare('UPDATE locations SET name = ?, code = ?, type = ?, parentId = ? WHERE id = ?').run(name, code, type, parentId ?? null, id);
    const updatedLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as WarehouseLocation;
    return updatedLocation;
}

export async function deleteLocation(id: number, userName: string): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    
    // Check for dependencies before deleting
    const inventoryCount = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE locationId = ?').get(id) as { count: number };
    const itemLocationCount = db.prepare('SELECT COUNT(*) as count FROM item_locations WHERE locationId = ?').get(id) as { count: number };
    const childrenCount = db.prepare('SELECT COUNT(*) as count FROM locations WHERE parentId = ?').get(id) as { count: number };

    if (inventoryCount.count > 0 || itemLocationCount.count > 0) {
        throw new Error("No se puede eliminar la ubicación porque contiene inventario o asignaciones de productos. Por favor, mueva o elimine el contenido primero.");
    }
    
    if (childrenCount.count > 0) {
        throw new Error("No se puede eliminar la ubicación porque tiene ubicaciones hijas. Por favor, elimine las ubicaciones anidadas primero.");
    }

    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    await logWarn(`Warehouse location with ID ${id} was deleted by user ${userName}.`);
}


export async function getInventoryForItem(itemId: string): Promise<WarehouseInventoryItem[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    return db.prepare('SELECT * FROM inventory WHERE itemId = ?').all(itemId) as WarehouseInventoryItem[];
}

export async function getInventory(dateRange?: DateRange): Promise<WarehouseInventoryItem[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    if (dateRange?.from) {
        const toDate = dateRange.to || new Date();
        toDate.setHours(23, 59, 59, 999);
        const inventory = db.prepare(`
            SELECT * FROM inventory 
            WHERE lastUpdated BETWEEN ? AND ?
            ORDER BY lastUpdated DESC
        `).all(dateRange.from.toISOString(), toDate.toISOString()) as WarehouseInventoryItem[];
        return JSON.parse(JSON.stringify(inventory));
    }
    const inventory = db.prepare('SELECT * FROM inventory ORDER BY lastUpdated DESC').all() as WarehouseInventoryItem[];
    return JSON.parse(JSON.stringify(inventory));
}

export async function updateInventory(itemId: string, locationId: number, newQuantity: number, userId: number): Promise<void> {
    const warehouseDb = await connectDb(WAREHOUSE_DB_FILE);
    
    // Get user name from main DB first
    const mainDb = await connectDb();
    const user = mainDb.prepare('SELECT name FROM users WHERE id = ?').get(userId) as User | undefined;
    const userName = user?.name || 'Sistema';

    try {
        const transaction = warehouseDb.transaction(() => {
            const currentInventory = warehouseDb.prepare('SELECT quantity FROM inventory WHERE itemId = ? AND locationId = ?').get(itemId, locationId) as { quantity: number } | undefined;
            const oldQuantity = currentInventory?.quantity ?? 0;
            const difference = newQuantity - oldQuantity;

            if (difference !== 0) {
                warehouseDb.prepare(
                    `INSERT INTO inventory (itemId, locationId, quantity, lastUpdated, updatedBy) 
                     VALUES (?, ?, ?, datetime('now'), ?)
                     ON CONFLICT(itemId, locationId) 
                     DO UPDATE SET quantity = ?, updatedBy = ?, lastUpdated = datetime('now')`
                ).run(itemId, locationId, newQuantity, userName, newQuantity, userName);

                warehouseDb.prepare(
                    'INSERT INTO movements (itemId, quantity, fromLocationId, toLocationId, timestamp, userId, notes) VALUES (?, ?, ?, ?, datetime(\'now\'), ?, ?)'
                ).run(itemId, difference, null, locationId, userId, `Ajuste de inventario físico. Conteo: ${newQuantity}`);
            }
        });

        transaction();
    } catch(error) {
        logError('Error in updateInventory transaction', { error: (error as Error).message, user: userName });
        throw error;
    }
}


export async function logMovement(movement: Omit<MovementLog, 'id' | 'timestamp'>): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const newMovement = { ...movement, timestamp: new Date().toISOString() };
    db.prepare(
        'INSERT INTO movements (itemId, quantity, fromLocationId, toLocationId, timestamp, userId, notes) VALUES (@itemId, @quantity, @fromLocationId, @toLocationId, @timestamp, @userId, @notes)'
    ).run(newMovement);
}

export async function getWarehouseData(): Promise<{ locations: WarehouseLocation[], inventory: WarehouseInventoryItem[], stock: StockInfo[], itemLocations: ItemLocation[], warehouseSettings: WarehouseSettings, stockSettings: StockSettings }> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const locations = db.prepare('SELECT * FROM locations').all() as WarehouseLocation[];
    const inventory = db.prepare('SELECT * FROM inventory').all() as WarehouseInventoryItem[];
    const itemLocations = db.prepare('SELECT * FROM item_locations').all() as ItemLocation[];
    const stock = await getAllStockFromMain();
    const warehouseSettings = await getWarehouseSettings();
    const stockSettings = await getStockSettingsFromMain();

    return JSON.parse(JSON.stringify({
        locations: locations || [],
        inventory: inventory || [],
        stock: stock || [],
        itemLocations: itemLocations || [],
        warehouseSettings: warehouseSettings,
        stockSettings: stockSettings || { warehouses: [] },
    }));
}

export async function getMovements(itemId?: string): Promise<MovementLog[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    if (itemId) {
        return db.prepare('SELECT * FROM movements WHERE itemId = ? ORDER BY timestamp DESC').all(itemId) as MovementLog[];
    }
    return db.prepare('SELECT * FROM movements ORDER BY timestamp DESC').all() as MovementLog[];
}

export async function getItemLocations(itemId: string): Promise<ItemLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const itemLocations = db.prepare('SELECT * FROM item_locations WHERE itemId = ?').all(itemId) as ItemLocation[];
    return JSON.parse(JSON.stringify(itemLocations));
}

export async function getAllItemLocations(): Promise<ItemLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const itemLocations = db.prepare('SELECT * FROM item_locations').all() as ItemLocation[];
    return JSON.parse(JSON.stringify(itemLocations));
}

export async function assignItemToLocation(payload: Partial<Omit<ItemLocation, 'updatedAt'>> & { updatedBy: string }): Promise<ItemLocation> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { id, itemId, locationId, clientId, isExclusive, requiresCertificate, updatedBy } = payload;
    
    if (id) { // Update existing
        db.prepare('UPDATE item_locations SET clientId = ?, isExclusive = ?, requiresCertificate = ?, updatedBy = ?, updatedAt = datetime(\'now\') WHERE id = ?')
          .run(clientId || null, isExclusive, requiresCertificate, updatedBy, id);
        const updatedItem = db.prepare('SELECT * FROM item_locations WHERE id = ?').get(id) as ItemLocation;
        return updatedItem;
    } else { // Insert new
        const info = db.prepare('INSERT INTO item_locations (itemId, locationId, clientId, isExclusive, requiresCertificate, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
          .run(itemId, locationId, clientId || null, isExclusive, requiresCertificate, updatedBy);
        const newItem = db.prepare('SELECT * FROM item_locations WHERE id = ?').get(info.lastInsertRowid) as ItemLocation;
        return newItem;
    }
}


export async function unassignItemFromLocation(itemLocationId: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('DELETE FROM item_locations WHERE id = ?').run(itemLocationId);
}

export async function addInventoryUnit(unit: Omit<InventoryUnit, 'id' | 'createdAt' | 'unitCode'>): Promise<InventoryUnit> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    
    const transaction = db.transaction(() => {
        // Step 1: Get the current settings to read the prefix and counter
        const settingsRow = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string };
        const parsedSettings: WarehouseSettings = JSON.parse(settingsRow.value);
        const prefix = parsedSettings.unitPrefix || 'U';
        const nextNumber = parsedSettings.nextUnitNumber || 1;
        const unitCode = `${prefix}${String(nextNumber).padStart(5, '0')}`;
        
        // Step 2: Create the new unit with the generated code
        const newUnitData = {
            ...unit,
            createdAt: new Date().toISOString(),
            unitCode: unitCode,
            humanReadableId: unit.humanReadableId || null,
            documentId: unit.documentId || null,
            erpDocumentId: unit.erpDocumentId || null,
            quantity: unit.quantity ?? 1,
        };
        const info = db.prepare(
            'INSERT INTO inventory_units (unitCode, productId, humanReadableId, documentId, erpDocumentId, locationId, quantity, notes, createdAt, createdBy) VALUES (@unitCode, @productId, @humanReadableId, @documentId, @erpDocumentId, @locationId, @quantity, @notes, @createdAt, @createdBy)'
        ).run(newUnitData);
        
        const newId = info.lastInsertRowid as number;
        
        // Step 3: Increment and save the counter for the next operation
        parsedSettings.nextUnitNumber = nextNumber + 1;
        db.prepare(`UPDATE warehouse_config SET value = ? WHERE key = 'settings'`).run(JSON.stringify(parsedSettings));

        // Step 4: Return the newly created unit
        return db.prepare('SELECT * FROM inventory_units WHERE id = ?').get(newId) as InventoryUnit;
    });

    try {
      return transaction();
    } catch (error: any) {
        logError("Failed to create inventory unit transactionally", { error: error.message, details: unit });
        throw error; // Re-throw to be caught by the calling action
    }
}

export async function getInventoryUnits(dateRange?: DateRange): Promise<InventoryUnit[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    
    if (dateRange?.from) {
        const toDate = dateRange.to || new Date();
        toDate.setHours(23, 59, 59, 999);
        const units = db.prepare(`
            SELECT * FROM inventory_units 
            WHERE createdAt BETWEEN ? AND ?
            ORDER BY createdAt DESC
        `).all(dateRange.from.toISOString(), toDate.toISOString()) as InventoryUnit[];
        return JSON.parse(JSON.stringify(units));
    }
    
    const units = db.prepare('SELECT * FROM inventory_units ORDER BY createdAt DESC LIMIT 200').all() as InventoryUnit[];
    return JSON.parse(JSON.stringify(units));
}

export async function searchInventoryUnits(filters: {
    dateRange?: DateRange;
    productId?: string;
    humanReadableId?: string;
    unitCode?: string;
    documentId?: string;
}): Promise<InventoryUnit[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    let query = 'SELECT * FROM inventory_units';
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.dateRange?.from) {
        whereClauses.push("createdAt >= ?");
        params.push(filters.dateRange.from.toISOString());
    }
    if (filters.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        whereClauses.push("createdAt <= ?");
        params.push(toDate.toISOString());
    }
    if (filters.productId) {
        whereClauses.push("productId LIKE ?");
        params.push(`%${filters.productId}%`);
    }
    if (filters.humanReadableId) {
        whereClauses.push("humanReadableId LIKE ?");
        params.push(`%${filters.humanReadableId}%`);
    }
    if (filters.unitCode) {
        whereClauses.push("unitCode LIKE ?");
        params.push(`%${filters.unitCode}%`);
    }
    if (filters.documentId) {
        whereClauses.push("documentId LIKE ?");
        params.push(`%${filters.documentId}%`);
    }
    
    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    query += ' ORDER BY createdAt DESC LIMIT 100';
    
    const units = db.prepare(query).all(...params) as InventoryUnit[];
    return JSON.parse(JSON.stringify(units));
}


export async function getInventoryUnitById(id: string | number): Promise<InventoryUnit | null> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const searchTerm = String(id).toUpperCase();
    
    let unit: InventoryUnit | null | undefined;
    
    // First, try to find by the unique unitCode (e.g., 'U00001') or human-readable ID
    unit = db.prepare('SELECT * FROM inventory_units WHERE UPPER(unitCode) = ? OR UPPER(humanReadableId) = ?').get(searchTerm, searchTerm) as InventoryUnit | undefined;

    // If not found and the ID is numeric, try searching by the primary key
    if (!unit && !isNaN(Number(id))) {
        unit = db.prepare('SELECT * FROM inventory_units WHERE id = ?').get(id) as InventoryUnit | undefined;
    }
    return unit ? JSON.parse(JSON.stringify(unit)) : null;
}

export async function deleteInventoryUnit(id: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('DELETE FROM inventory_units WHERE id = ?').run(id);
}

export async function updateInventoryUnitLocation(id: number, locationId: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('UPDATE inventory_units SET locationId = ? WHERE id = ?').run(locationId, id);
}


// --- Wizard Lock Functions ---

export async function getActiveLocks(): Promise<WarehouseLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const locks = db.prepare('SELECT * FROM locations WHERE isLocked = 1').all() as WarehouseLocation[];
    return JSON.parse(JSON.stringify(locks));
}

export async function lockEntity(payload: { entityIds: number[]; userName: string; userId: number; }): Promise<{ locked: boolean }> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { entityIds, userName, userId } = payload;
    const sessionId = String(userId); // Use user ID as the session ID

    const transaction = db.transaction(() => {
        const placeholders = entityIds.map(() => '?').join(',');
        const conflictingLocks = db.prepare(`SELECT id, lockedBy FROM locations WHERE id IN (${placeholders}) AND isLocked = 1`).all(...entityIds) as { id: number; lockedBy: string }[];
        
        if (conflictingLocks.length > 0) {
            logWarn('Lock attempt failed, entity already locked', { conflictingLocks, user: userName });
            return { locked: true };
        }

        const stmt = db.prepare(`UPDATE locations SET isLocked = 1, lockedBy = ?, lockedBySessionId = ? WHERE id IN (${placeholders})`);
        stmt.run(userName, sessionId, ...entityIds);
        
        return { locked: false };
    });

    return transaction();
}

export async function releaseLock(entityIds: number[], userId: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    if (entityIds.length === 0) return;
    const placeholders = entityIds.map(() => '?').join(',');
    const sessionId = String(userId);
    // Only release locks that belong to the current user's session
    db.prepare(`UPDATE locations SET isLocked = 0, lockedBy = NULL, lockedBySessionId = NULL WHERE id IN (${placeholders}) AND lockedBySessionId = ?`).run(...entityIds, sessionId);
}

export async function forceReleaseLock(locationId: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('UPDATE locations SET isLocked = 0, lockedBy = NULL, lockedBySessionId = NULL WHERE id = ?').run(locationId);
}

export async function getChildLocations(parentIds: number[]): Promise<WarehouseLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    if (parentIds.length === 0) return [];
    
    let allChildren: WarehouseLocation[] = [];
    const queue = [...parentIds];
    const visited = new Set<number>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const children = db.prepare(`SELECT * FROM locations WHERE parentId = ?`).all(currentId) as WarehouseLocation[];
        if (children.length === 0) {
            const self = db.prepare('SELECT * FROM locations WHERE id = ?').get(currentId) as WarehouseLocation;
            if(self) allChildren.push(self);
        } else {
            queue.push(...children.map(c => c.id));
        }
    }
    
    // De-duplicate in case of complex structures
    const uniqueChildren = Array.from(new Map(allChildren.map(item => [item.id, item])).values());
    return JSON.parse(JSON.stringify(uniqueChildren));
}

export async function correctInventoryUnit(payload: {
    unitId: number;
    newProductId: string;
    newQuantity: number;
    newHumanReadableId: string;
    newDocumentId: string;
    newErpDocumentId: string;
    userId: number;
    userName: string;
}): Promise<void> {
    const { unitId, newProductId, newQuantity, newHumanReadableId, newDocumentId, newErpDocumentId, userId, userName } = payload;
    const db = await connectDb(WAREHOUSE_DB_FILE);

    const transaction = db.transaction(() => {
        const originalUnit = db.prepare('SELECT * FROM inventory_units WHERE id = ?').get(unitId) as InventoryUnit | undefined;
        if (!originalUnit) {
            throw new Error("La unidad de inventario a corregir no existe.");
        }

        // --- ATOMIC COUNTER LOGIC ---
        // 1. Get the current settings to read the prefix and counter
        const settingsRow = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string };
        const parsedSettings: WarehouseSettings = JSON.parse(settingsRow.value);
        const nextNumber = parsedSettings.nextUnitNumber || 1;
        const prefix = parsedSettings.unitPrefix || 'U';
        const newUnitCode = `${prefix}${String(nextNumber).padStart(5, '0')}`;
        
        // 2. Increment and immediately save the new counter
        parsedSettings.nextUnitNumber = nextNumber + 1;
        db.prepare(`UPDATE warehouse_config SET value = ? WHERE key = 'settings'`).run(JSON.stringify(parsedSettings));
        // --- END ATOMIC COUNTER LOGIC ---

        // 3. Anular la unidad original (poniendo cantidad en 0 para mantener el histórico del código)
        db.prepare('UPDATE inventory_units SET quantity = 0, notes = ? WHERE id = ?').run(`CORREGIDO. Reemplazado por unidad ${newUnitCode}. Producto original era ${originalUnit.productId}. Anulado por ${userName}. Nota original: ${originalUnit.notes || ''}`, unitId);

        // 4. Registrar movimiento de SALIDA del producto incorrecto con la cantidad original
        db.prepare(
            'INSERT INTO movements (itemId, quantity, fromLocationId, toLocationId, timestamp, userId, notes) VALUES (?, ?, ?, ?, datetime(\'now\'), ?, ?)'
        ).run(originalUnit.productId, -originalUnit.quantity, originalUnit.locationId, null, userId, `Corrección de ingreso (Anulación). Salida de unidad ${originalUnit.unitCode}.`);

        // 5. Crear NUEVA unidad de inventario con los datos corregidos
        db.prepare(
            'INSERT INTO inventory_units (unitCode, productId, humanReadableId, documentId, erpDocumentId, locationId, quantity, notes, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            newUnitCode,
            newProductId,
            newHumanReadableId || null,
            newDocumentId || null,
            newErpDocumentId || null,
            originalUnit.locationId,
            newQuantity,
            `CORRECCIÓN desde ${originalUnit.unitCode}.`,
            originalUnit.createdAt,
            userName
        );

        // 6. Registrar movimiento de ENTRADA para el producto y cantidad correctos
        db.prepare(
            'INSERT INTO movements (itemId, quantity, fromLocationId, toLocationId, timestamp, userId, notes) VALUES (?, ?, ?, ?, datetime(\'now\'), ?, ?)'
        ).run(newProductId, newQuantity, null, originalUnit.locationId, userId, `Corrección de ingreso. Nueva unidad ${newUnitCode}.`);

        logInfo('Inventory unit corrected successfully', {
            oldUnitId: unitId,
            oldProductId: originalUnit.productId,
            newProductId,
            newQuantity,
            newUnitCode,
            user: userName,
        });
    });

    try {
        transaction();
    } catch (error: any) {
        logError('Failed to correct inventory unit', { error: error.message, payload });
        throw error;
    }
}
