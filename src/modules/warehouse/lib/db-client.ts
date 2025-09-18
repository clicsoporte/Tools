/**
 * @fileoverview Client-side functions for interacting with the warehouse module's server-side DB functions.
 */
'use client';

import type { WarehouseLocation, WarehouseInventoryItem, MovementLog, StockInfo, StockSettings, ItemLocation, Product } from '../../core/types';
import { 
    getLocations as getLocationsServer,
    getInventory as getInventoryServer,
    getStockSettings as getStockSettingsServer,
} from './actions';


export async function getLocations(): Promise<WarehouseLocation[]> {
    return await getLocationsServer();
}

export async function getInventory(): Promise<{ locations: WarehouseLocation[], inventory: WarehouseInventoryItem[], stock: StockInfo[], itemLocations: ItemLocation[] }> {
    return await getInventoryServer();
}

export async function getStockSettings(): Promise<StockSettings> {
    return await getStockSettingsServer();
}
