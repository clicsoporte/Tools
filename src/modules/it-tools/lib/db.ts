/**
 * @fileoverview Server-side functions for the new IT Tools module database.
 * This file handles all direct interactions with the `it_tools.db` SQLite database.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { ITNote } from '@/modules/core/types';

const IT_TOOLS_DB_FILE = 'it_tools.db';

export async function initializeItToolsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS it_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            tags TEXT,
            linkedModule TEXT,
            createdBy TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS it_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);
    console.log(`Database ${IT_TOOLS_DB_FILE} initialized for IT Tools module.`);
}

export async function runItToolsMigrations(db: import('better-sqlite3').Database) {
    // Placeholder for future migrations.
}

export async function getNotes(): Promise<ITNote[]> {
    const db = await connectDb(IT_TOOLS_DB_FILE);
    const notes = db.prepare('SELECT * FROM it_notes ORDER BY updatedAt DESC').all() as ITNote[];
    return JSON.parse(JSON.stringify(notes));
}

export async function saveNote(note: Omit<ITNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Promise<ITNote> {
    const db = await connectDb(IT_TOOLS_DB_FILE);
    const now = new Date().toISOString();

    if (note.id) { // Update
        db.prepare(
            'UPDATE it_notes SET title = ?, content = ?, linkedModule = ?, updatedAt = ? WHERE id = ?'
        ).run(note.title, note.content, note.linkedModule || null, now, note.id);
        const updatedNote = db.prepare('SELECT * FROM it_notes WHERE id = ?').get(note.id) as ITNote;
        return updatedNote;
    } else { // Create
        const info = db.prepare(
            'INSERT INTO it_notes (title, content, linkedModule, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(note.title, note.content, note.linkedModule || null, note.createdBy, now, now);
        const newNote = db.prepare('SELECT * FROM it_notes WHERE id = ?').get(info.lastInsertRowid) as ITNote;
        return newNote;
    }
}

export async function deleteNote(id: number): Promise<void> {
    const db = await connectDb(IT_TOOLS_DB_FILE);
    db.prepare('DELETE FROM it_notes WHERE id = ?').run(id);
}
