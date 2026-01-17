/**
 * @fileoverview Hook to manage the logic for the new receiving report page.
 */
'use client';

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getReceivingReportData } from '@/modules/analytics/lib/actions';
import type { DateRange, InventoryUnit, Product, WarehouseLocation, UserPreferences } from '@/modules/core/types';
import { subDays, startOfDay, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDebounce } from 'use-debounce';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { exportToExcel } from '@/modules/core/lib/excel-export';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const availableColumns = [
    { id: 'receptionConsecutive', label: 'Consecutivo Ingreso' },
    { id: 'traceability', label: 'Trazabilidad Corrección' },
    { id: 'createdAt', label: 'Fecha' },
    { id: 'productId', label: 'Código Producto' },
    { id: 'productDescription', label: 'Descripción' },
    { id: 'humanReadableId', label: 'Nº Lote / ID' },
    { id: 'unitCode', label: 'ID Unidad' },
    { id: 'documentId', label: 'Documento' },
    { id: 'erpDocumentId', label: 'Documento ERP' },
    { id: 'locationPath', label: 'Ubicación' },
    { id: 'quantity', label: 'Cantidad' },
    { id: 'createdBy', label: 'Usuario' },
    { id: 'annulledBy', label: 'Anulado Por' },
    { id: 'annulledAt', label: 'Fecha Anulación' },
];

interface State {
    isLoading: boolean;
    data: InventoryUnit[];
    allLocations: WarehouseLocation[];
    dateRange: DateRange;
    searchTerm: string;
    userFilter: string[];
    locationFilter: string[];
    visibleColumns: string[];
}

export function useReceivingReport() {
    const { isAuthorized } = useAuthorization(['analytics:receiving-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData, user, products } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: true,
        data: [],
        allLocations: [],
        dateRange: {
            from: new Date(),
            to: new Date(),
        },
        searchTerm: '',
        userFilter: [],
        locationFilter: [],
        visibleColumns: ['receptionConsecutive', 'traceability', 'createdAt', 'productDescription', 'quantity', 'createdBy', 'annulledBy', 'annulledAt'],
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const fetchData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const data = await getReceivingReportData({ dateRange: state.dateRange });
            updateState({ 
                data: data.units, 
                allLocations: data.locations 
            });
        } catch (error: any) {
            logError("Failed to fetch receiving report data", { error: error.message });
            toast({ title: "Error al Generar Reporte", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.dateRange, toast, updateState]);
    
    useEffect(() => {
        setTitle("Reporte de Recepciones");
        const loadPrefsAndData = async () => {
             if(user) {
                const prefs = await getUserPreferences(user.id, 'receivingReportPrefs');
                if (prefs && prefs.visibleColumns) {
                    updateState({ visibleColumns: prefs.visibleColumns });
                }
            }
            await fetchData();
            setIsInitialLoading(false);
        }
        if (isAuthorized) {
            loadPrefsAndData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized, user?.id]);
    
    const getAllChildLocationIds = useCallback((locationId: number): number[] => {
        let children: number[] = [];
        const queue: number[] = [locationId];
        const processed = new Set<number>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (processed.has(currentId)) continue;
            
            children.push(currentId);
            processed.add(currentId);

            const directChildren = state.allLocations
                .filter(l => l.parentId === currentId)
                .map(l => l.id);
            queue.push(...directChildren);
        }
        return children;
    }, [state.allLocations]);

    const sortedData = useMemo(() => {
        let filtered = state.data;
        
        if (debouncedSearchTerm) {
            const searchLower = normalizeText(debouncedSearchTerm);
            filtered = filtered.filter(item => {
                const product = products.find(p => p.id === item.productId);
                return (
                    normalizeText(item.productId).includes(searchLower) ||
                    normalizeText(product?.description).includes(searchLower) ||
                    normalizeText(item.humanReadableId).includes(searchLower) ||
                    normalizeText(item.documentId).includes(searchLower) ||
                    normalizeText(item.erpDocumentId).includes(searchLower) ||
                    normalizeText(item.unitCode).includes(searchLower) ||
                    normalizeText(item.receptionConsecutive).includes(searchLower) ||
                    normalizeText(item.correctionConsecutive).includes(searchLower)
                );
            });
        }

        if (state.userFilter.length > 0) {
            filtered = filtered.filter(item => state.userFilter.includes(item.createdBy));
        }

        if (state.locationFilter.length > 0) {
            const targetLocationIds = new Set<number>();
            state.locationFilter.forEach(locIdStr => {
                getAllChildLocationIds(Number(locIdStr)).forEach(id => targetLocationIds.add(id));
            });
            filtered = filtered.filter(item => item.locationId && targetLocationIds.has(item.locationId));
        }

        return filtered.sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
    }, [state.data, debouncedSearchTerm, state.userFilter, state.locationFilter, products, getAllChildLocationIds]);

    const getLocationPath = useCallback((locationId: number | null): string => {
        if (!locationId) return 'N/A';
        
        const locationMap = new Map(state.allLocations.map(l => [l.id, l]));
        const path: string[] = [];
        let currentId: number | null = locationId;

        for (let i = 0; i < 10 && currentId !== null; i++) {
            const current = locationMap.get(currentId);
            if (current) {
                path.unshift(current.name);
                currentId = current.parentId ?? null;
            } else {
                break;
            }
        }
        return path.join(' > ');
    }, [state.allLocations]);

    const getProductDescription = useCallback((productId: string): string => {
        return products.find(p => p.id === productId)?.description || 'Producto Desconocido';
    }, [products]);
    
    const handleSavePreferences = async () => {
        if (!user) return;
        try {
            await saveUserPreferences(user.id, 'receivingReportPrefs', { visibleColumns: state.visibleColumns });
            toast({ title: "Preferencias Guardadas" });
        } catch (error: any) {
            logError('Failed to save receiving report preferences', { error: error.message });
            toast({ title: 'Error', description: 'No se pudieron guardar las preferencias.', variant: 'destructive' });
        }
    };
    
    const handleExportExcel = () => {
        const headers = selectors.visibleColumnsData.map(c => c.label);
        const dataToExport = sortedData.map(item =>
            selectors.visibleColumnsData.map(col => {
                const { content, type } = selectors.getColumnContent(item, col.id);
                if (type === 'badge') {
                    return content.text;
                }
                if (React.isValidElement(content)) {
                     const textContent = React.Children.toArray((content as React.ReactElement).props.children).join('').replace(/<[^>]*>?/gm, ' ');
                    return textContent;
                }
                return String(content ?? '');
            })
        );
        exportToExcel({
            fileName: 'reporte_recepciones',
            sheetName: 'Recepciones',
            headers,
            data: dataToExport,
        });
    };
    
    const handleExportPDF = () => {
         if (!companyData) return;
        const tableHeaders = selectors.visibleColumnsData.map(c => c.label);
        const tableRows = sortedData.map(item => 
            selectors.visibleColumnsData.map(col => {
                const { content, type } = selectors.getColumnContent(item, col.id);
                if (type === 'badge') {
                    return content.text;
                }
                if (React.isValidElement(content)) {
                    return React.Children.toArray((content as React.ReactElement).props.children).join('').replace(/<[^>]*>?/gm, ' ');
                }
                return String(content ?? '');
            })
        );
        const doc = generateDocument({
            docTitle: "Reporte de Recepciones y Movimientos", docId: '', companyData,
            meta: [{ label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') }],
            blocks: [],
            table: { columns: tableHeaders, rows: tableRows },
            totals: [], orientation: 'landscape'
        });
        doc.save('reporte_recepciones.pdf');
    };

    const selectors = {
        sortedData,
        userOptions: useMemo(() => Array.from(new Set(state.data.map(item => item.createdBy))).map(u => ({ value: u, label: u })), [state.data]),
        locationOptions: useMemo(() => state.allLocations.map(l => ({ value: String(l.id), label: getLocationPath(l.id) })), [state.allLocations, getLocationPath]),
        getProductDescription,
        getLocationPath,
        availableColumns,
        visibleColumnsData: useMemo(() => state.visibleColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean) as (typeof availableColumns)[0][], [state.visibleColumns]),
        getColumnContent: (item: InventoryUnit, colId: string): { content: any, className?: string, type?: string } => {
            switch (colId) {
                case 'receptionConsecutive': return { type: 'string', content: item.receptionConsecutive || 'N/A' };
                case 'createdAt': return { type: 'string', content: format(parseISO(item.createdAt), 'dd/MM/yy HH:mm'), className: "text-xs text-muted-foreground" };
                case 'productId': return { type: 'string', content: item.productId };
                case 'productDescription': return { type: 'string', content: getProductDescription(item.productId) };
                case 'humanReadableId': return { type: 'string', content: item.humanReadableId || 'N/A', className: "font-mono" };
                case 'unitCode': return { type: 'string', content: item.unitCode, className: "font-mono text-xs" };
                case 'documentId': return { type: 'string', content: item.documentId || 'N/A' };
                case 'erpDocumentId': return { type: 'string', content: item.erpDocumentId || 'N/A' };
                case 'locationPath': return { type: 'string', content: getLocationPath(item.locationId), className: "text-xs" };
                case 'quantity': return { type: 'number', content: item.quantity, className: "font-bold" };
                case 'createdBy': return { content: item.createdBy, type: 'string' };
                case 'annulledBy': return { content: item.annulledBy || '', type: 'string' };
                case 'annulledAt': return { content: item.annulledAt ? format(parseISO(item.annulledAt), 'dd/MM/yy HH:mm') : '', type: 'string' };
                case 'traceability':
                    if (item.correctionConsecutive) {
                        const correctedUnit = state.data.find(u => u.correctedFromUnitId === item.id);
                        const replacementText = correctedUnit ? `Reemplazado por ${correctedUnit.receptionConsecutive}` : 'Anulado sin reemplazo';
                        return { type: 'badge', content: { variant: 'destructive', text: `${item.correctionConsecutive} (${replacementText})` } };
                    }
                    if (item.correctedFromUnitId) {
                        const original = state.data.find(u => u.id === item.correctedFromUnitId);
                        return { type: 'badge', content: { variant: 'outline', text: `Corrige a ${original?.receptionConsecutive || 'N/A'}` } };
                    }
                    return { type: 'string', content: 'N/A' };
                default: return { content: null, type: 'string' };
            }
        },
    };

    const actions = {
        fetchData,
        setDateRange: (range: DateRange | undefined) => {
            const from = range?.from;
            let to = range?.to || from;
            if (to) {
                to = new Date(to);
                to.setHours(23, 59, 59, 999);
            }
            updateState({ dateRange: { from, to } });
        },
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setUserFilter: (filter: string[]) => updateState({ userFilter: filter }),
        setLocationFilter: (filter: string[]) => updateState({ locationFilter: filter }),
        handleClearFilters: () => updateState({ searchTerm: '', userFilter: [], locationFilter: [], dateRange: { from: new Date(), to: new Date() } }),
        handleExportExcel,
        handleExportPDF,
        handleColumnVisibilityChange: (columnId: string, checked: boolean) => {
            updateState({ visibleColumns: checked ? [...state.visibleColumns, columnId] : state.visibleColumns.filter(id => id !== columnId) });
        },
        handleSavePreferences,
    };
    
    return {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    };
}
