/**
 * @fileoverview This file contains general-purpose Server Actions that can be called from client components.
 */
'use server';

import { importAllDataFromFiles as importAllData } from './db';

/**
 * A server action that triggers a full data synchronization from the configured source (file or SQL).
 * This function is safe to call from client components.
 * @returns {Promise<{ type: string; count: number; }[]>} A promise that resolves to an array of import results.
 */
export async function syncAllData(): Promise<{ type: string; count: number; }[]> {
    return await importAllData();
}
