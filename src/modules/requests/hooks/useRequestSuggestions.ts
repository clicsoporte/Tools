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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';
import { cn } from '@/lib/utils';

export interface PurchaseSuggestion {
    itemId: string;
    itemDescription: string;
    itemClassification: string;
    totalRequired: number;
    currentStock: number;
    shortage: number;
    sourceOrders: string[];
    involvedClients: { id: string; name: string }[];
    erpUsers: string[];
    earliestDueDate: string | null;
}

const availableColumns = [
    { id: 'item', label: 'Artículo', tooltip: 'Código y descripción del artículo con faltante de inventario.' },
    { id: 'sourceOrders', label: 'Pedidos Origen', tooltip: 'Números de pedido del ERP que requieren este artículo.' },
    { id: 'clients', label: 'Clientes Involucrados', tooltip: 'Lista de todos los clientes de los pedidos analizados que están esperando este artículo.' },
    { id: 'erpUsers', label: 'Usuario ERP', tooltip: 'Usuario que creó el pedido en el sistema ERP.' },
    { id: 'dueDate', label: 'Próxima Entrega', tooltip: 'La fecha de entrega más cercana para este artículo entre todos los pedidos analizados.' },
    { id: 'required', label: 'Cant. Requerida', tooltip: 'La suma total de este artículo requerida para cumplir con todos los pedidos en el rango de fechas.', align: 'right' },
    { id: 'stock', label: 'Inv. Actual (ERP)', tooltip: 'La cantidad total de este artículo disponible en todas las bodegas según la última sincronización del ERP.', align: 'right' },
    { id: 'shortage', label: 'Faltante Total', tooltip: 'La cantidad que necesitas comprar para cubrir la demanda (Cant. Requerida - Inv. Actual).', align: 'right' },
];


interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    dateRange: DateRange;
    suggestions: PurchaseSuggestion[];
    selectedItems: Set<string>;
    searchTerm: string;
    classificationFilter: string[];
    visibleColumns: string[];
}

export function useRequestSuggestions() {
    const { isAuthorized } = useAuthorization(['requests:create', 'analytics:purchase-suggestions:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, products } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        dateRange: {
            from: startOfDay(subDays(new Date(), 15)),
            to: startOfDay(new Date()),
        },
        suggestions: [],
        selectedItems: new Set(),
        searchTerm: '',
        classificationFilter: [],
        visibleColumns: availableColumns.map(c => c.id),
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
            if (isInitialLoading) {
                setIsInitialLoading(false);
            }
        }
    }, [state.dateRange, toast, updateState, isInitialLoading]);
    
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

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        updateState({
            visibleColumns: checked
                ? [...state.visibleColumns, columnId]
                : state.visibleColumns.filter(id => id !== columnId)
        });
    };
    
    const getColumnContent = (item: PurchaseSuggestion, colId: string): { content: React.ReactNode, className?: string } => {
        switch (colId) {
            case 'item': return { content: <><p className="font-medium">{item.itemDescription}</p><p className="text-sm text-muted-foreground">{item.itemId}</p></> };
            case 'sourceOrders': return { content: <Tooltip><TooltipTrigger asChild><p className="text-xs text-muted-foreground truncate max-w-xs">{item.sourceOrders.join(', ')}</p></TooltipTrigger><TooltipContent><div className="max-w-md"><p className="font-bold mb-1">Pedidos de Origen:</p><p>{item.sourceOrders.join(', ')}</p></div></TooltipContent></Tooltip> };
            case 'clients': return { content: <p className="text-xs text-muted-foreground truncate max-w-xs" title={item.involvedClients.map(c => `${c.name} (${c.id})`).join(', ')}>{item.involvedClients.map(c => c.name).join(', ')}</p> };
            case 'erpUsers': return { content: <p className="text-xs text-muted-foreground">{item.erpUsers.join(', ')}</p> };
            case 'dueDate': return { content: item.earliestDueDate ? new Date(item.earliestDueDate).toLocaleDateString('es-CR') : 'N/A' };
            case 'required': return { content: item.totalRequired.toLocaleString(), className: 'text-right' };
            case 'stock': return { content: item.currentStock.toLocaleString(), className: 'text-right' };
            case 'shortage': return { content: item.shortage.toLocaleString(), className: 'text-right font-bold text-red-600' };
            default: return { content: '' };
        }
    };
    
    const visibleColumnsData = useMemo(() => {
        return state.visibleColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean) as (typeof availableColumns)[0][];
    }, [state.visibleColumns]);
    
    const handleExportExcel = () => {
        const headers = visibleColumnsData.map(col => col.label);
        const dataToExport = filteredSuggestions.map(item =>
            state.visibleColumns.map(colId => {
                 const colContent = getColumnContent(item, colId).content;
                if (React.isValidElement(colContent) && colId === 'item') {
                    return `${item.itemDescription} (${item.itemId})`;
                }
                if (colId === 'sourceOrders') return item.sourceOrders.join(', ');
                if (colId === 'clients') return item.involvedClients.map(c => c.name).join(', ');
                if (colId === 'erpUsers') return item.erpUsers.join(', ');
                return colContent?.toString() || '';
            })
        );

        exportToExcel({
            fileName: 'sugerencias_compra',
            sheetName: 'Sugerencias',
            headers,
            data: dataToExport,
            columnWidths: state.visibleColumns.map(id => {
                switch(id) {
                    case 'item': return 40;
                    case 'sourceOrders': return 25;
                    case 'clients': return 30;
                    case 'erpUsers': return 20;
                    default: return 15;
                }
            })
        });
    };
    
    const selectors = {
        filteredSuggestions,
        selectedSuggestions,
        areAllSelected: useMemo(() => {
            if (filteredSuggestions.length === 0) return false;
            return filteredSuggestions.every(s => state.selectedItems.has(s.itemId));
        }, [filteredSuggestions, state.selectedItems]),
        
        classifications: useMemo<string[]>(() => 
            Array.from(new Set(products.map(p => p.classification).filter(Boolean)))
        , [products]),
        availableColumns,
        visibleColumnsData,
        getColumnContent
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
        handleColumnVisibilityChange,
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    };
}
