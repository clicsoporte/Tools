/**
 * @fileoverview Server-side service for handling the CABYS catalog.
 * This service is responsible for loading, caching, and querying the local
 * copy of the CABYS CSV file to provide descriptions for CABYS codes.
 */
'use server';

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const CABYS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'cabys.csv');

let cabysCache: Map<string, string> | null = null;

interface CabysRow {
    Codigo: string;
    Descripcion: string;
}

/**
 * Loads the CABYS data from the CSV file into an in-memory cache (a Map).
 * If the cache is already populated, it returns it immediately. This ensures
 * the large CSV file is only read and parsed once per server instance lifetime.
 * @returns {Promise<Map<string, string>>} A Map where keys are CABYS codes and values are their descriptions.
 */
async function loadCabysData(): Promise<Map<string, string>> {
    if (cabysCache) {
        return cabysCache;
    }

    console.log('Loading CABYS catalog from file...');
    try {
        if (!fs.existsSync(CABYS_FILE_PATH)) {
            console.warn("CABYS file does not exist, creating an empty one.");
            fs.mkdirSync(path.dirname(CABYS_FILE_PATH), { recursive: true });
            fs.writeFileSync(CABYS_FILE_PATH, 'Codigo,Descripcion\n');
        }

        const fileContent = fs.readFileSync(CABYS_FILE_PATH, 'utf-8');
        const newCache = new Map<string, string>();
        
        return new Promise((resolve, reject) => {
            Papa.parse<CabysRow>(fileContent, {
                header: true,
                skipEmptyLines: true,
                step: (row) => {
                    const data = row.data;
                    if (data.Codigo && data.Descripcion) {
                        newCache.set(data.Codigo, data.Descripcion);
                    }
                },
                complete: () => {
                    cabysCache = newCache;
                    console.log(`CABYS catalog loaded with ${cabysCache.size} entries.`);
                    resolve(cabysCache);
                },
                error: (error: Error) => {
                    console.error('Error parsing CABYS CSV:', error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Failed to read or process CABYS file:', error);
        cabysCache = new Map<string, string>(); // Initialize empty cache on error
        return cabysCache;
    }
}

/**
 * Retrieves the description for a given CABYS code from the cached data.
 * @param {string} code - The CABYS code to look up.
 * @returns {Promise<string | null>} The description string or null if not found.
 */
export async function getCabysDescription(code: string): Promise<string | null> {
    const cabysMap = await loadCabysData();
    return cabysMap.get(code) || null;
}

// Pre-load data on server start to make subsequent lookups faster.
loadCabysData().catch(console.error);
