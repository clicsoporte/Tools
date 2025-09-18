/**
 * @fileoverview This file contains client-side functions for interacting with server-side database logic.
 * This abstraction layer prevents direct DB access from the client and ensures that server-side
 * functions are called correctly. It's safe to use these functions in "use client" components.
 */
'use client';

import type { Company, Product, Customer, Role, QuoteDraft, Exemption, ExemptionLaw, ApiSettings, StockInfo, StockSettings, SqlConfig, ImportQuery, DatabaseModule, ItemLocation } from '../types';
import { 
    getAllProducts as getAllProductsServer,
    getAllCustomers as getAllCustomersServer,
    getAllExemptions as getAllExemptionsServer,
    getAllRoles as getAllRolesServer,
    saveAllRoles as saveAllRolesServer,
    saveQuoteDraft as saveQuoteDraftServer,
    getAllQuoteDrafts as getAllQuoteDraftsServer,
    deleteQuoteDraft as deleteQuoteDraftServer,
    saveExemptionLaws as saveExemptionLawsServer,
    getExemptionLaws as getExemptionLawsServer,
    saveApiSettings as saveApiSettingsServer,
    getApiSettings as getApiSettingsServer,
    getCompanySettings as getCompanySettingsServer,
    saveCompanySettings as saveCompanySettingsServer,
    getAllStock as getAllStockServer,
    saveAllStock as saveAllStockServer,
    saveStockSettings as saveStockSettingsServer,
    getStockSettings as getStockSettingsServer,
    importData as importDataServer,
    getDbModules as getDbModulesServer,
    backupDatabase as backupDatabaseServer,
    restoreDatabase as restoreDatabaseServer,
    resetDatabase as resetDatabaseServer,
    resetDefaultRoles as resetDefaultRolesServer,
    importAllDataFromFiles as importAllDataFromFilesServer,
    saveSqlConfig as saveSqlConfigServer,
    getImportQueries as getImportQueriesServer,
    saveImportQueries as saveImportQueriesServer,
    testSqlConnection as testSqlConnectionServer,
    saveAllLocations as saveAllLocationsServer,
} from './db';
import { getSqlConfig as getSqlConfigServer } from './config-db';

// Wrapper functions to call server-side DB operations from the client.
export const getAllProducts = async (): Promise<Product[]> => getAllProductsServer();
export const getAllCustomers = async (): Promise<Customer[]> => getAllCustomersServer();
export const getAllExemptions = async (): Promise<Exemption[]> => getAllExemptionsServer();
export const getAllRoles = async (): Promise<Role[]> => getAllRolesServer();
export const saveAllRoles = async (roles: Role[]): Promise<void> => saveAllRolesServer(roles);
export const resetDefaultRoles = async (): Promise<void> => resetDefaultRolesServer();
export const saveQuoteDraft = async (draft: QuoteDraft): Promise<void> => saveQuoteDraftServer(draft);
export const getAllQuoteDrafts = async (userId: number): Promise<QuoteDraft[]> => getAllQuoteDraftsServer(userId);
export const deleteQuoteDraft = async (draftId: string): Promise<void> => deleteQuoteDraftServer(draftId);
export const saveExemptionLaws = async (laws: ExemptionLaw[]): Promise<void> => saveExemptionLawsServer(laws);
export const getExemptionLaws = async (): Promise<ExemptionLaw[]> => getExemptionLawsServer();
export const saveApiSettings = async (settings: ApiSettings): Promise<void> => saveApiSettingsServer(settings);
export const getApiSettings = async (): Promise<ApiSettings | null> => getApiSettingsServer();
export const getAllStock = async (): Promise<StockInfo[]> => getAllStockServer();
export const saveAllStock = async (stockData: { itemId: string, warehouseId: string, stock: number }[]): Promise<void> => saveAllStockServer(stockData);
export const getStockSettings = async (): Promise<StockSettings> => getStockSettingsServer();
export const saveStockSettings = async (settings: StockSettings): Promise<void> => saveStockSettingsServer(settings);
export const getCompanySettings = async (): Promise<Company | null> => getCompanySettingsServer();
export const saveCompanySettings = async (data: Company): Promise<void> => saveCompanySettingsServer(data);
export const getDbModules = async (): Promise<Omit<DatabaseModule, 'initFn'>[]> => getDbModulesServer();
export const backupDatabase = async (moduleId: string): Promise<Buffer> => backupDatabaseServer(moduleId);
export const restoreDatabase = async (formData: FormData): Promise<void> => restoreDatabaseServer(formData);
export const resetDatabase = async (moduleId: string): Promise<void> => resetDatabaseServer(moduleId);
export const importAllDataFromFiles = async (): Promise<{ type: string; count: number; }[]> => importAllDataFromFilesServer();
export const getSqlConfig = async (): Promise<SqlConfig | null> => getSqlConfigServer();
export const saveSqlConfig = async (config: SqlConfig): Promise<void> => saveSqlConfigServer(config);
export const getImportQueries = async (): Promise<ImportQuery[]> => getImportQueriesServer();
export const saveImportQueries = async (queries: ImportQuery[]): Promise<void> => saveImportQueriesServer(queries);
export const testSqlConnection = async (): Promise<void> => testSqlConnectionServer();
export const importData = async (type: 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys'): Promise<{ count: number, source: string }> => importDataServer(type);
export const saveAllLocations = async (locations: ItemLocation[]): Promise<void> => saveAllLocationsServer(locations);
