/**
 * @fileoverview Hook to manage the logic for the purchase request suggestions page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getRequestSuggestions, savePurchaseRequest } from '@/modules/requests/lib/actions';
import type { DateRange } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { subDays, startOfDay } from 'date-fns';

export interface PurchaseSuggestion {
    itemId: string;
    itemDescription: string;
    totalRequired: number;
    currentStock: number;
    shortage: number;
    sourceOrders: string[];
}

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    dateRange: DateRange;
    suggestions: PurchaseSuggestion[];
    selectedItems: Set<string>;
}

export function useRequestSuggestions() {
    useAuthorization(['requests:create']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: false,
        isSubmitting: false,
        dateRange: {
            from: startOfDay(subDays(new Date(), 15)),
            to: startOfDay(new Date()),
        },
        suggestions: [],
        selectedItems: new Set(),
    });

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
        handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle]);

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
        updateState({
            selectedItems: new Set(
                checked ? state.suggestions.map(s => s.itemId) : []
            ),
        });
    };
    
    const selectedSuggestions = useMemo(
        () => state.suggestions.filter(s => state.selectedItems.has(s.itemId)),
        [state.suggestions, state.selectedItems]
    );

    const areAllSelected = useMemo(
        () => state.suggestions.length > 0 && selectedSuggestions.length === state.suggestions.length,
        [state.suggestions, selectedSuggestions]
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
                    requiredDate: new Date().toISOString().split('T')[0], // Default to today, can be improved
                    clientId: 'VAR-CLI', // Generic client
                    clientName: 'VARIOS CLIENTES',
                    clientTaxId: '',
                    itemId: item.itemId,
                    itemDescription: item.itemDescription,
                    quantity: item.shortage,
                    notes: `Sugerencia generada para pedidos: ${item.sourceOrders.join(', ')}`,
                    priority: 'medium' as const,
                    purchaseType: 'multiple' as const,
                };
                await savePurchaseRequest(requestPayload, currentUser.name);
                createdCount++;
            }
            toast({ title: "Solicitudes Creadas", description: `Se crearon ${createdCount} solicitudes de compra.` });
            // Re-analyze to clear created items
            await handleAnalyze();
        } catch (error: any) {
            logError("Failed to create requests from suggestions", { error: error.message });
            toast({ title: "Error al Crear", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };


    const actions = {
        setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined } }),
        handleAnalyze,
        toggleItemSelection,
        toggleSelectAll,
        handleCreateRequests,
    };
    
    const selectors = {
        areAllSelected,
        selectedSuggestions
    };

    return {
        state,
        actions,
        selectors,
    };
}
