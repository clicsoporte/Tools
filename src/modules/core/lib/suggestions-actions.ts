/**
 * @fileoverview Server Actions specifically for handling user suggestions.
 * This file isolates the database logic for suggestions to prevent bundling issues.
 */
"use server";

import { connectDb, getSuggestions as dbGetSuggestions, markSuggestionAsRead as dbMarkSuggestionAsRead, deleteSuggestion as dbDeleteSuggestion, getUnreadSuggestions as dbGetUnreadSuggestions } from './db';
import type { Suggestion } from '../types';
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
    revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Retrieves all suggestions from the database.
 * @returns {Promise<Suggestion[]>} A promise that resolves to an array of suggestion entries.
 */
export async function getSuggestions(): Promise<Suggestion[]> {
  return dbGetSuggestions();
}

/**
 * Marks a suggestion as read.
 * @param {number} id - The ID of the suggestion to mark as read.
 */
export async function markSuggestionAsRead(id: number): Promise<void> {
  await dbMarkSuggestionAsRead(id);
  revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Deletes a suggestion from the database.
 * @param {number} id - The ID of the suggestion to delete.
 */
export async function deleteSuggestion(id: number): Promise<void> {
  await dbDeleteSuggestion(id);
  revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Retrieves all unread suggestions from the database.
 * @returns {Promise<Suggestion[]>} A promise that resolves to an array of unread suggestion entries.
 */
export async function getUnreadSuggestions(): Promise<Suggestion[]> {
    return dbGetUnreadSuggestions();
}
