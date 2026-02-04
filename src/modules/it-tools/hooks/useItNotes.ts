/**
 * @fileoverview Hook for managing the state and logic of the IT Notes page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getNotes, saveNote, deleteNote, getAvailableModules } from '../lib/actions';
import type { ITNote } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

const emptyNote = { title: '', content: '', linkedModule: 'none' };

export const useItNotes = () => {
    const { isAuthorized } = useAuthorization(['it-tools:access']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, companyData } = useAuth();
    
    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        isFormOpen: false,
        notes: [] as ITNote[],
        moduleOptions: [] as { value: string, label: string }[],
        searchTerm: '',
        moduleFilter: 'all',
        noteToEdit: null as ITNote | null,
        noteToDelete: null as ITNote | null,
        currentTitle: '',
        currentContent: '',
        currentLinkedModule: 'none',
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 300);

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadInitialData = useCallback(async () => {
        try {
            const [notesData, modulesData] = await Promise.all([getNotes(), getAvailableModules()]);
            updateState({ 
                notes: notesData, 
                moduleOptions: modulesData.map(m => ({ value: m.id, label: m.name })),
                isLoading: false 
            });
        } catch (error: any) {
            logError("Failed to load IT notes data", { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar las notas.", variant: "destructive" });
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        setTitle("Notas de TI");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [isAuthorized, setTitle, loadInitialData]);

    const openForm = (note: ITNote | null = null) => {
        if (note) {
            updateState({ 
                noteToEdit: note, 
                currentTitle: note.title,
                currentContent: note.content || '',
                currentLinkedModule: note.linkedModule || 'none',
                isFormOpen: true 
            });
        } else {
            updateState({ 
                noteToEdit: null, 
                currentTitle: '',
                currentContent: '',
                currentLinkedModule: 'none',
                isFormOpen: true 
            });
        }
    };

    const handleSave = async () => {
        if (!user || !state.currentTitle.trim()) {
            toast({ title: 'Título requerido', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            const payload: Omit<ITNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: number } = {
                title: state.currentTitle,
                content: state.currentContent,
                linkedModule: state.currentLinkedModule === 'none' ? null : state.currentLinkedModule,
                createdBy: user.name,
                ...(state.noteToEdit && { id: state.noteToEdit.id }),
            };
            const savedNote = await saveNote(payload);

            if (state.noteToEdit) {
                updateState({ notes: state.notes.map(n => n.id === savedNote.id ? savedNote : n) });
            } else {
                updateState({ notes: [savedNote, ...state.notes] });
            }
            
            toast({ title: 'Nota Guardada' });
            updateState({ isFormOpen: false });
        } catch (error: any) {
            logError('Failed to save IT note', { error: error.message });
            toast({ title: 'Error al Guardar', variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleDelete = async () => {
        if (!state.noteToDelete) return;
        updateState({ isSubmitting: true });
        try {
            await deleteNote(state.noteToDelete.id);
            updateState({ notes: state.notes.filter(n => n.id !== state.noteToDelete!.id), noteToDelete: null });
            toast({ title: 'Nota Eliminada', variant: 'destructive' });
        } catch (error: any) {
            logError('Failed to delete IT note', { error: error.message });
            toast({ title: 'Error al Eliminar', variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const filteredNotes = useMemo(() => {
        return state.notes.filter(note => {
            const matchesSearch = debouncedSearchTerm
                ? (note.title + ' ' + note.content).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            const matchesModule = state.moduleFilter === 'all'
                ? true
                : note.linkedModule === state.moduleFilter;
            return matchesSearch && matchesModule;
        });
    }, [state.notes, debouncedSearchTerm, state.moduleFilter]);

    const getModuleName = (moduleId: string) => {
        return state.moduleOptions.find(opt => opt.value === moduleId)?.label || moduleId;
    };

    return {
        state,
        actions: {
            openForm,
            handleSave,
            handleDelete,
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            setModuleFilter: (filter: string) => updateState({ moduleFilter: filter }),
            setIsFormOpen: (open: boolean) => updateState({ isFormOpen: open }),
            setNoteToDelete: (note: ITNote | null) => updateState({ noteToDelete: note }),
            setCurrentTitle: (title: string) => updateState({ currentTitle: title }),
            setCurrentContent: (content: string) => updateState({ currentContent: content }),
            setCurrentLinkedModule: (module: string) => updateState({ currentLinkedModule: module }),
            clearFilters: () => updateState({ searchTerm: '', moduleFilter: 'all' }),
        },
        selectors: {
            filteredNotes,
            getModuleName,
            moduleOptions: state.moduleOptions,
        }
    };
};
