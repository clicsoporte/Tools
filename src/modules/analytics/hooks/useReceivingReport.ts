/**
 * @fileoverview Hook to manage the logic for the physical inventory report page.
 */
'use client';

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getReceivingReportData } from '@/modules/analytics/lib/actions';
import type { InventoryUnit, DateRange, UserPreferences, WarehouseLocation, Company } from '@/modules/core/types';
import { exportToExcel } from '@/lib/excel-export';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDebounce } from 'use-debounce';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';
import { generateDocument } from '@/lib/pdf-generator';
import { cn } from '@/lib/utils';
import type { RowInput } from 'jspdf-autotable';


const availableColumns = [
    { id: 'status', label: 'Estado' },
    { id: 'receptionConsecutive', label: 'Consecutivo Ingreso' },
    { id: 'traceability', label: 'Trazabilidad' },
    { id: 'productDescription', label: 'Producto' },
    { id: 'humanReadableId', label: 'Nº Lote / ID' },
    { id: 'quantity', label: 'Cant.' },
    { id: 'createdBy', label: 'Recibido Por' },
    { id: 'createdAt', label: 'Fecha Ingreso' },
    { id: 'appliedBy', label: 'Aplicado Por' },
    { id: 'appliedAt', label: 'Fecha Aplicación' },
    { id: 'annulledBy', label: 'Anulado Por' },
    { id: 'annulledAt', label: 'Fecha Anulación' },
    { id: 'locationPath', label: 'Ubicación' },
];

const statusTranslations: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    applied: { label: 'Aplicado', variant: 'default' },
    voided: { label: 'Anulado', variant: 'destructive' },
};

const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
    const { user, products, companyData } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: false,
        data: [],
        allLocations: [],
        dateRange: { from: startOfDay(subDays(new Date(), 7)), to: new Date() },
        searchTerm: '',
        userFilter: [],
        locationFilter: [],
        visibleColumns: availableColumns.map(c => c.id),
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const fetchData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const { units, locations } = await getReceivingReportData({ dateRange: state.dateRange });
            updateState({ data: units, allLocations: locations });
        } catch (error: any) {
            logError("Failed to fetch receiving report data", { error: error.message });
            toast({ title: "Error al Generar Reporte", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.dateRange, toast, updateState]);
    
    const loadPrefs = useCallback(async () => {
        if(user) {
           const prefs = await getUserPreferences(user.id, 'receivingReportPrefs');
           if (prefs) {
               updateState({ visibleColumns: prefs.visibleColumns || availableColumns.map(c => c.id) });
           }
       }
       setIsInitialLoading(false);
   }, [user, updateState]);

    useEffect(() => {
        setTitle("Reporte de Recepciones y Movimientos");
        if (isAuthorized) {
            loadPrefs();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);

    const sortedData = useMemo(() => {
        let data = [...state.data];
        
        if (debouncedSearchTerm) {
            const searchLower = normalizeText(debouncedSearchTerm);
            data = data.filter(item => {
                const product = products.find(p => p.id === item.productId);
                const fullText = `${item.productId} ${product?.description || ''} ${item.humanReadableId || ''} ${item.documentId || ''} ${item.erpDocumentId || ''}`;
                return normalizeText(fullText).includes(searchLower);
            });
        }
        
        if (state.userFilter.length > 0) {
            data = data.filter(item => state.userFilter.includes(item.createdBy));
        }

        if (state.locationFilter.length > 0) {
            const locationIds = new Set(state.locationFilter.map(Number));
            data = data.filter(item => item.locationId !== null && locationIds.has(item.locationId));
        }
        
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return data;
    }, [state.data, debouncedSearchTerm, products, state.userFilter, state.locationFilter]);

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        updateState({
            visibleColumns: checked
                ? [...state.visibleColumns, columnId]
                : state.visibleColumns.filter(id => id !== columnId)
        });
    };
    
    const handleSavePreferences = async () => {
        if (!user) return;
        try {
            await saveUserPreferences(user.id, 'receivingReportPrefs', { visibleColumns: state.visibleColumns });
            toast({ title: 'Preferencias Guardadas' });
        } catch (error: any) {
            logError('Failed to save preferences for receiving report', { error: error.message });
            toast({ title: 'Error', description: 'No se pudieron guardar las preferencias.', variant: 'destructive' });
        }
    };
    
    const renderLocationPath = useCallback((locationId: number) => {
        const path: string[] = [];
        let current: WarehouseLocation | undefined = state.allLocations.find(l => l.id === locationId);
        while(current) {
            path.unshift(current.name);
            const parentId = current.parentId;
            if (!parentId) break;
            current = state.allLocations.find(l => l.id === current!.parentId);
        }
        return path.join(' > ');
    }, [state.allLocations]);

    const handleExportExcel = () => {
        const headers = ["Estado", "Consecutivo Ingreso", "Trazabilidad", "Producto", "Código", "Nº Lote", "Cantidad", "Usuario", "Fecha", "Notas"];
        const dataToExport = sortedData.map(item => [
            statusTranslations[item.status]?.label || item.status,
            item.receptionConsecutive,
            item.correctionConsecutive ? `${item.correctionConsecutive} (Anula ${item.receptionConsecutive})` : (item.correctedFromUnitId ? `Corrige a ${state.data.find(u => u.id === item.correctedFromUnitId)?.receptionConsecutive || 'N/A'}` : 'N/A'),
            products.find(p => p.id === item.productId)?.description || '',
            item.productId,
            item.humanReadableId,
            item.quantity,
            item.createdBy,
            format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm'),
            item.notes || ''
        ]);
        exportToExcel({ fileName: 'reporte_recepciones', sheetName: 'Recepciones', headers, data: dataToExport, columnWidths: [15, 20, 25, 40, 20, 20, 10, 20, 20, 40] });
    };

    const handleExportPDF = () => {
        if (!companyData) return;
        const tableHeaders = ["Consecutivo", "Producto", "Cantidad", "Usuario", "Fecha"];
        const tableRows: RowInput[] = sortedData.map(item => [
            item.receptionConsecutive || '',
            `${products.find(p => p.id === item.productId)?.description || ''}\n(${item.productId})`,
            item.quantity,
            item.createdBy,
            format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm'),
        ]);
        generateDocument({ docTitle: "Reporte de Recepciones", docId: '', companyData, meta: [{ label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') }], blocks: [], table: { columns: tableHeaders, rows: tableRows as RowInput[] }, totals: [] }).save('reporte_recepciones.pdf');
    };

    const actions = {
        fetchData,
        setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined } }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setUserFilter: (filter: string[]) => updateState({ userFilter: filter }),
        setLocationFilter: (filter: string[]) => updateState({ locationFilter: filter }),
        handleClearFilters: () => updateState({ searchTerm: '', userFilter: [], locationFilter: [] }),
        handleColumnVisibilityChange,
        handleSavePreferences,
        handleExportExcel,
        handleExportPDF,
    };
    
    const selectors = {
        sortedData,
        availableColumns,
        visibleColumnsData: useMemo(() => state.visibleColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean) as { id: string; label: string; }[], [state.visibleColumns]),
        userOptions: useMemo(() => Array.from(new Set(state.data.map(d => d.createdBy))).map(u => ({ value: u, label: u })), [state.data]),
        locationOptions: useMemo(() => state.allLocations.map(l => ({ value: String(l.id), label: renderLocationPath(l.id) })), [state.allLocations, renderLocationPath]),
        getColumnContent: (item: InventoryUnit, colId: string): { content: any; className?: string; type?: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' | undefined; } => {
             const statusInfo = statusTranslations[item.status] || { label: item.status, variant: 'outline' };
            switch (colId) {
                case 'status': return { type: 'badge', content: { text: statusInfo.label, variant: statusInfo.variant }, className: item.status === 'applied' ? 'bg-green-600' : '' };
                case 'receptionConsecutive': return { type: 'string', content: item.receptionConsecutive || 'N/A', className: "font-mono text-xs" };
                case 'productDescription': return { type: 'multiline', content: [ { text: products.find(p => p.id === item.productId)?.description || '' }, { text: item.productId, className: "text-xs text-muted-foreground" } ] };
                case 'quantity': return { type: 'string', content: item.quantity, className: 'font-bold' };
                case 'createdBy': return { type: 'string', content: item.createdBy };
                case 'createdAt': return { type: 'string', content: item.createdAt ? format(parseISO(item.createdAt), 'dd/MM/yy HH:mm') : '' };
                case 'appliedBy': return { type: 'string', content: item.appliedBy || '' };
                case 'appliedAt': return { type: 'string', content: item.appliedAt ? format(parseISO(item.appliedAt), 'dd/MM/yy HH:mm') : '' };
                case 'annulledBy': return { type: 'string', content: item.annulledBy || '' };
                case 'annulledAt': return { type: 'string', content: item.annulledAt ? format(parseISO(item.annulledAt), 'dd/MM/yy HH:mm') : '' };
                case 'locationPath': return { type: 'string', content: item.locationId ? renderLocationPath(item.locationId) : '', className: "text-xs" };
                case 'traceability':
                    if (item.correctionConsecutive) {
                        const correctedUnit = state.data.find(u => u.correctedFromUnitId === item.id);
                        const replacementText = correctedUnit ? `Reemplazado por ${correctedUnit.receptionConsecutive}` : 'Anulado sin reemplazo';
                        return {
                            type: 'badge',
                            content: { text: `${item.correctionConsecutive} (Anula ${item.receptionConsecutive})`, variant: 'destructive' }
                        };
                    }
                    if (item.correctedFromUnitId) {
                        const original = state.data.find(u => u.id === item.correctedFromUnitId);
                        return {
                            type: 'badge',
                            content: { text: `Corrige a ${original?.receptionConsecutive || 'N/A'}`, variant: 'outline' }
                        };
                    }
                    return { type: 'string', content: 'N/A' };
                default: return { type: 'string', content: (item as any)[colId] || '' };
            }
        }
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    };
}
