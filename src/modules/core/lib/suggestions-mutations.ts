/**
 * @fileoverview Server Actions for mutations (writes/updates) related to suggestions.
 * This file isolates functions that use `revalidatePath` to prevent bundling issues.
 */
"use server";

import { connectDb } from './db';
import { revalidatePath } from 'next/cache';
import { logInfo } from './logger';

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
    await logInfo('New suggestion submitted', { user: userName });
    // Revalidate the admin page to show the new suggestion immediately.
    revalidatePath('/dashboard/admin/suggestions');
}
