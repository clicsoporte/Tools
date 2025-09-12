/**
 * @fileoverview This file contains server-side functions specifically for reading
 * configuration from the database. It is separated to avoid circular dependencies.
 * ALL FUNCTIONS IN THIS FILE ARE SERVER-ONLY.
 */
"use server";

import { connectDb } from './db';
import type { SqlConfig } from '../types';

/**
 * Retrieves the SQL Server connection configuration from the database.
 * @returns {Promise<SqlConfig | null>} The SQL configuration object, or null if not found.
 */
export async function getSqlConfig(): Promise<SqlConfig | null> {
    const db = await connectDb();
    try {
        const rows = db.prepare('SELECT key, value FROM sql_config').all() as {key: string, value: string}[];
        if (!rows || rows.length === 0) {
            // If there's no config in the DB, it hasn't been saved yet.
            return null;
        }
        const config: SqlConfig = {};
        for (const row of rows) {
            config[row.key as keyof SqlConfig] = row.value;
        }
        return config;
    } catch (error) {
        console.error("Failed to get SQL config:", error);
        return null;
    }
}
