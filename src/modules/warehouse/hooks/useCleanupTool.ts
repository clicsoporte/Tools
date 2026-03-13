/**
 * @fileoverview Hook to manage state and logic for the dedicated Cleanup Tool page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, getSelectableLocations, unassignAllByProduct, unassignAllByLocation, unassignAllByRack, unassignAllByLevel, getWarehouseSettings } from '@/modules/warehouse/lib/actions';
import type { Product, WarehouseLocation, WarehouseSettings } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

type CleanupType = 'rack' | 'level' | 'location' | 'product';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    allLocations: WarehouseLocation[];
    selectableLocations: WarehouseLocation[];
    warehouseSettings: WarehouseSettings | null;
    cleanupType: CleanupType;
    searchTerm: string;
    isSearchOpen: boolean;
    selectedItem: { value: string; label: string } | null;
}

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

export function useCleanupTool() {
    const { isAuthorized } = useAuthorization(['warehouse:cleanup']);
    const { toast } = useToast();
    const { user, companyData, products: authProducts } = useAuth();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        allLocations: [],
        selectableLocations: [],
        warehouseSettings: null,
        cleanupType: 'rack',
        searchTerm: '',
        isSearchOpen: false,
        selectedItem: null,
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!isAuthorized) return;
            try {
                const [locs, settings] = await Promise.all([getLocations(), getWarehouseSettings()]);
                updateState({
                    allLocations: locs,
                    selectableLocations: getSelectableLocations(locs),
                    warehouseSettings: settings,
                });
            } catch (error: any) {
                logError("Failed to load data for cleanup tool", { error: error.message });
            } finally {
                updateState({ isLoading: false });
            }
        };
        loadInitialData();
    }, [isAuthorized, updateState]);
    
    const searchOptions = useMemo(() => {
        const searchLower = debouncedSearchTerm.toLowerCase();
        if (searchLower.length < 1 && searchLower !== '*') return [];
        
        switch (state.cleanupType) {
            case 'rack':
                return state.allLocations
                    .filter(l => l.type === 'rack' && (l.name.toLowerCase().includes(searchLower) || l.code.toLowerCase().includes(searchLower)))
                    .map(r => ({ value: String(r.id), label: `${r.name} (${r.code})` }));
            case 'level':
                const levelType = state.warehouseSettings?.locationLevels?.find(l => l.name.toLowerCase().includes('nivel') || l.name.toLowerCase().includes('estante'))?.type;
                if (!levelType) return [];
                return state.allLocations
                    .filter(l => l.type === levelType && renderLocationPathAsString(l.id, state.allLocations).toLowerCase().includes(searchLower))
                    .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
            case 'location':
                 if (searchLower === '*' || searchLower === '') {
                     return state.selectableLocations.map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
                 }
                return state.selectableLocations
                    .filter(l => renderLocationPathAsString(l.id, state.allLocations).toLowerCase().includes(searchLower))
                    .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
            case 'product':
                if (searchLower.length < 2) return [];
                return authProducts
                    .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
                    .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
            default:
                return [];
        }
    }, [state.cleanupType, state.allLocations, state.selectableLocations, state.warehouseSettings, authProducts, debouncedSearchTerm]);

    const handleCleanupTypeChange = (type: CleanupType) => {
        updateState({
            cleanupType: type,
            searchTerm: '',
            selectedItem: null,
            isSearchOpen: false,
        });
    };
    
    const handleItemSelect = (value: string) => {
        const selected = searchOptions.find(opt => opt.value === value);
        if (selected) {
            updateState({
                selectedItem: selected,
                searchTerm: selected.label,
                isSearchOpen: false,
            });
        }
    };
    
    const handleConfirmCleanup = async () => {
        if (!user || !state.cleanupType || !state.selectedItem) {
            toast({ title: 'Error', description: 'Selección inválida.', variant: 'destructive'});
            return;
        }
        updateState({ isSubmitting: true });
        
        const { cleanupType, selectedItem } = state;
        const id = (cleanupType === 'product') ? selectedItem.value : Number(selectedItem.value);

        try {
            switch(cleanupType) {
                case 'product': await unassignAllByProduct(id as string, user.name); break;
                case 'location': await unassignAllByLocation(id as number, user.name); break;
                case 'rack': await unassignAllByRack(id as number, user.name); break;
                case 'level': await unassignAllByLevel(id as number, user.name); break;
            }
            toast({ title: 'Limpieza Completada', description: `Se eliminaron las asignaciones para "${selectedItem.label}".` });
            updateState({ selectedItem: null, searchTerm: '' });
        } catch (error: any) {
            logError('Cleanup tool action failed', { error: error.message });
            toast({ title: 'Error en la Limpieza', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const getCleanupTitle = () => {
        switch (state.cleanupType) {
            case 'product': return 'Producto';
            case 'location': return 'Ubicación';
            case 'rack': return 'Rack';
            case 'level': return 'Nivel';
            default: return '';
        }
    };
    
    return {
        state,
        actions: {
            handleCleanupTypeChange,
            handleItemSelect,
            handleConfirmCleanup,
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            setIsSearchOpen: (open: boolean) => updateState({ isSearchOpen: open }),
        },
        selectors: {
            searchOptions,
            getCleanupTitle,
        },
        isAuthorized,
    };
}
