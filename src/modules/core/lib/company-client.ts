/**
 * @fileoverview This file contains client-side functions for interacting with server-side database logic.
 * This abstraction layer prevents direct DB access from the client and ensures that server-side
 * functions are called correctly. It's safe to use these functions in "use client" components.
 */
'use client';

import type { Company } from '../types';
import { getCompanySettings, saveCompanySettings } from './db';

/**
 * Retrieves the company's general settings from the server.
 * This is a client-side wrapper for the server-side function.
 * @returns {Promise<Company | null>} A promise that resolves to the company object, or null if not found.
 */
export async function getCompanyData(): Promise<Company | null> {
    return getCompanySettings();
}

/**
 * Saves the company's general settings via the server.
 * This is a client-side wrapper for the server-side function.
 * @param {Company} data - The company data object to save.
 * @returns {Promise<void>}
 */
export async function saveCompanyData(data: Company): Promise<void> {
    return saveCompanySettings(data);
}
