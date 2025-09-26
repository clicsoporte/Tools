/**
 * @fileoverview Server Actions specifically for handling user suggestions.
 * This file isolates the database logic for suggestions to prevent bundling issues.
 */
"use server";

import { connectDb } from './db';

/**
 * Inserts a new suggestion into the database.
 * @param content - The text of the suggestion.
 * @param userId - The ID of the user submitting the suggestion.
 * @param userName - The name of the user submitting the suggestion.
 */
export async function addSuggestion(content: string, userId: number, userName: string): Promise<void> {
    const db = await connectDb();
    db.prepare('INSERT INTO suggestions (content, userId, userName, isRead, timestamp) VALUES (?, ?, ?, 0, ?)')
      .run(content, userId, userName, new Date().toISOString());
}
