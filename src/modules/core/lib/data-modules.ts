/**
 * @fileoverview This file acts as a central registry for all database modules in the application.
 * This structure allows the core `connectDb` function to be completely agnostic
 * of any specific module, promoting true modularity and decoupling.
 */

import { initializeMainDatabase, checkAndApplyMigrations } from './db';
import { runPlannerMigrations, initializePlannerDb } from '../../planner/lib/db';
import { runRequestMigrations, initializeRequestsDb } from '../../requests/lib/db';
import { runWarehouseMigrations, initializeWarehouseDb } from '../../warehouse/lib/db';
import type { DatabaseModule } from '../types';

export const DB_FILE = 'intratool.db';

/**
 * Acts as a registry for all database modules in the application.
 */
export const DB_MODULES: DatabaseModule[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Sistema Principal)', dbFile: DB_FILE, initFn: initializeMainDatabase, migrationFn: checkAndApplyMigrations },
    { id: 'purchase-requests', name: 'Solicitud de Compra', dbFile: 'requests.db', initFn: initializeRequestsDb, migrationFn: runRequestMigrations },
    { id: 'production-planner', name: 'Planificador de Producción', dbFile: 'planner.db', initFn: initializePlannerDb, migrationFn: runPlannerMigrations },
    { id: 'warehouse-management', name: 'Gestión de Almacenes', dbFile: 'warehouse.db', initFn: initializeWarehouseDb, migrationFn: runWarehouseMigrations },
];
