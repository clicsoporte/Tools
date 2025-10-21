/**
 * @fileoverview Server-side functions for the cost assistant database.
 * This file handles all direct interactions with the `cost_assistant.db` SQLite database,
 * including schema initialization, migrations, and CRUD operations for settings and drafts.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { CostAnalysisDraft, CostAssistantSettings } from '@/modules/core/types';

const COST_ASSISTANT_DB_FILE = 'cost_assistant.db';

const defaultSettings: CostAssistantSettings = {
    columnVisibility: {
        cabysCode: true, supplierCode: true, description: true, quantity: true,
        unitCostWithoutTax: true, unitCostWithTax: false, taxRate: true,
        margin: true, sellPriceWithoutTax: true, finalSellPrice: true, profitPerLine: true
    }
};


export async function initializeCostAssistantDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS drafts (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            createdAt TEXT NOT NULL
        );
    `;
    db.exec(schema);

    db.prepare(`
        INSERT OR IGNORE INTO settings (key, value) VALUES ('columnVisibility', ?)
    `).run(JSON.stringify(defaultSettings.columnVisibility));

    console.log(`Database ${COST_ASSISTANT_DB_FILE} initialized for Cost Assistant.`);
}


export async function getCostAssistantSettings(): Promise<CostAssistantSettings> {
    const db = await connectDb(COST_ASSISTANT_DB_FILE);
    try {
        const row = db.prepare(`SELECT value FROM settings WHERE key = 'columnVisibility'`).get() as { value: string } | undefined;
        if (row) {
            const parsedValue = JSON.parse(row.value);
            // Ensure all keys from default settings are present
            const completeVisibility = { ...defaultSettings.columnVisibility, ...parsedValue };
            return { columnVisibility: completeVisibility };
        }
    } catch (error) {
        console.error("Error getting cost assistant settings, returning default.", error);
    }
    return defaultSettings;
}

export async function saveCostAssistantSettings(settings: CostAssistantSettings): Promise<void> {
    const db = await connectDb(COST_ASSISTANT_DB_FILE);
    db.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES ('columnVisibility', ?)
    `).run(JSON.stringify(settings.columnVisibility));
}

export async function getAllDrafts(userId: string): Promise<CostAnalysisDraft[]> {
    const db = await connectDb(COST_ASSISTANT_DB_FILE);
    try {
        const rows = db.prepare(`SELECT * FROM drafts WHERE userId = ? ORDER BY createdAt DESC`).all(userId) as any[];
        return rows.map(row => {
            const data = JSON.parse(row.data);
            return {
                id: row.id,
                userId: row.userId,
                name: row.name,
                createdAt: row.createdAt,
                ...data
            };
        });
    } catch (error) {
        console.error("Failed to get cost assistant drafts:", error);
        return [];
    }
}

export async function saveDraft(draft: Omit<CostAnalysisDraft, 'id' | 'createdAt'>): Promise<CostAnalysisDraft> {
    const db = await connectDb(COST_ASSISTANT_DB_FILE);
    const id = `${draft.name.replace(/\s+/g, '-')}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    const { userId, name, ...dataToStore } = draft;

    db.prepare(`
        INSERT OR REPLACE INTO drafts (id, userId, name, data, createdAt)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, name, JSON.stringify(dataToStore), createdAt);
    
    return { id, createdAt, ...draft };
}

export async function deleteDraft(id: string): Promise<void> {
    const db = await connectDb(COST_ASSISTANT_DB_FILE);
    db.prepare(`DELETE FROM drafts WHERE id = ?`).run(id);
}
