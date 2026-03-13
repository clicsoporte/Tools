'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, getRacks, unassignAllByLocation, unassignAllByRack, unassignAllByLevel } from '@/modules/warehouse/lib/actions';
import type { WarehouseLocation, ItemLocation, Product } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

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

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

type State = {
    isLoading: boolean;
    isSubmitting: boolean;
    allLocations: WarehouseLocation[];
    allAssignments: ItemLocation[];
    searchTerm: string;
    selectedRackId: number | null;
    selectedLevelId: number | null;
    highlightedPath: Set<number>;
};

export function useWarehouseExplorer() {
    useAuthorization(['warehouse:explorer:read']);
    const { toast } = useToast();
    const { user, products } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        allLocations: [],
        allAssignments: [],
        searchTerm: '',
        selectedRackId: null,
        selectedLevelId: null,
        highlightedPath: new Set(),
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [locs, assigns] = await Promise.all([
                getLocations(),
                (await import('@/modules/warehouse/lib/db')).getAllItemLocations(), // Direct import to avoid dependency issues if any
            ]);
            updateState({ allLocations: locs, allAssignments: assigns, isLoading: false });
        } catch (error: any) {
            logError("Error loading data for Warehouse Explorer", { error: error.message });
            toast({ title: "Error de Carga", variant: "destructive" });
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        loadData();
    }, [loadData]);
    
    useEffect(() => {
        if (!debouncedSearchTerm) {
            updateState({ highlightedPath: new Set() });
            return;
        }

        const searchLower = normalizeText(debouncedSearchTerm);
        const found = state.allLocations.find(l => normalizeText(l.name).includes(searchLower) || normalizeText(l.code).includes(searchLower));

        if (found) {
            const pathIds = new Set<number>();
            let current: WarehouseLocation | undefined = found;
            while(current) {
                pathIds.add(current.id);
                current = current.parentId ? state.allLocations.find(l => l.id === current.parentId) : undefined;
            }
            updateState({ highlightedPath: pathIds });
        } else {
            updateState({ highlightedPath: new Set() });
        }

    }, [debouncedSearchTerm, state.allLocations, updateState]);
    
    const selectRack = (rackId: number) => {
        updateState({ selectedRackId: rackId, selectedLevelId: null });
    };

    const selectLevel = (levelId: number) => {
        updateState({ selectedLevelId: levelId });
    };

    const racks = useMemo(() => {
        return state.allLocations.filter(l => l.type === 'rack').sort((a,b) => a.name.localeCompare(b.name));
    }, [state.allLocations]);

    const levels = useMemo(() => {
        if (!state.selectedRackId) return [];
        return state.allLocations.filter(l => l.parentId === state.selectedRackId).sort((a,b) => a.name.localeCompare(b.name));
    }, [state.allLocations, state.selectedRackId]);

    const getChildrenRecursive = useCallback((parentId: number): number[] => {
        const children = state.allLocations.filter(l => l.parentId === parentId).map(l => l.id);
        if (children.length === 0) return [parentId]; // It's a leaf node itself
        return children.flatMap(childId => getChildrenRecursive(childId));
    }, [state.allLocations]);

    const details = useMemo(() => {
        let targetId = state.selectedLevelId || state.selectedRackId;
        if (!targetId) {
            return { title: 'Explorador de Almacén', description: 'Selecciona un rack para empezar.', items: [], emptyLocations: [] };
        }

        const targetNode = state.allLocations.find(l => l.id === targetId);
        if (!targetNode) return { title: 'Error', description: 'Ubicación no encontrada', items: [], emptyLocations: [] };

        const allDescendantIds = getChildrenRecursive(targetId);
        const leafNodeIds = allDescendantIds.filter(id => !state.allLocations.some(l => l.parentId === id));

        const assignedLocationIds = new Set<number>();
        const items = state.allAssignments
            .filter(a => leafNodeIds.includes(a.locationId))
            .map(a => {
                assignedLocationIds.add(a.locationId);
                const product = products.find(p => p.id === a.itemId);
                return {
                    productName: product?.description || a.itemId,
                    locationPath: renderLocationPathAsString(a.locationId, state.allLocations),
                };
            });
            
        const emptyLocations = leafNodeIds
            .filter(id => !assignedLocationIds.has(id))
            .map(id => {
                const location = state.allLocations.find(l => l.id === id);
                return { id, path: location ? renderLocationPathAsString(id, state.allLocations) : 'N/A' };
            });

        return {
            title: targetNode.name,
            description: `Contenido de ${targetNode.code}`,
            items,
            emptyLocations
        };
    }, [state.selectedRackId, state.selectedLevelId, state.allLocations, state.allAssignments, products, getChildrenRecursive]);
    
    const handleCleanup = async () => {
        if (!user) return;
        const targetId = state.selectedLevelId || state.selectedRackId;
        if (!targetId) {
            toast({ title: 'Ninguna selección', description: 'Debes seleccionar un rack o nivel para limpiar.', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            const cleanupFunction = state.selectedLevelId ? unassignAllByLevel : unassignAllByRack;
            await cleanupFunction(targetId, user.name);
            toast({ title: "Limpieza Completada", description: `Se han eliminado todas las asignaciones para la selección.` });
            await loadData(); // Reload all data
        } catch (error: any) {
            logError("Failed to perform cleanup from explorer", { error: error.message, targetId });
            toast({ title: "Error en la Limpieza", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    return {
        state,
        actions: {
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            selectRack,
            selectLevel,
            handleCleanup,
        },
        selectors: {
            racks,
            levels,
            details,
            isHighlighted: (locationId: number) => state.highlightedPath.has(locationId),
        }
    };
}
