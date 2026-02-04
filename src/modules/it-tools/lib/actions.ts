/**
 * @fileoverview Client-side functions for interacting with the IT Tools module's server-side DB functions.
 */
'use client';

import type { ITNote } from '@/modules/core/types';
import { getNotes as getNotesServer, saveNote as saveNoteServer, deleteNote as deleteNoteServer } from './db';
import { getDbModules } from '@/modules/core/lib/db';

export async function getNotes(): Promise<ITNote[]> {
    return getNotesServer();
}

export async function saveNote(note: Omit<ITNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Promise<ITNote> {
    return saveNoteServer(note);
}

export async function deleteNote(id: number): Promise<void> {
    return deleteNoteServer(id);
}

export async function getAvailableModules(): Promise<{ id: string, name: string }[]> {
    const modules = await getDbModules();
    // Filter out the main system DB as it's not a "module" in this context
    return modules.filter(m => m.id !== 'clic-tools-main').map(m => ({ id: m.id, name: m.name }));
}
