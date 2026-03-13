/**
 * @fileoverview Hook for the new dedicated Warehouse Cleanup Tool.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { 
    getLocations, 
    getAllItemLocations, 
    getWarehouseSettings,
    unassignMultipleItemsFromLocation,
} from '@/modules/warehouse/lib/actions';
import type { WarehouseLocation, ItemLocation, Product } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';

const renderLocationPathAsString = (locationId: number, locations: WarehouseLocation[]): string => {
    if (!locationId) return '';
    const path: WarehouseLocation[] = [];
    let current: WarehouseLocation | undefined = locations.find(l => l.id === locationId);
    while (current) {
        path.unshift(current);
        const parentId = current.parentId;
        if (!parentId) break;
        current = locations.find(l => l.id === parentId);
    }
    return path.map(l => l.name).join(' > ');
};

type CleanupMode = 'product' | 'location' | 'rack' | 'level';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    mode: CleanupMode;
    searchTerm: string;
    isSearchOpen: boolean;
    selectedItemId: string | null;
    allLocations: WarehouseLocation[];
    allAssignments: ItemLocation[];
    searchResults: (ItemLocation & { productName: string; locationPath: string })[];
    selectedAssignmentIds: Set<number>;
    isConfirmOpen: boolean;
}

export function useCleanupTool() {
    useAuthorization(['warehouse:cleanup:execute']);
    usePageTitle().setTitle("Herramientas de Limpieza");
    const { toast } = useToast();
    const { user, products } = useAuth();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        mode: 'product',
        searchTerm: '',
        isSearchOpen: false,
        selectedItemId: null,
        allLocations: [],
        allAssignments: [],
        searchResults: [],
        selectedAssignmentIds: new Set(),
        isConfirmOpen: false,
    });
    
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [locs, assigns] = await Promise.all([getLocations(), getAllItemLocations()]);
            updateState({ allLocations: locs, allAssignments: assigns, isLoading: false });
        } catch (error: any) {
            logError("Error loading data for Cleanup Tool", { error: error.message });
            updateState({ isLoading: false });
        }
    }, [updateState]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const setMode = (newMode: CleanupMode) => {
        updateState({
            mode: newMode,
            searchTerm: '',
            selectedItemId: null,
            searchResults: [],
            selectedAssignmentIds: new Set(),
        });
    };

    const handleSelect = (value: string) => {
        updateState({ selectedItemId: value, isSearchOpen: false });
        const selectedOption = selectors.searchOptions.find(opt => opt.value === value);
        if (selectedOption) {
            updateState({ searchTerm: selectedOption.label });
        }
    };

    const handleSearch = () => {
        if (!state.selectedItemId) {
            toast({ title: 'Selección requerida', description: 'Por favor, selecciona un ítem de la lista para buscar.', variant: 'destructive' });
            return;
        }

        const id = state.selectedItemId;
        let foundAssignments: ItemLocation[] = [];
        
        switch (state.mode) {
            case 'product':
                foundAssignments = state.allAssignments.filter(a => a.itemId === id);
                break;
            case 'location':
                foundAssignments = state.allAssignments.filter(a => a.locationId === Number(id));
                break;
            case 'rack':
                const rackChildren = getChildrenRecursive(Number(id));
                foundAssignments = state.allAssignments.filter(a => rackChildren.has(a.locationId));
                break;
            case 'level':
                const levelChildren = getChildrenRecursive(Number(id));
                foundAssignments = state.allAssignments.filter(a => levelChildren.has(a.locationId));
                break;
        }
        
        const enrichedResults = foundAssignments.map(a => ({
            ...a,
            productName: products.find(p => p.id === a.itemId)?.description || a.itemId,
            locationPath: renderLocationPathAsString(a.locationId, state.allLocations),
        }));
        
        updateState({ searchResults: enrichedResults, selectedAssignmentIds: new Set() });
    };

    const handleToggleSelection = (assignmentId: number) => {
        const newSet = new Set(state.selectedAssignmentIds);
        if (newSet.has(assignmentId)) {
            newSet.delete(assignmentId);
        } else {
            newSet.add(assignmentId);
        }
        updateState({ selectedAssignmentIds: newSet });
    };

    const handleSelectAll = (isChecked: boolean) => {
        if (isChecked) {
            updateState({ selectedAssignmentIds: new Set(state.searchResults.map(r => r.id)) });
        } else {
            updateState({ selectedAssignmentIds: new Set() });
        }
    };

    const handleConfirmCleanup = async () => {
        if (!user || state.selectedAssignmentIds.size === 0) return;
        updateState({ isSubmitting: true });
        
        try {
            await unassignMultipleItemsFromLocation(Array.from(state.selectedAssignmentIds), user.name);
            toast({ title: "Limpieza Exitosa", description: `${state.selectedAssignmentIds.size} asignacion(es) han sido eliminadas.` });
            updateState({ isConfirmOpen: false, searchResults: [], selectedAssignmentIds: new Set() });
            await loadData();
        } catch (error: any) {
            logError("Failed to perform cleanup", { error: error.message });
            toast({ title: "Error en la Limpieza", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const getChildrenRecursive = (parentId: number): Set<number> => {
        const descendants = new Set<number>();
        const queue: number[] = [parentId];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (descendants.has(currentId)) continue;
            descendants.add(currentId);
            const children = state.allLocations.filter(l => l.parentId === currentId).map(l => l.id);
            queue.push(...children);
        }
        return descendants;
    };
    
    const selectors = {
        searchOptions: useMemo(() => {
            const searchLower = debouncedSearchTerm.toLowerCase();
            if (searchLower.length < 2) return [];

            switch (state.mode) {
                case 'product':
                    return products
                        .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
                        .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
                case 'location':
                    return state.allLocations
                        .filter(l => !l.parentId || !state.allLocations.some(p => p.id === l.parentId)) // Leaf nodes
                        .filter(l => renderLocationPathAsString(l.id, state.allLocations).toLowerCase().includes(searchLower))
                        .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
                case 'rack':
                    return state.allLocations
                        .filter(l => l.type === 'rack' && (l.name.toLowerCase().includes(searchLower) || l.code.toLowerCase().includes(searchLower)))
                        .map(l => ({ value: String(l.id), label: `${l.name} (${l.code})` }));
                case 'level':
                    return state.allLocations
                        .filter(l => l.type === 'shelf' && renderLocationPathAsString(l.id, state.allLocations).toLowerCase().includes(searchLower))
                         .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
                default: return [];
            }
        }, [state.mode, debouncedSearchTerm, products, state.allLocations]),
        searchPlaceholder: useMemo(() => {
            switch(state.mode) {
                case 'product': return 'Buscar por código o descripción de producto...';
                case 'location': return 'Buscar por ubicación final...';
                case 'rack': return 'Buscar por nombre o código de rack...';
                case 'level': return 'Buscar por nombre de nivel...';
            }
        }, [state.mode]),
        getCleanupTitle: () => {
            const selectedOption = selectors.searchOptions.find(opt => opt.value === state.selectedItemId);
            return selectedOption?.label || state.searchTerm;
        },
        areAllSelected: state.searchResults.length > 0 && state.selectedAssignmentIds.size === state.searchResults.length,
    };

    const actions = {
        setMode,
        setSearchTerm: (term: string) => updateState({ searchTerm: term, selectedItemId: null }),
        setIsSearchOpen: (open: boolean) => updateState({ isSearchOpen: open }),
        handleSelect,
        handleSearch,
        handleToggleSelection,
        handleSelectAll,
        setIsConfirmOpen: (open: boolean) => updateState({ isConfirmOpen: open }),
        handleConfirmCleanup,
    };

    return { state, actions, selectors };
}
