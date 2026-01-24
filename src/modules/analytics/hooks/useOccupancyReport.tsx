/**
 * @fileoverview Hook to manage the logic for the Warehouse Occupancy Report page.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getOccupancyReportData } from '@/modules/analytics/lib/actions';
import type { UserPreferences } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/modules/core/lib/excel-export';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export type SortKey = 'locationPath' | 'status';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'Libre' | 'Ocupado' | 'Mixto';

export interface OccupancyReportRow {
    locationId: number;
    locationPath: string;
    status: 'Libre' | 'Ocupado' | 'Mixto';
    items: {
        productId: string;
        productDescription: string;
        classification: string;
        quantity: number | undefined;
    }[];
    clients: {
        clientId: string;
        clientName: string;
    }[];
}


const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

interface State {
    isLoading: boolean;
    data: OccupancyReportRow[];
    searchTerm: string;
    sortKey: SortKey;
    sortDirection: SortDirection;
    statusFilter: StatusFilter;
    classificationFilter: string[];
    clientFilter: string[];
    currentPage: number;
    rowsPerPage: number;
    visibleColumns: string[];
    hasRun: boolean; // To track if the report has been generated at least once
}

export const useOccupancyReport = () => {
    const { isAuthorized } = useAuthorization(['analytics:occupancy-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, products } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: false,
        data: [],
        searchTerm: '',
        sortKey: 'locationPath',
        sortDirection: 'asc',
        statusFilter: 'all',
        classificationFilter: [],
        clientFilter: [],
        currentPage: 0,
        rowsPerPage: 25,
        visibleColumns: ['locationPath', 'status', 'items', 'clients'],
        hasRun: false,
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 500);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const fetchData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const data = await getOccupancyReportData();
            updateState({ data });
        } catch (error: any) {
            logError("Failed to fetch occupancy report data", { error: error.message });
            toast({ title: "Error al Generar Reporte", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false, hasRun: true });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        setTitle("Reporte de Ocupación de Almacén");
        const loadPrefs = async () => {
             if(user) {
                const prefs = await getUserPreferences(user.id, 'occupancyReportPrefs');
                if (prefs) {
                    updateState({ visibleColumns: prefs.visibleColumns || state.visibleColumns });
                }
            }
            setIsInitialLoading(false); // Preferences loaded, initial loading is done.
        };

        if (isAuthorized) {
            loadPrefs();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized, user?.id]);


    const filteredData = useMemo(() => {
        let filtered = [...state.data];

        if (state.statusFilter !== 'all') {
            filtered = filtered.filter(item => item.status === state.statusFilter);
        }

        if (state.classificationFilter.length > 0) {
            filtered = filtered.filter(item => item.items.some(prod => state.classificationFilter.includes(prod.classification)));
        }
        
        if (state.clientFilter.length > 0) {
            filtered = filtered.filter(item => item.clients.some(client => state.clientFilter.includes(client.clientId)));
        }

        if (debouncedSearchTerm) {
            const searchLower = normalizeText(debouncedSearchTerm);
            filtered = filtered.filter(item => {
                const itemText = item.items.map(i => `${i.productId} ${i.productDescription}`).join(' ');
                const clientText = item.clients.map(c => c.clientName).join(' ');
                const fullText = `${item.locationPath} ${itemText} ${clientText}`;
                return normalizeText(fullText).includes(searchLower);
            });
        }
        
        filtered.sort((a, b) => {
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            const valA = a[state.sortKey] || '';
            const valB = b[state.sortKey] || '';
            return valA.localeCompare(valB, 'es', { numeric: true }) * dir;
        });

        return filtered;
    }, [state.data, debouncedSearchTerm, state.statusFilter, state.classificationFilter, state.clientFilter, state.sortKey, state.sortDirection]);
    
    const paginatedData = useMemo(() => {
        const start = state.currentPage * state.rowsPerPage;
        const end = start + state.rowsPerPage;
        return filteredData.slice(start, end);
    }, [filteredData, state.currentPage, state.rowsPerPage]);

    const handleSort = (key: SortKey) => {
        updateState({ sortKey: key, sortDirection: state.sortKey === key && state.sortDirection === 'asc' ? 'desc' : 'asc' });
    };

    const savePreferences = async () => {
        if (!user) return;
        try {
            const prefs: Partial<UserPreferences> = { visibleColumns: state.visibleColumns };
            await saveUserPreferences(user.id, 'occupancyReportPrefs', prefs);
            toast({ title: 'Preferencias Guardadas' });
        } catch (error: any) {
            logError('Failed to save preferences for occupancy report', { error: error.message });
            toast({ title: 'Error', description: 'No se pudieron guardar las preferencias.', variant: 'destructive' });
        }
    };
    
     const handleExportExcel = () => {
        const headers = ["Ubicación", "Estado", "Artículos", "Clientes"];
        const dataToExport = filteredData.map(item => [
            item.locationPath,
            item.status,
            item.items.map(i => `${i.productDescription} (${i.productId}) ${i.quantity !== undefined ? `[${i.quantity}]` : ''}`).join(', '),
            item.clients.map(c => c.clientName).join(', '),
        ]);
        exportToExcel({
            fileName: 'reporte_ocupacion_almacen',
            sheetName: 'Ocupacion',
            headers,
            data: dataToExport,
            columnWidths: [50, 15, 60, 40],
        });
    };

    return {
        state,
        actions: {
            fetchData,
            setSearchTerm: (term: string) => updateState({ searchTerm: term, currentPage: 0 }),
            handleSort,
            handleExportExcel,
            setStatusFilter: (filter: StatusFilter) => updateState({ statusFilter: filter, currentPage: 0 }),
            setClassificationFilter: (filter: string[]) => updateState({ classificationFilter: filter, currentPage: 0 }),
            setClientFilter: (filter: string[]) => updateState({ clientFilter: filter, currentPage: 0 }),
            setCurrentPage: (page: number) => updateState({ currentPage: page }),
            setRowsPerPage: (size: number) => updateState({ rowsPerPage: size, currentPage: 0 }),
            handleColumnVisibilityChange: (columnId: string, checked: boolean) => updateState({ visibleColumns: checked ? [...state.visibleColumns, columnId] : state.visibleColumns.filter(id => id !== columnId) }),
            savePreferences,
            handleClearFilters: () => updateState({
                searchTerm: '',
                statusFilter: 'all',
                classificationFilter: [],
                clientFilter: [],
                currentPage: 0,
            }),
        },
        selectors: {
            filteredData,
            paginatedData,
            totalPages: Math.ceil(filteredData.length / state.rowsPerPage),
            classifications: useMemo(() => Array.from(new Set(products.map(p => p.classification).filter(Boolean))), [products]),
            clients: useMemo(() => {
                const allClientsInReport = new Map<string, { id: string, name: string }>();
                state.data.forEach(row => {
                    row.clients.forEach(client => {
                        if (!allClientsInReport.has(client.clientId)) {
                            allClientsInReport.set(client.clientId, { id: client.clientId, name: client.clientName });
                        }
                    });
                });
                return Array.from(allClientsInReport.values());
            }, [state.data]),
            availableColumns: [
                { id: 'locationPath', label: 'Ubicación', sortable: true },
                { id: 'status', label: 'Estado', sortable: true },
                { id: 'items', label: 'Artículos' },
                { id: 'clients', label: 'Clientes Asignados' },
            ],
            visibleColumnsData: useMemo(() => state.visibleColumns.map(id => ({ id, label: ({
                'locationPath': 'Ubicación',
                'status': 'Estado',
                'items': 'Artículos',
                'clients': 'Clientes Asignados'
            })[id] || id })).filter(Boolean), [state.visibleColumns]),
            renderCellContent: (item: OccupancyReportRow, colId: string): { content: React.ReactNode, className?: string } => {
                switch(colId) {
                    case 'locationPath': return { content: item.locationPath };
                    case 'status': return { content: <Badge variant={item.status === 'Libre' ? 'secondary' : (item.status === 'Ocupado' ? 'default' : 'destructive')}>{item.status}</Badge> };
                    case 'items':
                        if (item.items.length === 0) return { content: <span className="text-muted-foreground">-</span> };
                        const firstItem = item.items[0];
                        const content = (
                            <div className="flex items-center gap-2">
                                <span>{firstItem.productDescription} {firstItem.quantity !== undefined && `(${firstItem.quantity})`}</span>
                                {item.items.length > 1 && <Badge variant="outline">{`+${item.items.length - 1}`}</Badge>}
                            </div>
                        );
                        return { content: item.status === 'Mixto' ? <div className="flex items-center gap-1">{content}<Info className="h-3 w-3 text-muted-foreground"/></div> : content };
                    case 'clients':
                        if (item.clients.length === 0) return { content: <span className="text-muted-foreground">Venta General</span> };
                        const firstClient = item.clients[0];
                        return { content: <>{firstClient.clientName}{item.clients.length > 1 && <Badge variant="outline" className="ml-2">{`+${item.clients.length-1}`}</Badge>}</> };
                    default: return { content: '' };
                }
            }
        },
        isAuthorized,
        isInitialLoading,
    };
};
