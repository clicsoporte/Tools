/**
 * @fileoverview Client-side functions for interacting with the warehouse module's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import {
    getLocations as getLocationsServer,
    addLocation as addLocationServer,
    updateLocation as updateLocationServer,
    deleteLocation as deleteLocationServer,
    getWarehouseSettings as getWarehouseSettingsServer,
    saveWarehouseSettings as saveWarehouseSettingsServer,
    getInventoryForItem as getInventoryForItemServer,
    logMovement as logMovementServer,
    updateInventory as updateInventoryServer,
    getItemLocations as getItemLocationsServer,
    getAllItemLocations as getAllItemLocationsServer,
    assignItemToLocation as assignItemToLocationServer,
    unassignItemFromLocation as unassignItemFromLocationServer,
    unassignAllByProduct as unassignAllByProductServer,
    unassignAllByLocation as unassignAllByLocationServer,
    getWarehouseData as getWarehouseDataServer,
    getMovements as getMovementsServer,
    addInventoryUnit as addInventoryUnitServer,
    getInventoryUnits as getInventoryUnitsServer,
    deleteInventoryUnit as deleteInventoryUnitServer,
    getInventoryUnitById as getInventoryUnitByIdServer,
    addBulkLocations as addBulkLocationsServer,
    getActiveLocks as getActiveLocksServer,
    lockEntity as lockEntityServer,
    releaseLock as releaseLockServer,
    forceReleaseLock as forceReleaseLockServer,
    getChildLocations as getChildLocationsServer,
    correctInventoryUnit as correctInventoryUnitServer,
    applyInventoryUnit as applyInventoryUnitServer,
    searchInventoryUnits as searchInventoryUnitsServer,
    migrateLegacyInventoryUnits as migrateLegacyInventoryUnitsServer,
    initializePopulationStatus as initializePopulationStatusServer,
    cleanupAndInitializeLocationFlags as cleanupAndInitializeLocationFlagsServer,
    checkAssignmentConflict as checkAssignmentConflictServer
} from './db';
import { getStockSettings as getStockSettingsDb, saveStockSettings as saveStockSettingsDb } from '@/modules/core/lib/db';
import type { WarehouseSettings, WarehouseLocation, WarehouseInventoryItem, MovementLog, ItemLocation, InventoryUnit, StockSettings, User, DateRange, Product } from '@/modules/core/types';
import { logInfo, logWarn } from '@/modules/core/lib/logger';

export const getWarehouseSettings = async (): Promise<WarehouseSettings> => getWarehouseSettingsServer();
export async function saveWarehouseSettings(settings: Partial<WarehouseSettings>): Promise<void> {
    await logInfo("Warehouse settings updated.");
    return saveWarehouseSettingsServer(settings);
}
export const getStockSettings = async (): Promise<StockSettings> => getStockSettingsDb();
export async function saveStockSettings(settings: StockSettings): Promise<void> {
    await logInfo("Stock settings updated.");
    return saveStockSettingsDb(settings);
}
export const getLocations = async (): Promise<WarehouseLocation[]> => getLocationsServer();

/**
 * Filters a list of all locations to return only those that can be selected as final destinations
 * (i.e., they are not parents of other locations).
 * @param allLocations - An array of all warehouse locations.
 * @returns An array of selectable, "leaf" warehouse locations.
 */
export function getSelectableLocations(allLocations: WarehouseLocation[]): WarehouseLocation[] {
    const parentIds = new Set(allLocations.map(l => l.parentId).filter(Boolean));
    return allLocations.filter(l => !parentIds.has(l.id));
}

export async function addLocation(location: Omit<WarehouseLocation, 'id'>): Promise<WarehouseLocation> {
    const newLocation = await addLocationServer(location);
    await logInfo(`New warehouse location created: ${newLocation.name} (${newLocation.code})`);
    return newLocation;
}

export async function addBulkLocations(payload: { type: 'rack' | 'clone'; params: any; }): Promise<void> {
    await addBulkLocationsServer(payload);
    await logInfo(`Bulk locations created via wizard`, { payload });
}

export async function updateLocation(location: WarehouseLocation): Promise<WarehouseLocation> {
    const updatedLocation = await updateLocationServer(location);
    await logInfo(`Warehouse location updated: ${updatedLocation.name} (${updatedLocation.code})`);
    return updatedLocation;
}
export async function deleteLocation(id: number, userName: string): Promise<void> {
    return deleteLocationServer(id, userName);
}
export const getInventoryForItem = async (itemId: string): Promise<WarehouseInventoryItem[]> => getInventoryForItemServer(itemId);
export const logMovement = async (movement: Omit<MovementLog, 'id'|'timestamp'>): Promise<void> => logMovementServer(movement);

export const updateInventory = async(itemId: string, locationId: number, quantity: number, userId: number): Promise<void> => {
    return updateInventoryServer(itemId, locationId, quantity, userId);
};

// --- Simple Mode Actions ---
export const getItemLocations = async (itemId: string): Promise<ItemLocation[]> => getItemLocationsServer(itemId);
export const getAllItemLocations = async (): Promise<ItemLocation[]> => getAllItemLocationsServer();

export async function assignItemToLocation(payload: Partial<Omit<ItemLocation, 'updatedAt'>> & { updatedBy: string }, mode?: 'move' | 'add_and_mix'): Promise<ItemLocation> {
    return assignItemToLocationServer(payload, mode);
}

export async function checkAssignmentConflict(payload: { itemId: string; locationId: number; }): Promise<{
    productHasOtherLocations: boolean;
    locationHasOtherProducts: boolean;
    conflictingProduct?: Product;
}> {
    return checkAssignmentConflictServer(payload);
}

export async function unassignItemFromLocation(itemLocationId: number): Promise<void> {
    await logInfo(`Item location mapping with ID ${itemLocationId} was removed.`);
    return unassignItemFromLocationServer(itemLocationId);
}

export async function unassignAllByProduct(itemId: string, userName: string): Promise<void> {
    await unassignAllByProductServer(itemId);
    await logWarn(`All assignments for product ${itemId} were deleted by ${userName}.`);
}

export async function unassignAllByLocation(locationId: number, userName: string): Promise<void> {
    await unassignAllByLocationServer(locationId);
    await logWarn(`All assignments for location ID ${locationId} were deleted by ${userName}.`);
}


// --- Page-specific data loaders ---
export const getWarehouseData = async () => getWarehouseDataServer();
export const getMovements = async (itemId?: string): Promise<MovementLog[]> => getMovementsServer(itemId);

// --- Inventory Unit Actions ---
export const addInventoryUnit = async (unit: Omit<InventoryUnit, 'id' | 'createdAt' | 'unitCode' | 'receptionConsecutive' | 'status'>): Promise<InventoryUnit> => addInventoryUnitServer(unit);
export const getInventoryUnits = async (filters: { dateRange?: DateRange, includeVoided?: boolean } = {}): Promise<InventoryUnit[]> => getInventoryUnitsServer(filters);
export const deleteInventoryUnit = async (id: number): Promise<void> => deleteInventoryUnitServer(id);
export const getInventoryUnitById = async (id: string | number): Promise<InventoryUnit | null> => getInventoryUnitByIdServer(id);

export const applyInventoryUnit = async (payload: {
    unitId: number;
    newProductId: string;
    newQuantity: number;
    newHumanReadableId: string;
    newDocumentId: string;
    newErpDocumentId: string;
    updatedBy: string;
}): Promise<void> => applyInventoryUnitServer(payload);

export const correctInventoryUnit = async (payload: {
    unitId: number;
    newProductId: string;
    newQuantity: number;
    newHumanReadableId: string;
    newDocumentId: string;
    newErpDocumentId: string;
    userId: number;
    userName: string;
}): Promise<void> => correctInventoryUnitServer(payload);

export const searchInventoryUnits = async (filters: {
    dateRange?: DateRange;
    productId?: string;
    humanReadableId?: string;
    unitCode?: string;
    documentId?: string;
    receptionConsecutive?: string;
    showVoided?: boolean;
    statusFilter?: 'pending' | 'all';
}): Promise<InventoryUnit[]> => searchInventoryUnitsServer(filters);


// --- Wizard Lock Actions ---
export const getActiveLocks = async (): Promise<WarehouseLocation[]> => getActiveLocksServer();
export const lockEntity = async (payload: { entityIds: number[]; userName: string; userId: number; }): Promise<{ locked: boolean }> => lockEntityServer(payload);
export const releaseLock = async (entityIds: number[], userId: number): Promise<void> => releaseLockServer(entityIds, userId);
export const forceReleaseLock = async (locationId: number): Promise<void> => forceReleaseLockServer(locationId);
export const getChildLocations = async (parentIds: number[]): Promise<WarehouseLocation[]> => getChildLocationsServer(parentIds);

// --- Migration Actions ---
export const migrateLegacyInventoryUnits = async (): Promise<number> => {
    const count = await migrateLegacyInventoryUnitsServer();
    await logInfo(`Legacy inventory unit migration run, updating ${count} records.`);
    return count;
};
export const initializePopulationStatus = async (): Promise<{ updated: number }> => {
    const result = await initializePopulationStatusServer();
    await logInfo(`Population status initialized for ${result.updated} locations.`);
    return result;
};
export const cleanupAndInitializeLocationFlags = async (): Promise<{ deletedCount: number; mixedCount: number; initializedCount: number; }> => {
    await logInfo('Cleanup and initialization of location flags initiated.');
    const result = await cleanupAndInitializeLocationFlagsServer();
    await logInfo(`Cleanup complete. Deleted: ${result.deletedCount}, Marked as mixed: ${result.mixedCount}, Initialized: ${result.initializedCount}`);
    return result;
};
