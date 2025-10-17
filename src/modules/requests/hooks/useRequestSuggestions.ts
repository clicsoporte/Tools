/**
 * @fileoverview Hook to manage the logic for the purchase request suggestions page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getRequestSuggestions, savePurchaseRequest } from '@/modules/requests/lib/actions';
import type { Customer, DateRange, PurchaseRequest } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { subDays, startOfDay } from 'date-fns';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/modules/core/lib/excel-export';

export interface PurchaseSuggestion {
    itemId: string;
    itemDescription: string;
    itemClassification: string;
    totalRequired: number;
    currentStock: number;
    shortage: number;
    sourceOrders: string[];
    involvedClients: { id: string; name: string }[];
    earliestDueDate: string | null;
}

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    dateRange: DateRange;
    suggestions: PurchaseSuggestion[];
    selectedItems: Set<string>;
    searchTerm: string;
    classificationFilter: string[];
}

export function useRequestSuggestions() {
    const { isAuthorized } = useAuthorization(['requests:create', 'analytics:purchase-suggestions:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, products } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: false,
        isSubmitting: false,
        dateRange: {
            from: startOfDay(subDays(new Date(), 15)),
            to: startOfDay(new Date()),
        },
        suggestions: [],
        selectedItems: new Set(),
        searchTerm: '',
        classificationFilter: [],
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 500);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const handleAnalyze = useCallback(async () => {
        updateState({ isLoading: true, suggestions: [], selectedItems: new Set() });
        try {
            if (!state.dateRange.from) {
                toast({ title: "Fecha de inicio requerida", variant: "destructive" });
                return;
            }
            const data = await getRequestSuggestions(state.dateRange);
            updateState({ suggestions: data });
        } catch (error: any) {
            logError("Failed to get purchase suggestions", { error: error.message });
            toast({ title: "Error al Analizar", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.dateRange, toast, updateState]);
    
    useEffect(() => {
        setTitle("Sugerencias de Compra");
        if(isAuthorized) {
            handleAnalyze();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);

    const filteredSuggestions = useMemo(() => {
        return state.suggestions.filter(item => {
            const searchMatch = debouncedSearchTerm
                ? item.itemId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                  item.itemDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            const classificationMatch = state.classificationFilter.length === 0 || state.classificationFilter.includes(item.itemClassification);
            return searchMatch && classificationMatch;
        });
    }, [state.suggestions, debouncedSearchTerm, state.classificationFilter]);

    const toggleItemSelection = (itemId: string) => {
        updateState({
            selectedItems: new Set(
                state.selectedItems.has(itemId)
                    ? [...state.selectedItems].filter(id => id !== itemId)
                    : [...state.selectedItems, itemId]
            ),
        });
    };

    const toggleSelectAll = (checked: boolean) => {
        const itemsToSelect = filteredSuggestions.map(s => s.itemId);
        updateState({
            selectedItems: new Set(
                checked ? itemsToSelect : []
            ),
        });
    };
    
    const selectedSuggestions = useMemo(
        () => state.suggestions.filter(s => state.selectedItems.has(s.itemId)),
        [state.suggestions, state.selectedItems]
    );

    const handleCreateRequests = async () => {
        if (!currentUser) {
            toast({ title: "Error de autenticación", variant: "destructive" });
            return;
        }
        if (selectedSuggestions.length === 0) {
            toast({ title: "No hay artículos seleccionados", variant: "destructive" });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            let createdCount = 0;
            for (const item of selectedSuggestions) {
                 const requestPayload = {
                    requiredDate: item.earliestDueDate || new Date().toISOString().split('T')[0],
                    clientId: 'VAR-CLI', // Generic client
                    clientName: 'VARIOS CLIENTES',
                    clientTaxId: '',
                    itemId: item.itemId,
                    itemDescription: item.itemDescription,
                    quantity: item.shortage,
                    notes: `Sugerencia generada para pedidos: ${item.sourceOrders.join(', ')}`,
                    priority: 'medium' as const,
                    purchaseType: 'multiple' as const,
                    pendingAction: 'none' as const,
                };
                await savePurchaseRequest(requestPayload, currentUser.name);
                createdCount++;
            }
            toast({ title: "Solicitudes Creadas", description: `Se crearon ${createdCount} solicitudes de compra.` });
            await handleAnalyze();
        } catch (error: any) {
            logError("Failed to create requests from suggestions", { error: error.message });
            toast({ title: "Error al Crear", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleExportExcel = () => {
        const dataToExport = filteredSuggestions.map(item => [
            item.itemId,
            item.itemDescription,
            item.involvedClients.map(c => c.name).join(', '),
            item.earliestDueDate ? new Date(item.earliestDueDate).toLocaleDateString('es-CR') : 'N/A',
            item.totalRequired,
            item.currentStock,
            item.shortage,
        ]);

        exportToExcel({
            fileName: 'sugerencias_compra',
            sheetName: 'Sugerencias',
            headers: ['Código Artículo', 'Descripción', 'Clientes Involucrados', 'Próxima Entrega', 'Cant. Requerida', 'Inv. Actual', 'Faltante Total'],
            data: dataToExport,
            columnWidths: [20, 40, 30, 15, 15, 15, 15],
        });
    };
    
    const selectors = {
        filteredSuggestions,
        selectedSuggestions,
        areAllSelected: useMemo(() => {
            const filteredIds = new Set(filteredSuggestions.map(s => s.itemId));
            if (filteredIds.size === 0) return false;
            return [...filteredIds].every(id => state.selectedItems.has(id));
        }, [filteredSuggestions, state.selectedItems]),
        
        classifications: useMemo<string[]>(() => 
            Array.from(new Set(products.map(p => p.classification).filter(Boolean)))
        , [products]),
    };


    const actions = {
        setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined } }),
        handleAnalyze,
        toggleItemSelection,
        toggleSelectAll,
        handleCreateRequests,
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setClassificationFilter: (filter: string[]) => updateState({ classificationFilter: filter }),
        handleClearFilters: () => updateState({ searchTerm: '', classificationFilter: [] }),
        handleExportExcel,
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
    };
}
