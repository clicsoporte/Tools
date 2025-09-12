/**
 * @fileoverview Client-side functions for interacting with the warehouse module's server-side DB functions.
 */
'use client';

import type { Location, InventoryItem, MovementLog, StockInfo, StockSettings, ItemLocation } from '../../core/types';
import { 
    getLocations as getLocationsServer,
    addLocation as addLocationServer,
    getInventory as getInventoryServer,
    updateInventory as updateInventoryServer,
    getMovements as getMovementsServer,
    logMovement as logMovementServer,
    getStockSettings as getStockSettingsServer,
} from './db';


export async function getLocations(): Promise<Location[]> {
    return await getLocationsServer();
}

export async function addLocation(location: Omit<Location, 'id'>): Promise<Location> {
    return await addLocationServer(location);
}

export async function getInventory(): Promise<{ locations: Location[], inventory: InventoryItem[], stock: StockInfo[], itemLocations: ItemLocation[] }> {
    return await getInventoryServer();
}

export async function getStockSettings(): Promise<StockSettings> {
    return await getStockSettingsServer();
}

export async function updateInventory(itemId: string, locationId: number, quantity: number): Promise<void> {
    await updateInventoryServer(itemId, locationId, quantity);
}

export async function getMovements(itemId?: string): Promise<MovementLog[]> {
    return await getMovementsServer(itemId);
}

export async function logMovement(movement: Omit<MovementLog, 'id' | 'timestamp'>): Promise<void> {
    await logMovementServer(movement);
}
