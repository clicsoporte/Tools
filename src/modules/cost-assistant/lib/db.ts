/**
 * @fileoverview Server-side functions for the cost assistant database.
 * This file handles all direct interactions with the `cost_assistant.db` SQLite database,
 * including schema initialization, migrations, and CRUD operations for settings and drafts.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { CostAnalysisDraft } from '@/modules/core/types';

const COST_ASSISTANT_DB_FILE = 'cost_assistant.db';

export async function getAllDrafts(userId: number): Promise<CostAnalysisDraft[]> {
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
