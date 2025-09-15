
'use server';

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
    assignItemToLocation as assignItemToLocationServer,
    unassignItemFromLocation as unassignItemFromLocationServer,
} from './db';
import type { WarehouseSettings, WarehouseLocation, WarehouseInventoryItem, MovementLog, ItemLocation } from '../../core/types';

export const getWarehouseSettings = async (): Promise<WarehouseSettings> => getWarehouseSettingsServer();
export const saveWarehouseSettings = async (settings: WarehouseSettings): Promise<void> => saveWarehouseSettingsServer(settings);
export const getLocations = async (): Promise<WarehouseLocation[]> => getLocationsServer();
export const addLocation = async (location: Omit<WarehouseLocation, 'id'>): Promise<WarehouseLocation> => addLocationServer(location);
export const updateLocation = async (location: WarehouseLocation): Promise<void> => updateLocationServer(location);
export const deleteLocation = async (id: number): Promise<void> => deleteLocationServer(id);
export const getInventoryForItem = async (itemId: string): Promise<WarehouseInventoryItem[]> => getInventoryForItemServer(itemId);
export const logMovement = async (movement: Omit<MovementLog, 'id'|'timestamp'>): Promise<void> => logMovementServer(movement);
export const updateInventory = async(itemId: string, locationId: number, quantityChange: number): Promise<void> => updateInventoryServer(itemId, locationId, quantityChange);

// --- Simple Mode Actions ---
export const getItemLocations = async (itemId: string): Promise<ItemLocation[]> => getItemLocationsServer(itemId);
export const assignItemToLocation = async (itemId: string, locationId: number): Promise<void> => assignItemToLocationServer(itemId);
export const unassignItemFromLocation = async (itemLocationId: number): Promise<void> => unassignItemFromLocationServer(itemLocationId);
