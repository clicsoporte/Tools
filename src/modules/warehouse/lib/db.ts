/**
 * @fileoverview Server-side functions for the warehouse database.
 */
"use server";

import { connectDb, getAllStock } from '../../core/lib/db';
import type { WarehouseLocation, WarehouseInventoryItem, MovementLog, WarehouseSettings, StockSettings, StockInfo, ItemLocation } from '../../core/types';

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
            FOREIGN KEY (parentId) REFERENCES locations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL, -- Corresponds to Product['id'] from main DB
            locationId INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            lastUpdated TEXT NOT NULL,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId)
        );

         CREATE TABLE IF NOT EXISTS item_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId TEXT NOT NULL,
            locationId INTEGER NOT NULL,
            clientId TEXT,
            FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
            UNIQUE (itemId, locationId, clientId)
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
            FOREIGN KEY (fromLocationId) REFERENCES locations(id),
            FOREIGN KEY (toLocationId) REFERENCES locations(id)
        );

        CREATE TABLE IF NOT EXISTS warehouse_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);

    // Insert default settings
    const defaultSettings: WarehouseSettings = {
        locationLevels: [
            { type: 'building', name: 'Edificio' },
            { type: 'zone', name: 'Zona' },
            { type: 'rack', name: 'Rack' },
            { type: 'shelf', name: 'Estante' },
            { type: 'bin', name: 'Casilla' }
        ],
        enablePhysicalInventoryTracking: false,
    };
    db.prepare(`
        INSERT OR IGNORE INTO warehouse_config (key, value) VALUES ('settings', ?)
    `).run(JSON.stringify(defaultSettings));
    
    console.log(`Database ${WAREHOUSE_DB_FILE} initialized for Warehouse Management.`);
};

export async function runWarehouseMigrations(db: import('better-sqlite3').Database) {
    const warehouseConfigTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='warehouse_config'`).get();
    if (!warehouseConfigTable) {
        // Table doesn't exist, probably a fresh DB, let initialization handle it
        return;
    }

    // Migration to add enablePhysicalInventoryTracking
    try {
        const settingsRow = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string } | undefined;
        if (settingsRow) {
            const settings = JSON.parse(settingsRow.value);
            if (typeof settings.enablePhysicalInventoryTracking !== 'boolean') {
                console.log("MIGRATION (warehouse.db): Adding enablePhysicalInventoryTracking to settings.");
                settings.enablePhysicalInventoryTracking = false;
                db.prepare(`UPDATE warehouse_config SET value = ? WHERE key = 'settings'`).run(JSON.stringify(settings));
            }
        }
    } catch (error) {
        console.error("Error during warehouse settings migration:", error);
    }
    
    const itemLocationsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='item_locations'`).get();
    if (!itemLocationsTable) {
        console.log("MIGRATION (warehouse.db): Creating item_locations table.");
        db.exec(`
            CREATE TABLE IF NOT EXISTS item_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                itemId TEXT NOT NULL,
                locationId INTEGER NOT NULL,
                clientId TEXT,
                FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
                UNIQUE (itemId, locationId, clientId)
            );
        `);
    }
}

export async function getWarehouseSettings(): Promise<WarehouseSettings> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    try {
        const row = db.prepare(`SELECT value FROM warehouse_config WHERE key = 'settings'`).get() as { value: string } | undefined;
        if (row) {
            const settings = JSON.parse(row.value);
            // Ensure enablePhysicalInventoryTracking exists, default to false if not.
            if (typeof settings.enablePhysicalInventoryTracking !== 'boolean') {
                settings.enablePhysicalInventoryTracking = false;
            }
            return settings;
        }
    } catch (error) {
        console.error("Error fetching warehouse settings, returning default.", error);
    }
    // Return a default object if nothing is found or an error occurs
    return {
        locationLevels: [
            { type: 'building', name: 'Edificio' },
            { type: 'zone', name: 'Zona' },
            { type: 'rack', name: 'Rack' },
            { type: 'shelf', name: 'Estante' },
            { type: 'bin', name: 'Casilla' }
        ],
        enablePhysicalInventoryTracking: false
    };
}

export async function saveWarehouseSettings(settings: WarehouseSettings): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare(`
        INSERT OR REPLACE INTO warehouse_config (key, value) VALUES ('settings', ?)
    `).run(JSON.stringify(settings));
}

export async function getLocations(): Promise<WarehouseLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    return db.prepare('SELECT * FROM locations ORDER BY parentId, name').all() as WarehouseLocation[];
}

export async function addLocation(location: Omit<WarehouseLocation, 'id'>): Promise<WarehouseLocation> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { name, code, type, parentId } = location;
    const info = db.prepare('INSERT INTO locations (name, code, type, parentId) VALUES (?, ?, ?, ?)').run(name, code, type, parentId ?? null);
    return { ...location, id: info.lastInsertRowid as number };
}

export async function updateLocation(location: WarehouseLocation): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const { id, name, code, type, parentId } = location;
    db.prepare('UPDATE locations SET name = ?, code = ?, type = ?, parentId = ? WHERE id = ?').run(name, code, type, parentId ?? null, id);
}

export async function deleteLocation(id: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    // Note: ON DELETE CASCADE will handle child locations, item_locations and inventory.
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
}


export async function getInventoryForItem(itemId: string): Promise<WarehouseInventoryItem[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    return db.prepare('SELECT * FROM inventory WHERE itemId = ?').all(itemId) as WarehouseInventoryItem[];
}

export async function updateInventory(itemId: string, locationId: number, quantityChange: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
     db.prepare(
        `INSERT INTO inventory (itemId, locationId, quantity, lastUpdated) 
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(itemId, locationId) 
         DO UPDATE SET quantity = quantity + ?`
    ).run(itemId, locationId, quantityChange, quantityChange);
}

export async function logMovement(movement: Omit<MovementLog, 'id' | 'timestamp'>): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const newMovement = { ...movement, timestamp: new Date().toISOString() };
    db.prepare(
        'INSERT INTO movements (itemId, quantity, fromLocationId, toLocationId, timestamp, userId, notes) VALUES (@itemId, @quantity, @fromLocationId, @toLocationId, @timestamp, @userId, @notes)'
    ).run(newMovement);
}

export async function getWarehouseData(): Promise<{ locations: WarehouseLocation[], inventory: WarehouseInventoryItem[], stock: StockInfo[], itemLocations: ItemLocation[] }> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    const locations = db.prepare('SELECT * FROM locations').all() as WarehouseLocation[];
    const inventory = db.prepare('SELECT * FROM inventory').all() as WarehouseInventoryItem[];
    const itemLocations = db.prepare('SELECT * FROM item_locations').all() as ItemLocation[];
    const stock = await getAllStock();

    // Sanitize data to ensure they are plain objects for serialization
    return {
        locations: locations.map(loc => ({
            id: Number(loc.id),
            name: String(loc.name),
            code: String(loc.code),
            type: String(loc.type),
            parentId: loc.parentId ? Number(loc.parentId) : null
        })),
        inventory: inventory.map(inv => ({
            id: Number(inv.id),
            itemId: String(inv.itemId),
            locationId: Number(inv.locationId),
            quantity: Number(inv.quantity),
            lastUpdated: String(inv.lastUpdated),
        })),
        stock: Array.isArray(stock) ? stock.map(s => ({
            itemId: String(s.itemId),
            stockByWarehouse: typeof s.stockByWarehouse === 'object' ? {...s.stockByWarehouse} : {},
            totalStock: Number(s.totalStock)
        })) : [],
        itemLocations: itemLocations.map(il => ({
            id: Number(il.id),
            itemId: String(il.itemId),
            locationId: Number(il.locationId),
            clientId: il.clientId ? String(il.clientId) : null
        }))
    };
}

export async function getStockSettings(): Promise<StockSettings> {
    const mainDb = await connectDb('intratool.db');
    try {
        const result = mainDb.prepare("SELECT value FROM stock_settings WHERE key = 'warehouses'").get() as { value: string } | undefined;
        if (result) {
            return { warehouses: JSON.parse(result.value) };
        }
        return { warehouses: [] };
    } catch (error) {
        console.error("Failed to get stock settings from main DB:", error);
        return { warehouses: [] };
    }
}


export async function getMovements(itemId?: string): Promise<MovementLog[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    if (itemId) {
        return db.prepare('SELECT * FROM movements WHERE itemId = ? ORDER BY timestamp DESC').all(itemId) as MovementLog[];
    }
    return db.prepare('SELECT * FROM movements ORDER BY timestamp DESC').all() as MovementLog[];
}

// --- Simple Mode Functions ---
export async function getItemLocations(itemId: string): Promise<ItemLocation[]> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    return db.prepare('SELECT * FROM item_locations WHERE itemId = ?').all(itemId) as ItemLocation[];
}

export async function assignItemToLocation(itemId: string, locationId: number, clientId?: string | null): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('INSERT OR IGNORE INTO item_locations (itemId, locationId, clientId) VALUES (?, ?, ?)').run(itemId, locationId, clientId);
}

export async function unassignItemFromLocation(itemLocationId: number): Promise<void> {
    const db = await connectDb(WAREHOUSE_DB_FILE);
    db.prepare('DELETE FROM item_locations WHERE id = ?').run(itemLocationId);
}
