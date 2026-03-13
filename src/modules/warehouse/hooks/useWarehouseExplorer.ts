
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, unassignMultipleItemsFromLocation } from '@/modules/warehouse/lib/actions';
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

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    allLocations: WarehouseLocation[];
    allAssignments: ItemLocation[];
    searchTerm: string;
    detailsSearchTerm: string;
    selectedBuildingId: number | null;
    selectedRackId: number | null;
    selectedLevelId: number | null;
    highlightedPath: Set<number>;
    selectedAssignmentIds: Set<number>;
}

export function useWarehouseExplorer() {
    useAuthorization(['warehouse:explorer:read']);
    usePageTitle().setTitle("Explorador de Almacén");
    const { toast } = useToast();
    const { user, products } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        allLocations: [],
        allAssignments: [],
        searchTerm: '',
        detailsSearchTerm: '',
        selectedBuildingId: null,
        selectedRackId: null,
        selectedLevelId: null,
        highlightedPath: new Set(),
        selectedAssignmentIds: new Set(),
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 300);
    const [debouncedDetailsSearchTerm] = useDebounce(state.detailsSearchTerm, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [locs, assigns] = await Promise.all([
                getLocations(),
                (await import('@/modules/warehouse/lib/db')).getAllItemLocations(),
            ]);
            updateState({ allLocations: locs, allAssignments: assigns, isLoading: false });
        } catch (error: any) {
            logError("Error loading data for Warehouse Explorer", { error: error.message });
            updateState({ isLoading: false });
        }
    }, [updateState]);
    
    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const getAncestors = useCallback((locationId: number): WarehouseLocation[] => {
        const ancestors: WarehouseLocation[] = [];
        let currentNode: WarehouseLocation | undefined = state.allLocations.find(l => l.id === locationId);
        while (currentNode) {
            ancestors.push(currentNode);
            const parentId = currentNode.parentId;
            if (parentId === null || parentId === undefined) {
                break;
            }
            currentNode = state.allLocations.find(l => l.id === parentId);
        }
        return ancestors;
    }, [state.allLocations]);

    useEffect(() => {
        if (!debouncedSearchTerm) {
            updateState({ highlightedPath: new Set() });
            return;
        }

        const searchLower = normalizeText(debouncedSearchTerm);
        const found = state.allLocations.find(l => normalizeText(l.name).includes(searchLower) || normalizeText(l.code).includes(searchLower));

        if (found) {
            const ancestors = getAncestors(found.id);
            const pathIds = new Set(ancestors.map(a => a.id));
            updateState({ highlightedPath: pathIds });
        } else {
            updateState({ highlightedPath: new Set() });
        }

    }, [debouncedSearchTerm, state.allLocations, updateState, getAncestors]);
    
    const selectBuilding = (buildingId: number) => {
        updateState({ selectedBuildingId: buildingId, selectedRackId: null, selectedLevelId: null });
    };

    const selectRack = (rackId: number) => {
        updateState({ selectedRackId: rackId, selectedLevelId: null });
    };

    const selectLevel = (levelId: number) => {
        updateState({ selectedLevelId: levelId });
    };
    
    const buildings = useMemo(() => {
        return state.allLocations.filter(l => l.parentId === null).sort((a,b) => a.name.localeCompare(b.name));
    }, [state.allLocations]);

    const racks = useMemo(() => {
        if (!state.selectedBuildingId) return [];
        return state.allLocations.filter(l => l.parentId === state.selectedBuildingId).sort((a,b) => a.name.localeCompare(b.name));
    }, [state.allLocations, state.selectedBuildingId]);

    const levels = useMemo(() => {
        if (!state.selectedRackId) return [];
        return state.allLocations.filter(l => l.parentId === state.selectedRackId).sort((a,b) => a.name.localeCompare(b.name));
    }, [state.allLocations, state.selectedRackId]);

    const getChildrenRecursive = useCallback((parentId: number): number[] => {
        const descendants: number[] = [];
        const queue: number[] = [parentId];
        const visited = new Set<number>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = state.allLocations.filter(l => l.parentId === currentId);

            if (children.length === 0) { // It's a leaf node
                descendants.push(currentId);
            } else {
                queue.push(...children.map(c => c.id));
            }
        }
        return descendants;
    }, [state.allLocations]);

    const details = useMemo(() => {
        const targetId = state.selectedLevelId || state.selectedRackId || state.selectedBuildingId;
        
        if (!targetId) {
            return { title: 'Explorador de Almacén', description: 'Selecciona una bodega o zona para empezar.', items: [], emptyLocations: [] };
        }

        const targetNode = state.allLocations.find(l => l.id === targetId);
        if (!targetNode) return { title: 'Error', description: 'Ubicación no encontrada', items: [], emptyLocations: [] };

        const leafNodeIds = getChildrenRecursive(targetId);

        const assignedLocationIds = new Set<number>();
        
        const allEnrichedAssignments = state.allAssignments
            .filter(a => a.locationId && leafNodeIds.includes(a.locationId))
            .map(a => {
                assignedLocationIds.add(a.locationId!);
                const product = products.find(p => p.id === a.itemId);
                return {
                    ...a,
                    productName: product?.description || a.itemId,
                    locationPath: renderLocationPathAsString(a.locationId, state.allLocations),
                };
            });
        
        const filteredItems = allEnrichedAssignments.filter(item => {
            if (!debouncedDetailsSearchTerm) return true;
            const searchLower = normalizeText(debouncedDetailsSearchTerm);
            return normalizeText(item.productName).includes(searchLower) || 
                   normalizeText(item.itemId).includes(searchLower) ||
                   normalizeText(item.locationPath).includes(searchLower);
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
            items: filteredItems,
            emptyLocations
        };
    }, [state.selectedBuildingId, state.selectedRackId, state.selectedLevelId, state.allLocations, state.allAssignments, products, getChildrenRecursive, debouncedDetailsSearchTerm]);
    
    const handleToggleAssignmentSelection = (assignmentId: number) => {
        updateState({
            selectedAssignmentIds: new Set(
                state.selectedAssignmentIds.has(assignmentId)
                    ? [...state.selectedAssignmentIds].filter(id => id !== assignmentId)
                    : [...state.selectedAssignmentIds, assignmentId]
            ),
        });
    };
    
    const handleSelectAllAssignments = (isChecked: boolean) => {
        if (isChecked) {
            updateState({ selectedAssignmentIds: new Set(details.items.map(i => i.id)) });
        } else {
            updateState({ selectedAssignmentIds: new Set() });
        }
    };

    const handleCleanup = async () => {
        if (!user || state.selectedAssignmentIds.size === 0) {
            toast({ title: 'Ninguna selección', description: 'Debes seleccionar al menos una asignación para limpiar.', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            await unassignMultipleItemsFromLocation(Array.from(state.selectedAssignmentIds), user.name);
            toast({ title: "Limpieza Exitosa", description: `${state.selectedAssignmentIds.size} asignacion(es) han sido eliminadas.` });
            await loadData();
            updateState({ selectedAssignmentIds: new Set() });
        } catch (error: any) {
            logError("Failed to perform cleanup from explorer", { error: error.message });
            toast({ title: "Error en la Limpieza", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const areAllSelected = useMemo(() => {
        return details.items.length > 0 && state.selectedAssignmentIds.size === details.items.length;
    }, [details.items, state.selectedAssignmentIds]);

    return {
        state,
        actions: {
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            setDetailsSearchTerm: (term: string) => updateState({ detailsSearchTerm: term }),
            selectBuilding,
            selectRack,
            selectLevel,
            handleCleanup,
            handleToggleAssignmentSelection,
            handleSelectAllAssignments,
        },
        selectors: {
            buildings,
            racks,
            levels,
            details,
            isHighlighted: (locationId: number) => state.highlightedPath.has(locationId),
            areAllSelected,
        }
    };
}
