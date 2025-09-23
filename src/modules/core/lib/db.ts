/**
 * @fileoverview This file handles the SQLite database connection and provides
 * server-side functions for all database operations. It includes initialization,
 * schema creation, data access, and migration logic for all application modules.
 * ALL FUNCTIONS IN THIS FILE ARE SERVER-ONLY.
 */
"use server";

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initialUsers, initialCompany, initialRoles } from './data';
import type { Company, LogEntry, ApiSettings, User, Product, Customer, Role, QuoteDraft, DatabaseModule, Exemption, ExemptionLaw, StockInfo, Warehouse, StockSettings, Location, InventoryItem, SqlConfig, ImportQuery, ItemLocation, UpdateBackupInfo } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import Papa from 'papaparse';
import { executeQuery } from './sql-service';
import { initializePlannerDb, runPlannerMigrations } from '../../planner/lib/db';
import { initializeRequestsDb, runRequestMigrations } from '../../requests/lib/db';
import { initializeWarehouseDb, runWarehouseMigrations } from '../../warehouse/lib/db';
import { getExchangeRate as fetchExchangeRateFromApi } from './api-actions';
import { getSqlConfig } from './config-db';
import { logError, logInfo, logWarn } from './logger';


const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;
const CABYS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'cabys.csv');
const UPDATE_BACKUP_DIR = 'update_backups';


/**
 * Acts as a registry for all database modules in the application.
 * This structure allows the core `connectDb` function to be completely agnostic
 * of any specific module, promoting true modularity and decoupling.
 */
const DB_MODULES: DatabaseModule[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Sistema Principal)', dbFile: DB_FILE, initFn: initializeMainDatabase, migrationFn: checkAndApplyMigrations },
    { id: 'purchase-requests', name: 'Solicitud de Compra', dbFile: 'requests.db', initFn: initializeRequestsDb, migrationFn: runRequestMigrations },
    { id: 'production-planner', name: 'Planificador de Producción', dbFile: 'planner.db', initFn: initializePlannerDb, migrationFn: runPlannerMigrations },
    { id: 'warehouse-management', name: 'Gestión de Almacenes', dbFile: 'warehouse.db', initFn: initializeWarehouseDb, migrationFn: runWarehouseMigrations },
];

// This path is configured to work correctly within the Next.js build output directory,
// which is crucial for serverless environments.
const dbDirectory = path.join(process.cwd(), 'dbs');

let dbConnections = new Map<string, Database.Database>();

/**
 * Establishes a connection to a specific SQLite database file.
 * If the database file does not exist or is malformed, it creates it and initializes the schema and default data.
 * It manages multiple connections in a map to support a multi-database architecture.
 * @param {string} dbFile - The filename of the database to connect to.
 * @returns {Database.Database} The database connection instance.
 */
export async function connectDb(dbFile: string = DB_FILE): Promise<Database.Database> {
    if (dbConnections.has(dbFile) && dbConnections.get(dbFile)!.open) {
        return dbConnections.get(dbFile)!;
    }
    
    const dbPath = path.join(dbDirectory, dbFile);
    if (!fs.existsSync(dbDirectory)) {
        fs.mkdirSync(dbDirectory, { recursive: true });
    }

    const restoreFilePath = `${dbPath}_restore.db`;
    if (fs.existsSync(restoreFilePath)) {
        console.log(`Restore file found for ${dbFile}. Applying restore...`);
        try {
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
                dbConnections.delete(dbFile);
            }
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, `${dbPath}.bak`); // Create a .bak before overwriting
                fs.unlinkSync(dbPath);
            }
            fs.renameSync(restoreFilePath, dbPath);
            await logWarn(`Database for module ${dbFile} was restored from a backup on startup.`);
        } catch(e: any) {
            console.error(`Failed to apply restore for ${dbFile}: ${e.message}`);
            logError(`Failed to apply restore for ${dbFile}`, { error: e.message });
            if (fs.existsSync(restoreFilePath)) fs.unlinkSync(restoreFilePath);
        }
    }


    let db: Database.Database;
    let dbExistsAndIsValid = false;

    if (fs.existsSync(dbPath)) {
        try {
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');

            const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
            const mainTable = moduleConfig?.id === 'clic-tools-main' ? 'users' : moduleConfig?.id === 'purchase-requests' ? 'purchase_requests' : moduleConfig?.id === 'production-planner' ? 'production_orders' : moduleConfig?.id === 'warehouse-management' ? 'locations' : null;
            
            if (mainTable) {
                const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(mainTable);
                if (tableCheck) {
                    dbExistsAndIsValid = true;
                } else {
                     console.log(`Main table '${mainTable}' not found in ${dbFile}. DB will be re-initialized.`);
                }
            } else {
                // If we don't have a main table to check, assume it's valid if it opens.
                // This is a fallback and less safe.
                dbExistsAndIsValid = true; 
            }
        } catch (error) {
            console.error(`Database ${dbFile} is corrupted or unreadable. It will be re-initialized.`, error);
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
            }
            fs.unlinkSync(dbPath);
            dbExistsAndIsValid = false;
        }
    }


    if (!dbExistsAndIsValid) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        console.log(`Database ${dbFile} not found or seems empty/corrupt, creating and initializing...`);
        const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
        if (moduleConfig?.initFn) {
            await moduleConfig.initFn(db);
        }
    }

    const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
    if (moduleConfig?.migrationFn) {
        try {
            await moduleConfig.migrationFn(db!);
        } catch (error) {
            console.error(`Migration failed for ${dbFile}, but continuing. Error:`, error);
        }
    }

    dbConnections.set(dbFile, db!);
    return db!;
}


/**
 * Checks the database schema and applies necessary alterations (migrations).
 * This makes the app more resilient to schema changes over time without data loss.
 * @param {Database.Database} db - The database instance to check.
 */
async function checkAndApplyMigrations(db: import('better-sqlite3').Database) {
    // Main DB Migrations
    try {
        const companyTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='company_settings'`).get();
        if(!companyTable) return; // DB not initialized yet, migrations will fail.
        
        const companyTableInfo = db.prepare(`PRAGMA table_info(company_settings)`).all() as { name: string }[];
        const companyColumns = new Set(companyTableInfo.map(c => c.name));
        
        if (!companyColumns.has('decimalPlaces')) {
            console.log("MIGRATION: Adding decimalPlaces column to company_settings.");
            db.exec(`ALTER TABLE company_settings ADD COLUMN decimalPlaces INTEGER DEFAULT 2`);
        }
        
        if (companyColumns.has('importPath')) {
            console.log("MIGRATION: Dropping importPath column from company_settings.");
            db.exec(`ALTER TABLE company_settings DROP COLUMN importPath`);
        }
        
        if (!companyColumns.has('customerFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN customerFilePath TEXT`);
        if (!companyColumns.has('productFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN productFilePath TEXT`);
        if (!companyColumns.has('exemptionFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN exemptionFilePath TEXT`);
        if (!companyColumns.has('stockFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN stockFilePath TEXT`);
        if (!companyColumns.has('locationFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN locationFilePath TEXT`);
        if (!companyColumns.has('cabysFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN cabysFilePath TEXT`);
        if (!companyColumns.has('importMode')) db.exec(`ALTER TABLE company_settings ADD COLUMN importMode TEXT DEFAULT 'file'`);
        if (!companyColumns.has('logoUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN logoUrl TEXT`);
        if (!companyColumns.has('searchDebounceTime')) db.exec(`ALTER TABLE company_settings ADD COLUMN searchDebounceTime INTEGER DEFAULT 500`);
        if (!companyColumns.has('lastSyncTimestamp')) db.exec(`ALTER TABLE company_settings ADD COLUMN lastSyncTimestamp TEXT`);
        if (!companyColumns.has('syncWarningHours')) db.exec(`ALTER TABLE company_settings ADD COLUMN syncWarningHours INTEGER DEFAULT 12`);


        const adminUser = db.prepare('SELECT role FROM users WHERE id = 1').get() as { role: string } | undefined;
        if (adminUser && adminUser.role !== 'admin') {
            console.log("MIGRATION: Ensuring user with ID 1 is an admin.");
            db.prepare(`UPDATE users SET role = 'admin' WHERE id = 1`).run();
        }

        const draftsTableInfo = db.prepare(`PRAGMA table_info(quote_drafts)`).all() as { name: string }[];
        const draftColumns = new Set(draftsTableInfo.map(c => c.name));
        if (!draftColumns.has('userId')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN userId INTEGER;`);
        if (!draftColumns.has('customerId')) {
            db.exec(`ALTER TABLE quote_drafts ADD COLUMN customerId TEXT;`);
            
            const oldDrafts = db.prepare('SELECT id, customer FROM quote_drafts WHERE customer IS NOT NULL').all() as {id: string, customer: string}[];
            for(const draft of oldDrafts) {
                try {
                    const customerObj = JSON.parse(draft.customer);
                    if (customerObj && customerObj.id) {
                        db.prepare('UPDATE quote_drafts SET customerId = ? WHERE id = ?').run(customerObj.id, draft.id);
                    }
                } catch {}
            }
        }
        if (!draftColumns.has('lines')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN lines TEXT;`);
        if (!draftColumns.has('totals')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN totals TEXT;`);
        if (!draftColumns.has('notes')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN notes TEXT;`);
        if (!draftColumns.has('currency')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN currency TEXT;`);
        if (!draftColumns.has('exchangeRate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN exchangeRate REAL;`);
        if (!draftColumns.has('purchaseOrderNumber')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN purchaseOrderNumber TEXT;`);

        const usersToUpdate = db.prepare('SELECT id, password FROM users').all() as User[];
        const updateUserPassword = db.prepare('UPDATE users SET password = ? WHERE id = ?');
        let updatedCount = 0;
        for (const user of usersToUpdate) {
            if (user.password && !user.password.startsWith('$2a$')) {
                const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);
                updateUserPassword.run(hashedPassword, user.id);
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`MIGRATION: Successfully hashed ${updatedCount} plaintext password(s).`);
        }

        const exemptionsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exemptions'`).get();
        if (!exemptionsTable) {
            console.log("MIGRATION: Creating exemptions table.");
            db.exec(`
                CREATE TABLE exemptions (
                    code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT, endDate TEXT, percentage REAL, docType TEXT,
                    institutionName TEXT, institutionCode TEXT
                );
            `);
        }
        
        const apiTableInfo = db.prepare(`PRAGMA table_info(api_settings)`).all() as { name: string }[];
        if (!apiTableInfo.some(col => col.name === 'haciendaExemptionApi')) {
            console.log("MIGRATION: Adding haciendaExemptionApi column to api_settings.");
            db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaExemptionApi TEXT`);
        }
        if (!apiTableInfo.some(col => col.name === 'haciendaTributariaApi')) {
            console.log("MIGRATION: Adding haciendaTributariaApi column to api_settings.");
            db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaTributariaApi TEXT`);
        }
        
        const lawsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exemption_laws'`).get();
        if (!lawsTable) {
             console.log("MIGRATION: Creating exemption_laws table.");
             db.exec(`CREATE TABLE exemption_laws (docType TEXT PRIMARY KEY, institutionName TEXT NOT NULL, authNumber TEXT)`);
        }

        if (apiTableInfo.some(col => col.name === 'zonaFrancaLaw')) {
             console.log("MIGRATION: Dropping zonaFrancaLaw column from api_settings.");
             db.exec(`
                CREATE TABLE api_settings_new (id INTEGER PRIMARY KEY DEFAULT 1, exchangeRateApi TEXT, haciendaExemptionApi TEXT, haciendaTributariaApi TEXT);
                INSERT INTO api_settings_new (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi) SELECT id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi FROM api_settings;
                DROP TABLE api_settings;
                ALTER TABLE api_settings_new RENAME TO api_settings;
             `);
        }

        const stockTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stock'`).get();
        if (!stockTable) {
            console.log("MIGRATION: Creating stock table.");
            db.exec(`CREATE TABLE IF NOT EXISTS stock (itemId TEXT PRIMARY KEY, stockByWarehouse TEXT NOT NULL, totalStock REAL NOT NULL);`);
        }

        const stockSettingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stock_settings'`).get();
         if (!stockSettingsTable) {
            console.log("MIGRATION: Creating stock_settings table.");
            db.exec(`CREATE TABLE IF NOT EXISTS stock_settings (key TEXT PRIMARY KEY, value TEXT);`);
            const oldStockSettings = db.prepare("SELECT value FROM company_settings WHERE key = 'stockSettings'").get() as { value: string } | undefined;
            if (oldStockSettings) {
                console.log("MIGRATION: Moving stock settings to new table.");
                db.prepare("INSERT INTO stock_settings (key, value) VALUES ('warehouses', ?)").run(oldStockSettings.value);
                db.prepare("DELETE FROM company_settings WHERE key = 'stockSettings'").run();
            }
        }
        
        const sqlConfigTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sql_config'`).get();
        if (!sqlConfigTable) {
            console.log("MIGRATION: Creating sql_config table.");
            db.exec(`CREATE TABLE IF NOT EXISTS sql_config (key TEXT PRIMARY KEY, value TEXT);`);
        }
        
        const importQueriesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='import_queries'`).get();
        if (!importQueriesTable) {
            console.log("MIGRATION: Creating import_queries table.");
            db.exec(`CREATE TABLE IF NOT EXISTS import_queries (type TEXT PRIMARY KEY, query TEXT);`);
        }
        
        const cabysCatalogTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='cabys_catalog'`).get();
        if (!cabysCatalogTable) {
            console.log("MIGRATION: Creating cabys_catalog table.");
            db.exec(`
                CREATE TABLE cabys_catalog (
                    code TEXT PRIMARY KEY,
                    description TEXT NOT NULL,
                    taxRate REAL
                );
            `);
        }

        const exchangeRatesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exchange_rates'`).get();
        if (!exchangeRatesTable) {
            console.log("MIGRATION: Creating exchange_rates table.");
            db.exec(`CREATE TABLE exchange_rates (date TEXT PRIMARY KEY, rate REAL NOT NULL);`);
        }


    } catch (error) {
        console.error("Failed to apply migrations:", error);
    }
}
async function initializeMainDatabase(db: import('better-sqlite3').Database) {
    const mainSchema = `
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            whatsapp TEXT,
            avatar TEXT,
            role TEXT NOT NULL,
            recentActivity TEXT,
            securityQuestion TEXT,
            securityAnswer TEXT
        );

        CREATE TABLE company_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT,
            logoUrl TEXT, systemName TEXT,
            quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER,
            searchDebounceTime INTEGER, syncWarningHours INTEGER, importMode TEXT, lastSyncTimestamp TEXT,
            customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT,
            stockFilePath TEXT, locationFilePath TEXT, cabysFilePath TEXT
        );
        
        CREATE TABLE api_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            exchangeRateApi TEXT,
            haciendaExemptionApi TEXT,
            haciendaTributariaApi TEXT
        );

        CREATE TABLE exemption_laws (
            docType TEXT PRIMARY KEY,
            institutionName TEXT NOT NULL,
            authNumber TEXT
        );
        
        CREATE TABLE logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT
        );

        CREATE TABLE customers (
            id TEXT PRIMARY KEY, name TEXT, address TEXT, phone TEXT, taxId TEXT, currency TEXT,
            creditLimit REAL, paymentCondition TEXT, salesperson TEXT, active TEXT, email TEXT, electronicDocEmail
        );

        CREATE TABLE products (
            id TEXT PRIMARY KEY, description TEXT, classification TEXT, lastEntry TEXT, active TEXT,
            notes TEXT, unit TEXT, isBasicGood TEXT, cabys TEXT
        );

        CREATE TABLE exemptions (
            code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT,
            endDate TEXT, percentage REAL, docType TEXT, institutionName TEXT, institutionCode TEXT
        );

        CREATE TABLE stock (
            itemId TEXT PRIMARY KEY,
            stockByWarehouse TEXT NOT NULL,
            totalStock REAL NOT NULL
        );
        
        CREATE TABLE stock_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE roles (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL
        );

        CREATE TABLE quote_drafts (
            id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, userId INTEGER, customerId TEXT,
            lines TEXT, totals TEXT, notes TEXT, currency TEXT, exchangeRate REAL, purchaseOrderNumber TEXT
        );

        CREATE TABLE sql_config (
            key TEXT PRIMARY KEY, value TEXT
        );

        CREATE TABLE import_queries (
            type TEXT PRIMARY KEY, query TEXT
        );
        
        CREATE TABLE cabys_catalog (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            taxRate REAL
        );

        CREATE TABLE exchange_rates (
            date TEXT PRIMARY KEY,
            rate REAL NOT NULL
        );
    `;

    db.exec(mainSchema);

    const userInsert = db.prepare('INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)');
    initialUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password!, SALT_ROUNDS);
        userInsert.run({ ...user, password: hashedPassword });
    });

    db.prepare(`INSERT INTO company_settings (id, name, taxId, address, phone, email, systemName, quotePrefix, nextQuoteNumber, decimalPlaces, searchDebounceTime, syncWarningHours, importMode) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        initialCompany.name, initialCompany.taxId, initialCompany.address, initialCompany.phone, initialCompany.email, initialCompany.systemName,
        initialCompany.quotePrefix, initialCompany.nextQuoteNumber, initialCompany.decimalPlaces, initialCompany.searchDebounceTime, initialCompany.syncWarningHours, initialCompany.importMode
    );
    
    db.prepare(`INSERT OR IGNORE INTO api_settings (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi) VALUES (1, ?, ?, ?)`).run(
        'https://api.hacienda.go.cr/indicadores/tc/dolar', 
        'https://api.hacienda.go.cr/fe/ex?autorizacion=',
        'https://api.hacienda.go.cr/fe/ae?identificacion='
    );

    db.prepare('INSERT OR IGNORE INTO exemption_laws (docType, institutionName, authNumber) VALUES (?, ?, ?)')
        .run('99', 'Régimen de Zona Franca', '9635');
    db.prepare('INSERT OR IGNORE INTO exemption_laws (docType, institutionName) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)')
        .run('02', 'Exento para Compras Autorizadas', '03', 'Ventas a Diplomáticos', '04', 'Ventas a la CCSS', '05', 'Ventas a Instituciones Públicas', '06', 'Otros');

    const roleInsert = db.prepare('INSERT INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    initialRoles.forEach(role => roleInsert.run({ ...role, permissions: JSON.stringify(role.permissions) }));
    
    const initialQueries: ImportQuery[] = [
        { type: 'customers', query: "SELECT CLIENTE, NOMBRE, DIRECCION, TELEFONO1, CONTRIBUYENTE, MONEDA, LIMITE_CREDITO, CONDICION_PAGO, VENDEDOR, ACTIVO, E_MAIL, EMAIL_DOC_ELECTRONICO FROM SOFTLAND.GAREND.CLIENTE WHERE ACTIVO = 'S'" },
        { type: 'products', query: "SELECT ARTICULO, DESCRIPCION, CLASIFICACION_2, ULTIMO_INGRESO, ACTIVO, NOTAS, UNIDAD_VENTA, CANASTA_BASICA, CODIGO_HACIENDA FROM SOFTLAND.GAREND.ARTICULO WHERE ACTIVO = 'S'" },
        { type: 'exemptions', query: "SELECT CODIGO, DESCRIPCION, CLIENTE, NUM_AUTOR, FECHA_RIGE, FECHA_VENCE, PORCENTAJE, TIPO_DOC, NOMBRE_INSTITUCION, CODIGO_INSTITUCION FROM SOFTLAND.GAREND.EXO_CLIENTE" },
        { type: 'stock', query: "SELECT ARTICULO, BODEGA, CANT_DISPONIBLE FROM SOFTLAND.GAREND.EXISTENCIA_BODEGA WHERE CANT_DISPONIBLE > 0" },
        { type: 'locations', query: "" },
        { type: 'cabys', query: "" },
    ];
    const queryInsert = db.prepare('INSERT OR IGNORE INTO import_queries (type, query) VALUES (@type, @query)');
    initialQueries.forEach(q => queryInsert.run(q));

    console.log(`Database ${DB_FILE} initialized with default users, company settings, and roles.`);
    await checkAndApplyMigrations(db);
}

export async function getCompanySettings(): Promise<Company | null> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Company | null;
    } catch (error) {
        console.error("Failed to get company settings:", error);
        return null;
    }
}

export async function saveCompanySettings(settings: Company): Promise<void> {
    const db = await connectDb();
    try {
        db.prepare(`
            UPDATE company_settings SET 
                name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email,
                logoUrl = @logoUrl, systemName = @systemName, quotePrefix = @quotePrefix, nextQuoteNumber = @nextQuoteNumber, 
                decimalPlaces = @decimalPlaces, searchDebounceTime = @searchDebounceTime, syncWarningHours = @syncWarningHours,
                customerFilePath = @customerFilePath, 
                productFilePath = @productFilePath, exemptionFilePath = @exemptionFilePath, stockFilePath = @stockFilePath,
                locationFilePath = @locationFilePath, cabysFilePath = @cabysFilePath, importMode = @importMode,
                lastSyncTimestamp = @lastSyncTimestamp
            WHERE id = 1
        `).run(settings);
    } catch (error) {
        console.error("Failed to save company settings:", error);
    }
}

export async function getLogs(): Promise<LogEntry[]> {
    const db = await connectDb();
    try {
      const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all() as LogEntry[];
      return logs.map(log => ({...log, details: log.details ? JSON.parse(log.details) : null}));
    } catch (error) {
      console.error("Failed to get logs from database", error);
      return [];
    }
};

export async function addLog(entry: Omit<LogEntry, "id" | "timestamp">) {
    const db = await connectDb();
    try {
      const newEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
        details: entry.details ? JSON.stringify(entry.details) : null,
      };
      db.prepare('INSERT INTO logs (timestamp, type, message, details) VALUES (@timestamp, @type, @message, @details)').run(newEntry);
    } catch (error) {
      console.error("Failed to add log to database", error);
    }
};

export async function clearLogs() {
    const db = await connectDb();
    try {
        db.prepare('DELETE FROM logs').run();
    } catch (error) {
        console.error("Failed to clear logs from database", error);
    }
};

export async function getApiSettings(): Promise<ApiSettings | null> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM api_settings WHERE id = 1').get() as ApiSettings | null;
    } catch (error) {
        console.error("Failed to get api settings:", error);
        return null;
    }
}

export async function saveApiSettings(settings: ApiSettings): Promise<void> {
    const db = await connectDb();
    try {
        db.prepare(`
            UPDATE api_settings SET 
                exchangeRateApi = @exchangeRateApi, 
                haciendaExemptionApi = @haciendaExemptionApi,
                haciendaTributariaApi = @haciendaTributariaApi
            WHERE id = 1
        `).run(settings);
    } catch (error) {
        console.error("Failed to save api settings:", error);
    }
}

export async function getExemptionLaws(): Promise<ExemptionLaw[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM exemption_laws').all() as ExemptionLaw[];
    } catch (error) {
        console.error("Failed to get exemption laws:", error);
        return [];
    }
}

export async function saveExemptionLaws(laws: ExemptionLaw[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT OR REPLACE INTO exemption_laws (docType, institutionName, authNumber) VALUES (@docType, @institutionName, @authNumber)');
    
    const transaction = db.transaction((lawsToSave) => {
        db.prepare('DELETE FROM exemption_laws').run();
        for(const law of lawsToSave) {
            insert.run({
                ...law,
                authNumber: law.authNumber ? String(law.authNumber).trim() : null
            });
        }
    });

    try {
        transaction(laws);
    } catch (error) {
        console.error("Failed to save exemption laws:", error);
        throw new Error("Database transaction failed to save exemption laws.");
    }
}

export async function getAllCustomers(): Promise<Customer[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM customers').all() as Customer[];
    } catch (error) {
        console.error("Failed to get all customers:", error);
        return [];
    }
}

export async function saveAllCustomers(customers: Customer[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT INTO customers (id, name, address, phone, taxId, currency, creditLimit, paymentCondition, salesperson, active, email, electronicDocEmail) VALUES (@id, @name, @address, @phone, @taxId, @currency, @creditLimit, @paymentCondition, @salesperson, @active, @email, @electronicDocEmail)');
    const transaction = db.transaction((customersToSave) => {
        db.prepare('DELETE FROM customers').run();
        for(const customer of customersToSave) insert.run(customer);
    });
    try {
        transaction(customers);
    } catch (error) {
        console.error("Failed to save all customers:", error);
    }
}

export async function getAllProducts(): Promise<Product[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM products').all() as Product[];
    } catch (error) {
        console.error("Failed to get all products:", error);
        return [];
    }
}

export async function saveAllProducts(products: Product[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT INTO products (id, description, classification, lastEntry, active, notes, unit, isBasicGood, cabys) VALUES (@id, @description, @classification, @lastEntry, @active, @notes, @unit, @isBasicGood, @cabys)');
    const transaction = db.transaction((productsToSave) => {
        db.prepare('DELETE FROM products').run();
        for(let product of productsToSave) {
            if (product.lastEntry instanceof Date) {
                product.lastEntry = product.lastEntry.toISOString();
            }
            insert.run(product);
        }
    });
    try {
        transaction(products);
    } catch (error) {
        console.error("Failed to save all products:", error);
        throw error;
    }
}

export async function getAllExemptions(): Promise<Exemption[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM exemptions').all() as Exemption[];
    } catch (error) {
        console.error("Failed to get all exemptions:", error);
        return [];
    }
}

export async function saveAllExemptions(exemptions: Exemption[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT OR REPLACE INTO exemptions (code, description, customer, authNumber, startDate, endDate, percentage, docType, institutionName, institutionCode) VALUES (@code, @description, @customer, @authNumber, @startDate, @endDate, @percentage, @docType, @institutionName, @institutionCode)');
    const transaction = db.transaction((exemptionsToSave) => {
        db.prepare('DELETE FROM exemptions').run();
        for(let exemption of exemptionsToSave) {
             if (exemption.startDate instanceof Date) {
                exemption.startDate = exemption.startDate.toISOString();
            }
            if (exemption.endDate instanceof Date) {
                exemption.endDate = exemption.endDate.toISOString();
            }
            insert.run(exemption);
        }
    });
    try {
        transaction(exemptions);
    } catch (error) {
        console.error("Failed to save all exemptions:", error);
        throw error;
    }
}

export async function getAllRoles(): Promise<Role[]> {
    const db = await connectDb();
    try {
        const roles = db.prepare('SELECT * FROM roles').all() as any[];
        return roles.map(role => ({ ...role, permissions: JSON.parse(role.permissions) }));
    } catch (error) {
        console.error("Failed to get all roles:", error);
        return [];
    }
}

export async function saveAllRoles(roles: Role[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    const transaction = db.transaction((rolesToSave) => {
        db.prepare('DELETE FROM roles').run();
        for(const role of rolesToSave) {
            insert.run({ ...role, permissions: JSON.stringify(role.permissions) });
        }
    });
    try {
        transaction(roles);
    } catch (error) {
        console.error("Failed to save all roles:", error);
    }
}

export async function resetDefaultRoles(): Promise<void> {
    const db = await connectDb();
    const insertOrReplace = db.prepare('INSERT OR REPLACE INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');

    const transaction = db.transaction(() => {
        for (const role of initialRoles) {
            insertOrReplace.run({
                ...role,
                permissions: JSON.stringify(role.permissions),
            });
        }
    });

    try {
        transaction();
    } catch(error) {
        console.error("Failed to reset default roles:", error);
    }
}

export async function getAllQuoteDrafts(userId: number): Promise<QuoteDraft[]> {
    const db = await connectDb();
    try {
        const drafts = db.prepare('SELECT * FROM quote_drafts WHERE userId = ? ORDER BY createdAt DESC').all(userId) as any[];
        return drafts.map(draft => ({
            ...draft,
            lines: draft.lines ? JSON.parse(draft.lines) : [],
            totals: draft.totals ? JSON.parse(draft.totals) : {},
        }));
    } catch (error) {
        console.error("Failed to get all quote drafts:", error);
        return [];
    }
}

export async function saveQuoteDraft(draft: QuoteDraft): Promise<void> {
    const db = await connectDb();
    const stmt = db.prepare('INSERT OR REPLACE INTO quote_drafts (id, createdAt, userId, customerId, lines, totals, notes, currency, exchangeRate, purchaseOrderNumber) VALUES (@id, @createdAt, @userId, @customerId, @lines, @totals, @notes, @currency, @exchangeRate, @purchaseOrderNumber)');
    try {
        stmt.run({
            ...draft,
            lines: JSON.stringify(draft.lines),
            totals: JSON.stringify(draft.totals),
        });
    } catch (error) {
        console.error("Failed to save quote draft:", error);
    }
}

export async function deleteQuoteDraft(draftId: string): Promise<void> {
    const db = await connectDb();
    try {
        db.prepare('DELETE FROM quote_drafts WHERE id = ?').run(draftId);
    } catch (error) {
        console.error("Failed to delete quote draft:", error);
    }
}

export async function getDbModules(): Promise<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]> {
    return DB_MODULES.map(({ initFn, migrationFn, ...rest }) => rest);
}

const createHeaderMapping = (type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys') => {
    switch (type) {
        case 'customers':
            return {
                'CLIENTE': 'id', 'NOMBRE': 'name', 'DIRECCION': 'address', 'TELEFONO1': 'phone',
                'CONTRIBUYENTE': 'taxId', 'MONEDA': 'currency', 'LIMITE_CREDITO': 'creditLimit',
                'CONDICION_PAGO': 'paymentCondition', 'VENDEDOR': 'salesperson', 'ACTIVO': 'active',
                'E_MAIL': 'email', 'EMAIL_DOC_ELECTRONICO': 'electronicDocEmail',
            };
        case 'products':
            return {
                'ARTICULO': 'id', 'DESCRIPCION': 'description', 'CLASIFICACION_2': 'classification',
                'ULTIMO_INGRESO': 'lastEntry', 'ACTIVO': 'active', 'NOTAS': 'notes',
                'UNIDAD_VENTA': 'unit', 'CANASTA_BASICA': 'isBasicGood', 'CODIGO_HACIENDA': 'cabys'
            };
        case 'exemptions':
             return {
                'CODIGO': 'code', 'DESCRIPCION': 'description', 'CLIENTE': 'customer', 'NUM_AUTOR': 'authNumber',
                'FECHA_RIGE': 'startDate', 'FECHA_VENCE': 'endDate', 'PORCENTAJE': 'percentage',
                'TIPO_DOC': 'docType', 'NOMBRE_INSTITUCION': 'institutionName', 'CODIGO_INSTITUCION': 'institutionCode'
            };
        case 'stock':
            return {
                'ARTICULO': 'itemId', 'BODEGA': 'warehouseId', 'CANT_DISPONIBLE': 'stock'
            };
        case 'locations':
             return {
                'CODIGO': 'itemId', 'P. HORIZONTAL': 'hPos', 'P. VERTICAL': 'vPos', 
                'RACK': 'rack', 'CLIENTE': 'client', 'DESCRIPCION': 'description'
            };
        case 'cabys':
             return {
                'CODIGO': 'Codigo', 'DESCRIPCION': 'Descripcion'
            };
        default:
            return {};
    }
}

const parseData = (lines: string[], type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys') => {
    if (lines.length < 1) {
        return [];
    }
    const headerMapping = createHeaderMapping(type);
    const header = lines[0].split('\t').map(h => h.trim().toUpperCase());
    const dataArray: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split('\t');
        const dataObject: { [key: string]: any } = {};
        header.forEach((h, index) => {
            const key = headerMapping[h as keyof typeof headerMapping];
            if (key) {
                const value = data[index]?.trim() || '';
                if (key === 'creditLimit' || key === 'percentage' || key === 'stock' || key === 'rack' || key === 'hPos') {
                    dataObject[key] = parseFloat(value) || 0;
                } else {
                    dataObject[key] = value;
                }
            }
        });
        if (Object.keys(dataObject).length > 0) {
            dataArray.push(dataObject);
        }
    }
    return dataArray;
};

export async function importDataFromFile(type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys'): Promise<{ count: number, source: string }> {
    const companySettings = await getCompanySettings();
    if (!companySettings) throw new Error("No se pudo cargar la configuración de la empresa.");
    
    let filePath = '';
    switch(type) {
        case 'customers': filePath = companySettings.customerFilePath || ''; break;
        case 'products': filePath = companySettings.productFilePath || ''; break;
        case 'exemptions': filePath = companySettings.exemptionFilePath || ''; break;
        case 'stock': filePath = companySettings.stockFilePath || ''; break;
        case 'locations': filePath = companySettings.locationFilePath || ''; break;
        case 'cabys': filePath = companySettings.cabysFilePath || ''; break;
    }

    if (!filePath) {
        throw new Error(`La ruta de importación para ${type} no está configurada.`);
    }
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no fue encontrado en la ruta especificada: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const isCsv = filePath.toLowerCase().endsWith('.csv');

    if (type === 'cabys' && isCsv) {
        const { count } = await updateCabysCatalogFromContent(fileContent);
        return { count, source: filePath };
    }
    
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 1) return { count: 0, source: filePath };
    
    const dataArray = parseData(lines, type);
    
    if (type === 'customers') await saveAllCustomers(dataArray as Customer[]);
    else if (type === 'products') await saveAllProducts(dataArray as Product[]);
    else if (type === 'exemptions') await saveAllExemptions(dataArray as Exemption[]);
    else if (type === 'stock') {
        await saveAllStock(dataArray as { itemId: string, warehouseId: string, stock: number }[]);
        return { count: new Set(dataArray.map(item => item.itemId)).size, source: filePath };
    }
    else if (type === 'locations') await saveAllLocations(dataArray as ItemLocation[]);

    return { count: dataArray.length, source: filePath };
}

async function importDataFromSql(type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys'): Promise<{ count: number, source: string }> {
    const db = await connectDb();
    const queryRow = db.prepare('SELECT query FROM import_queries WHERE type = ?').get(type) as { query: string } | undefined;
    if (!queryRow || !queryRow.query) {
        throw new Error(`No hay una consulta SQL configurada para importar ${type}.`);
    }

    const dataArray = await executeQuery(queryRow.query);
    
    const headerMapping = createHeaderMapping(type);
    const mappedData = dataArray.map(row => {
        const newRow: { [key: string]: any } = {};
        for (const key in row) {
            const newKey = headerMapping[key as keyof typeof headerMapping];
            if (newKey) {
                newRow[newKey] = row[key];
            } else {
                newRow[key] = row[key]; // Preserve unmapped columns
            }
        }
        return newRow;
    });

    if (type === 'customers') await saveAllCustomers(mappedData as Customer[]);
    else if (type === 'products') await saveAllProducts(mappedData as Product[]);
    else if (type === 'exemptions') await saveAllExemptions(mappedData as Exemption[]);
    else if (type === 'stock') {
        await saveAllStock(mappedData as { itemId: string, warehouseId: string, stock: number }[]);
        return { count: new Set(mappedData.map(item => item.itemId)).size, source: 'SQL Server' };
    }
    else if (type === 'locations') await saveAllLocations(mappedData as ItemLocation[]);
    else if (type === 'cabys') {
        const { count } = await updateCabysCatalogFromSqlData(mappedData);
        return { count, source: 'SQL Server' };
    }

    return { count: mappedData.length, source: 'SQL Server' };
}

async function updateCabysCatalogFromSqlData(data: any[]): Promise<{ count: number }> {
    const db = await connectDb();
    const transaction = db.transaction((rows) => {
        db.prepare('DELETE FROM cabys_catalog').run();
        const insertStmt = db.prepare('INSERT INTO cabys_catalog (code, description, taxRate) VALUES (?, ?, ?)');
        for (const row of rows) {
            const code = row.code || row.Codigo;
            const description = row.description || row.Descripcion;
            const taxRate = row.taxRate ?? (row.Impuesto !== undefined ? parseFloat(String(row.Impuesto).replace('%', '')) / 100 : undefined);
            if (code && description && taxRate !== undefined && !isNaN(taxRate)) {
                insertStmt.run(code, description, taxRate);
            }
        }
    });

    transaction(data);
    return { count: data.length };
}


export async function importData(type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys'): Promise<{ count: number, source: string }> {
    const companySettings = await getCompanySettings();
    if (!companySettings) throw new Error("No se pudo cargar la configuración de la empresa.");

    if (companySettings.importMode === 'sql') {
        return importDataFromSql(type);
    } else {
        return importDataFromFile(type);
    }
}

export async function getAllStock(): Promise<StockInfo[]> {
    const db = await connectDb();
    try {
        const stockRows = db.prepare('SELECT * FROM stock').all() as { itemId: string, stockByWarehouse: string, totalStock: number }[];
        return stockRows.map(row => ({
            itemId: row.itemId,
            stockByWarehouse: JSON.parse(row.stockByWarehouse),
            totalStock: row.totalStock
        }));
    } catch (error) {
        console.error("Failed to get stock from database", error);
        return [];
    }
};

export async function saveAllStock(stockData: { itemId: string, warehouseId: string, stock: number }[]): Promise<void> {
    const db = await connectDb();
    const stockMap = new Map<string, { [key: string]: number }>();

    for (const item of stockData) {
        if (!stockMap.has(item.itemId)) {
            stockMap.set(item.itemId, {});
        }
        stockMap.get(item.itemId)![item.warehouseId] = item.stock;
    }

    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM stock').run();
        const insertStmt = db.prepare('INSERT INTO stock (itemId, stockByWarehouse, totalStock) VALUES (?, ?, ?)');
        for (const [itemId, stockByWarehouse] of stockMap.entries()) {
            const totalStock = Object.values(stockByWarehouse).reduce((acc, val) => acc + val, 0);
            insertStmt.run(itemId, JSON.stringify(stockByWarehouse), totalStock);
        }
    });

    try {
        transaction();
    } catch (error) {
        console.error("Failed to save all stock:", error);
        throw error;
    }
}

export async function saveAllLocations(locationData: ItemLocation[]): Promise<void> {
    const db = await connectDb('warehouse.db');

    const insertLocation = db.prepare('INSERT OR IGNORE INTO locations (name, code, type) VALUES (@name, @code, @type)');
    const assignItem = db.prepare('INSERT OR IGNORE INTO item_locations (itemId, locationId, clientId) VALUES (?, ?, ?)');
    
    const transaction = db.transaction((data: ItemLocation[]) => {
        db.prepare('DELETE FROM item_locations WHERE clientId IS NOT NULL').run(); // Clear only client-specific locations
        
        const locationMap = new Map<string, number>();
        let existingLocations = db.prepare('SELECT id, code FROM locations').all() as {id: number, code: string}[];
        existingLocations.forEach(loc => locationMap.set(loc.code, loc.id));

        for (const item of data) {
            const rackCode = `RACK-${(item as any).rack}`; // Type assertion to access legacy property
            if (!locationMap.has(rackCode)) {
                insertLocation.run({ name: rackCode, code: rackCode, type: 'rack' });
                const newLocId = db.prepare('SELECT id FROM locations WHERE code = ?').get(rackCode) as {id: number};
                locationMap.set(rackCode, newLocId.id);
            }
            const locationId = locationMap.get(rackCode)!;
            
            assignItem.run(item.itemId, locationId, item.clientId || null);
        }
    });

    try {
        transaction(locationData);
    } catch (error) {
        console.error("Failed to save all locations:", error);
        throw error;
    }
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

export async function saveStockSettings(settings: StockSettings): Promise<void> {
    const db = await connectDb(DB_FILE); // Stock settings are in the main DB
    try {
        db.prepare("INSERT OR REPLACE INTO stock_settings (key, value) VALUES ('warehouses', ?)")
          .run(JSON.stringify(settings.warehouses));
    } catch (error) {
        console.error("Failed to save stock settings:", error);
        throw error;
    }
}

const normalizeHeader = (header: string): string => {
    if (!header) return '';
    return header
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9\(\)]/g, ""); 
};


async function updateCabysCatalogFromContent(fileContent: string): Promise<{ count: number }> {
    const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', 
        transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        if (firstError.code !== 'TooManyFields' && firstError.code !== 'TooFewFields') {
          throw new Error(`Error al procesar el archivo CSV: ${firstError.message} en la línea ${firstError.row}.`);
        }
    }

    const fields = parsed.meta.fields;
    if (!fields) throw new Error("No se pudieron leer los encabezados del archivo CABYS.");

    const normalizedFields = fields.map(normalizeHeader);
    
    const codeHeaderIndex = normalizedFields.findIndex(f => f.includes("categoria9") || f.includes("codigo"));
    const descHeaderIndex = normalizedFields.findIndex(f => f.includes("descripcioncategoria9") || f.includes("descripcion"));
    const taxHeaderIndex = normalizedFields.findIndex(f => f.includes("impuesto"));

    if (codeHeaderIndex === -1 || descHeaderIndex === -1 || taxHeaderIndex === -1) {
        console.error("Detected headers:", fields);
        console.error("Normalized headers:", normalizedFields);
        throw new Error('El archivo debe contener columnas para código, descripción e impuesto. No se encontraron las columnas requeridas.');
    }
    
    const codeHeader = fields[codeHeaderIndex];
    const descHeader = fields[descHeaderIndex];
    const taxHeader = fields[taxHeaderIndex];


    const db = await connectDb();
    const transaction = db.transaction((data) => {
        db.prepare('DELETE FROM cabys_catalog').run();
        const insertStmt = db.prepare('INSERT INTO cabys_catalog (code, description, taxRate) VALUES (?, ?, ?)');
        
        for (const row of data as any[]) {
            const code = row[codeHeader];
            const description = row[descHeader]?.replace(/"/g, '') || ''; // Remove quotes
            const taxString = row[taxHeader]?.replace('%', '').trim();
            const taxRate = parseFloat(taxString) / 100;
            
            if (code && description && !isNaN(taxRate)) {
                insertStmt.run(code, description, taxRate);
            }
        }
    });

    transaction(parsed.data);
    
    const standardizedData = parsed.data.map((row: any) => ({
        Codigo: row[codeHeader],
        Descripcion: row[descHeader],
        Impuesto: row[taxHeader],
    }));
    const newCsvContent = Papa.unparse(standardizedData, { header: true, delimiter: ';' });
    fs.writeFileSync(CABYS_FILE_PATH, newCsvContent);
    
    return { count: standardizedData.length };
}

export async function importAllDataFromFiles(): Promise<{ type: string; count: number; }[]> {
    const companySettings = await getCompanySettings();
    if (!companySettings) throw new Error("No se pudo cargar la configuración de la empresa.");
    
    const importTasks: { type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys'; filePath: string | undefined }[] = [
        { type: 'customers', filePath: companySettings.customerFilePath },
        { type: 'products', filePath: companySettings.productFilePath },
        { type: 'exemptions', filePath: companySettings.exemptionFilePath },
        { type: 'stock', filePath: companySettings.stockFilePath },
        { type: 'locations', filePath: companySettings.locationFilePath },
        { type: 'cabys', filePath: companySettings.cabysFilePath },
    ];
    
    const results: { type: string; count: number; }[] = [];
    
    for (const task of importTasks) {
        if (companySettings.importMode === 'file' && !task.filePath) {
            console.log(`Skipping ${task.type} import: no file path configured.`);
            continue;
        }

        try {
            const result = await importData(task.type);
            results.push({ type: task.type, count: result.count });
        } catch (error) {
            console.error(`Failed to import data for ${task.type}:`, error);
        }
    }

    const db = await connectDb();
    db.prepare('UPDATE company_settings SET lastSyncTimestamp = ? WHERE id = 1')
      .run(new Date().toISOString());
    
    return results;
}

export async function saveSqlConfig(config: SqlConfig): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT OR REPLACE INTO sql_config (key, value) VALUES (@key, @value)');

    const transaction = db.transaction((cfg) => {
        for(const key in cfg) {
            if (cfg[key as keyof SqlConfig] !== undefined) {
                 insert.run({ key, value: cfg[key as keyof SqlConfig] });
            }
        }
    });

    try {
        transaction(config);
    } catch (error) {
        console.error("Failed to save SQL config:", error);
    }
}

export async function getImportQueries(): Promise<ImportQuery[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM import_queries').all() as ImportQuery[];
    } catch (error) {
        console.error("Failed to get import queries:", error);
        return [];
    }
}

export async function saveImportQueries(queries: ImportQuery[]): Promise<void> {
    const db = await connectDb();
    const insert = db.prepare('INSERT OR REPLACE INTO import_queries (type, query) VALUES (@type, @query)');
    const transaction = db.transaction((qs) => {
        for (const q of qs) {
            insert.run(q);
        }
    });
    try {
        transaction(queries);
    } catch (error) {
        console.error("Failed to save import queries:", error);
    }
}

export async function testSqlConnection(): Promise<void> {
    await executeQuery("SELECT 1"); 
}

export async function getAndCacheExchangeRate(forceRefresh = false): Promise<{ rate: number, date: string } | null> {
    const db = await connectDb();
    const today = new Date().toISOString().split('T')[0];

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    db.prepare(`DELETE FROM exchange_rates WHERE date < ?`).run(sixtyDaysAgo.toISOString().split('T')[0]);

    if (!forceRefresh) {
        const cachedRate = db.prepare(`SELECT rate, date FROM exchange_rates WHERE date = ?`).get(today) as { rate: number, date: string } | undefined;
        if (cachedRate) {
            return { rate: cachedRate.rate, date: new Date(cachedRate.date).toLocaleDateString('es-CR') };
        }
    }
    
    try {
        const data = await fetchExchangeRateFromApi();
        if (data.error) throw new Error(data.message);
        
        const rate = data.venta?.valor;
        const rateDate = new Date(data.venta?.fecha).toISOString().split('T')[0];
        
        if (rate && rateDate) {
            db.prepare(`INSERT OR REPLACE INTO exchange_rates (date, rate) VALUES (?, ?)`).run(rateDate, rate);
            return { rate, date: new Date(rateDate).toLocaleDateString('es-CR') };
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch and cache exchange rate:', error);
        const lastRate = db.prepare('SELECT rate, date FROM exchange_rates ORDER BY date DESC LIMIT 1').get() as { rate: number, date: string } | undefined;
        if (lastRate) {
            return { rate: lastRate.rate, date: new Date(lastRate.date).toLocaleDateString('es-CR') };
        }
        return null;
    }
}

export async function backupAllForUpdate(): Promise<void> {
    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backedUpFiles: string[] = [];

    for (const module of DB_MODULES) {
        const dbPath = path.join(dbDirectory, module.dbFile);
        if (fs.existsSync(dbPath)) {
            const backupFileName = `backup-${module.id}-${timestamp}.db`;
            const backupPath = path.join(backupDir, backupFileName);
            
            try {
                if (dbConnections.has(module.dbFile) && dbConnections.get(module.dbFile)?.open) {
                    dbConnections.get(module.dbFile)!.close();
                    dbConnections.delete(module.dbFile);
                }
                
                fs.copyFileSync(dbPath, backupPath);

                await connectDb(module.dbFile);

                const backupDb = new Database(backupPath);
                const result = backupDb.pragma('integrity_check', { simple: true });
                backupDb.close();
                if (result !== 'ok') {
                    throw new Error(`Integrity check failed for ${backupFileName}: ${result}`);
                }

                backedUpFiles.push(backupFileName);
            } catch (e: any) {
                await logError(`Update backup failed for module ${module.name}`, { error: e.message });
                if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
                throw new Error(`El backup del módulo '${module.name}' está corrupto. La operación se ha cancelado.`);
            }
        }
    }
    await logInfo("Full backup for update created successfully.", { files: backedUpFiles });
}

export async function restoreAllFromUpdateBackup(timestamp?: string): Promise<void> {
    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
        const errorMsg = "No se encontró el directorio de backups de actualización.";
        await logError("Restore failed: Update backup directory not found.");
        throw new Error(errorMsg);
    }

    const restoredFiles: string[] = [];

    for (const module of DB_MODULES) {
        try {
            const backupFiles = fs.readdirSync(backupDir)
                .filter(file => file.startsWith(`backup-${module.id}-`) && file.endsWith('.db'))
                .sort()
                .reverse();

            if (backupFiles.length > 0) {
                let backupToRestore = backupFiles[0]; // Default to the latest
                if (timestamp) {
                    const specificBackup = backupFiles.find(f => f.includes(timestamp));
                    if (!specificBackup) {
                        await logWarn(`No specific backup found for module ${module.name} with timestamp ${timestamp}. Skipping restore for this module.`);
                        continue; // Skip if specific backup not found for this module
                    }
                    backupToRestore = specificBackup;
                }

                const backupPath = path.join(backupDir, backupToRestore);
                const dbPath = path.join(dbDirectory, module.dbFile);

                if (dbConnections.has(module.dbFile) && dbConnections.get(module.dbFile)?.open) {
                    dbConnections.get(module.dbFile)!.close();
                    dbConnections.delete(module.dbFile);
                }
                
                fs.copyFileSync(backupPath, `${dbPath}.bak`); // Create a backup of the current live db
                fs.copyFileSync(backupPath, dbPath);
                restoredFiles.push(module.dbFile);
                await connectDb(module.dbFile);
            }
        } catch(error: any) {
             const errorMsg = `Error al restaurar el módulo ${module.name}: ${error.message}`;
             await logError(`Restore failed for module: ${module.name}`, { error: error.message });
             throw new Error(errorMsg);
        }
    }

    if (restoredFiles.length === 0) {
        await logWarn("Restore from update backup attempted, but no backup files were found.");
        throw new Error("No se encontraron archivos de backup para restaurar.");
    }

    await logWarn("Full restore from update backup completed successfully.", { files: restoredFiles });
}

export async function listAllUpdateBackups(): Promise<UpdateBackupInfo[]> {
    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
        return [];
    }

    const allFiles = fs.readdirSync(backupDir);
    const backupInfo: UpdateBackupInfo[] = [];

    for (const file of allFiles) {
        const module = DB_MODULES.find(m => file.startsWith(`backup-${m.id}-`));
        if (module) {
            const timestampMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
            if (timestampMatch) {
                const dateString = timestampMatch[1].replace(/-/g, ':');
                const isoDate = new Date(dateString).toISOString();
                backupInfo.push({
                    moduleId: module.id,
                    moduleName: module.name,
                    fileName: file,
                    date: isoDate,
                });
            }
        }
    }

    return backupInfo.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function deleteOldUpdateBackups(): Promise<number> {
    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
        return 0;
    }

    let deletedCount = 0;
    for (const module of DB_MODULES) {
        const backupFiles = fs.readdirSync(backupDir)
            .filter(file => file.startsWith(`backup-${module.id}-`) && file.endsWith('.db'))
            .sort()
            .reverse(); // Newest first

        if (backupFiles.length > 1) {
            const filesToDelete = backupFiles.slice(1); // All except the newest one
            for (const file of filesToDelete) {
                try {
                    fs.unlinkSync(path.join(backupDir, file));
                    deletedCount++;
                } catch (error) {
                    await logError(`Failed to delete old backup file: ${file}`, { error });
                }
            }
        }
    }
    if (deletedCount > 0) {
      await logInfo(`${deletedCount} old update backups deleted.`);
    }
    return deletedCount;
}

export async function uploadBackupFile(formData: FormData): Promise<number> {
    const backupFiles = formData.getAll('backupFiles') as File[];
    if (!backupFiles || backupFiles.length === 0) {
        throw new Error("No files were provided for upload.");
    }
    
    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    let uploadedCount = 0;
    for (const file of backupFiles) {
        if (!file.name.endsWith('.db')) {
            await logWarn(`Skipped non-db file upload: ${file.name}`);
            continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(backupDir, file.name);
        
        try {
            fs.writeFileSync(filePath, buffer);
            uploadedCount++;
            await logInfo(`Backup file uploaded successfully`, { file: file.name });
        } catch (error: any) {
            await logError(`Failed to write uploaded backup file ${file.name}`, { error: error.message });
        }
    }

    if (uploadedCount === 0) {
        throw new Error("No valid .db files were uploaded.");
    }
    
    return uploadedCount;
}
