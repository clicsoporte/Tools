/**
 * @fileoverview Client-side functions for interacting with the IT Tools module's server-side DB functions.
 */
'use client';

import type { ITNote } from '@/modules/core/types';
import { getNotes as getNotesServer, saveNote as saveNoteServer, deleteNote as deleteNoteServer } from './db';
import { adminTools, analyticsTools, mainTools, warehouseTools, consignmentsTools, itTools } from '@/modules/core/lib/data';

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
    // Combine all tool lists to get a comprehensive list of modules & sub-modules
    const allTools = [
        ...mainTools,
        ...adminTools,
        ...analyticsTools,
        ...warehouseTools,
        ...consignmentsTools,
        ...itTools
    ];

    // Define IDs for top-level container pages that we don't want to link to.
    const excludedIds = new Set([
        'help', 
        'it-tools', // Can't link a note to the module it's in
        'operations', // Module is under construction
        'warehouse', // It's a container, we have specific warehouse tools
        'consignments', // It's a container now too
    ]);
    
    const modulesMap = new Map<string, { id: string; name: string }>();

    allTools.forEach(tool => {
        // Use tool.id as the unique value and tool.name as the label.
        // The check for !modulesMap.has(tool.id) prevents duplicates.
        if (!excludedIds.has(tool.id) && !modulesMap.has(tool.id)) {
            modulesMap.set(tool.id, { id: tool.id, name: tool.name });
        }
    });
    
    const moduleList = Array.from(modulesMap.values());
    
    // Sort alphabetically by name for a user-friendly dropdown
    moduleList.sort((a, b) => a.name.localeCompare(b.name));
    
    return moduleList;
}
