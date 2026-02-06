/**
 * @fileoverview Hook to manage the logic for the transits report page.
 */
'use client';

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getActiveTransitsReportData, getAnalyticsSettings } from '@/modules/analytics/lib/actions';
import type { DateRange, ErpPurchaseOrderLine, TransitStatusAlias, AnalyticsSettings } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { subDays, startOfDay, format, parseISO } from 'date-fns';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/modules/core/lib/excel-export';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';

export interface TransitReportItem extends ErpPurchaseOrderLine {
    FECHA_HORA: string;
    ESTADO: string;
    PROVEEDOR: string;
    CreatedBy?: string;
    proveedorName?: string;
    productDescription?: string;
    currentStock?: number;
}

export type SortKey = 'ordenCompra' | 'proveedor' | 'fecha' | 'cantidad' | 'articulo' | 'stock' | 'creadoPor';
export type SortDirection = 'asc' | 'desc';

const normalizeText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const availableColumns = [
    { id: 'ordenCompra', label: 'Nº OC', sortable: true },
    { id: 'proveedor', label: 'Proveedor', sortable: true },
    { id: 'fecha', label: 'Fecha', sortable: true },
    { id: 'estado', label: 'Estado', sortable: false },
    { id: 'articulo', label: 'Artículo', sortable: true },
    { id: 'cantidad', label: 'Cant. Pendiente', sortable: true, align: 'right' },
    { id: 'stock', label: 'Inv. Actual (ERP)', sortable: true, align: 'right' },
    { id: 'creadoPor', label: 'Creado por (ERP)', sortable: true },
];

interface State {
    isLoading: boolean;
    dateRange: DateRange;
    data: TransitReportItem[];
    searchTerm: string;
    supplierFilter: string[];
    statusFilter: string[];
    sortKey: SortKey;
    sortDirection: SortDirection;
    visibleColumns: string[];
    analyticsSettings: AnalyticsSettings | null;
}

export function useTransitsReport() {
    const { isAuthorized } = useAuthorization(['analytics:transits-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData, user } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: false,
        dateRange: {
            from: startOfDay(subDays(new Date(), 60)),
            to: new Date(),
        },
        data: [],
        searchTerm: '',
        supplierFilter: [],
        statusFilter: [],
        sortKey: 'fecha',
        sortDirection: 'desc',
        visibleColumns: availableColumns.map(c => c.id),
        analyticsSettings: null,
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, 500);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!isAuthorized) return;
        updateState({ isLoading: true });
        try {
            if (!state.dateRange.from) {
                toast({ title: "Fecha de inicio requerida", variant: "destructive" });
                return;
            }
            const reportData = await getActiveTransitsReportData({ dateRange: state.dateRange, statusFilter: state.statusFilter });
            updateState({ data: reportData });
        } catch (error: any) {
            logError("Failed to get transits report data", { error: error.message });
            toast({ title: "Error al Generar Reporte", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [isAuthorized, state.dateRange, state.statusFilter, toast, updateState]);
    
    const loadPrefsAndSettings = useCallback(async () => {
        if(user) {
            const [prefs, settings] = await Promise.all([
                getUserPreferences(user.id, 'transitsReportPrefs'),
                getAnalyticsSettings()
            ]);
            
            updateState({
                analyticsSettings: settings,
                visibleColumns: prefs?.visibleColumns || availableColumns.map(c => c.id),
                statusFilter: prefs?.statusFilter || settings.transitStatusAliases.filter(s => s.id !== 'N' && s.id !== 'R').map(s => s.id), // Default to all non-final
            });
        }
        setIsInitialLoading(false);
        // Do not auto-analyze on load
    }, [user, updateState]);

    useEffect(() => {
        setTitle("Reporte de Tránsitos");
        if (isAuthorized) {
            loadPrefsAndSettings();
        }
    }, [setTitle, isAuthorized, loadPrefsAndSettings]);

    const sortedData = useMemo(() => {
        let filtered = state.data;
        
        if (debouncedSearchTerm) {
            const searchLower = normalizeText(debouncedSearchTerm);
            filtered = filtered.filter(item => 
                normalizeText(item.ORDEN_COMPRA).includes(searchLower) ||
                normalizeText(item.proveedorName).includes(searchLower) ||
                normalizeText(item.ARTICULO).includes(searchLower) ||
                normalizeText(item.productDescription).includes(searchLower) ||
                normalizeText(item.CreatedBy).includes(searchLower)
            );
        }

        if (state.supplierFilter.length > 0) {
            filtered = filtered.filter(item => state.supplierFilter.includes(item.PROVEEDOR));
        }

        filtered.sort((a, b) => {
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            switch(state.sortKey) {
                case 'ordenCompra': return (a.ORDEN_COMPRA || '').localeCompare(b.ORDEN_COMPRA || '') * dir;
                case 'proveedor': return (a.proveedorName || '').localeCompare(b.proveedorName || '') * dir;
                case 'fecha': return (new Date(a.FECHA_HORA).getTime() - new Date(b.FECHA_HORA).getTime()) * dir;
                case 'cantidad': return (a.CANTIDAD_ORDENADA - b.CANTIDAD_ORDENADA) * dir;
                case 'articulo': return (a.productDescription || '').localeCompare(b.productDescription || '') * dir;
                case 'stock': return (a.currentStock || 0) - (b.currentStock || 0) * dir;
                case 'creadoPor': return (a.CreatedBy || '').localeCompare(b.CreatedBy || '') * dir;
                default: return 0;
            }
        });

        return filtered;
    }, [state.data, debouncedSearchTerm, state.supplierFilter, state.sortKey, state.sortDirection]);

    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (state.sortKey === key && state.sortDirection === 'asc') {
            direction = 'desc';
        }
        updateState({ sortKey: key, sortDirection: direction });
    };

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        updateState({
            visibleColumns: checked
                ? [...state.visibleColumns, columnId]
                : state.visibleColumns.filter(id => id !== columnId)
        });
    };

    const handleSaveColumnVisibility = async () => {
        if (!user) return;
        try {
            await saveUserPreferences(user.id, 'transitsReportPrefs', { visibleColumns: state.visibleColumns, statusFilter: state.statusFilter });
            toast({ title: "Preferencias Guardadas", description: "La configuración de la vista ha sido guardada." });
        } catch (error: any) {
            logError("Failed to save transits report column visibility", { error: error.message });
            toast({ title: "Error", description: "No se pudo guardar la configuración de columnas.", variant: "destructive" });
        }
    };

    const handleExportExcel = () => {
        const statusMap = new Map(state.analyticsSettings?.transitStatusAliases.map(s => [s.id, s.name]));
        const headers = ["Nº OC", "Proveedor", "Fecha", "Estado", "Artículo", "Descripción", "Cant. Pendiente", "Inv. Actual", "Creado Por"];
        const dataToExport = sortedData.map(item => [
            item.ORDEN_COMPRA,
            item.proveedorName,
            format(parseISO(item.FECHA_HORA), 'dd/MM/yyyy'),
            statusMap.get(item.ESTADO) || item.ESTADO,
            item.ARTICULO,
            item.productDescription,
            item.CANTIDAD_ORDENADA,
            item.currentStock,
            item.CreatedBy,
        ]);
        exportToExcel({
            fileName: 'reporte_transitos',
            sheetName: 'Tránsitos',
            headers,
            data: dataToExport,
            columnWidths: [15, 30, 15, 15, 20, 40, 15, 15, 15],
        });
    };

    const handleExportPDF = () => {
        if (!companyData) return;
        const statusMap = new Map(state.analyticsSettings?.transitStatusAliases.map(s => [s.id, s.name]));
        const tableHeaders = ["Nº OC", "Proveedor", "Fecha", "Estado", "Artículo", "Cant."];
        const tableRows = sortedData.map(item => [
            item.ORDEN_COMPRA,
            item.proveedorName || item.PROVEEDOR,
            format(parseISO(item.FECHA_HORA), 'dd/MM/yyyy'),
            statusMap.get(item.ESTADO) || item.ESTADO,
            `${item.productDescription}\n(${item.ARTICULO})`,
            item.CANTIDAD_ORDENADA.toLocaleString('es-CR')
        ]);

        const doc = generateDocument({
            docTitle: "Reporte de Tránsitos (Órdenes de Compra ERP)",
            docId: '',
            companyData,
            meta: [{ label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') }],
            blocks: [],
            table: {
                columns: tableHeaders,
                rows: tableRows,
                columnStyles: { 5: { halign: 'right' } }
            },
            totals: [],
            orientation: 'landscape',
        });
        doc.save(`reporte_transitos.pdf`);
    };

    const supplierOptions = useMemo(() => {
        const uniqueSuppliers = new Map<string, string>();
        state.data.forEach(item => {
            if (!uniqueSuppliers.has(item.PROVEEDOR)) {
                uniqueSuppliers.set(item.PROVEEDOR, item.proveedorName || item.PROVEEDOR);
            }
        });
        return Array.from(uniqueSuppliers.entries()).map(([value, label]) => ({ value, label }));
    }, [state.data]);

    const statusOptions = useMemo(() => {
        if (!state.analyticsSettings) return [];
        return state.analyticsSettings.transitStatusAliases.map(alias => ({
            value: alias.id,
            label: alias.name,
        }));
    }, [state.analyticsSettings]);


    const actions = {
        setDateRange: (range: DateRange | undefined) => {
            updateState({ dateRange: range || { from: undefined, to: undefined } });
        },
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setSupplierFilter: (filter: string[]) => updateState({ supplierFilter: filter }),
        setStatusFilter: (filter: string[]) => updateState({ statusFilter: filter }),
        handleClearFilters: () => updateState({ searchTerm: '', supplierFilter: [], statusFilter: [] }),
        handleSort,
        handleAnalyze,
        handleExportExcel,
        handleExportPDF,
        handleColumnVisibilityChange,
        handleSaveColumnVisibility,
    };

    const selectors = {
        sortedData,
        supplierOptions,
        statusOptions,
        statusConfig: useMemo(() => {
            const config: { [key: string]: { label: string; color: string } } = {};
            state.analyticsSettings?.transitStatusAliases.forEach(alias => {
                config[alias.id] = { label: alias.name, color: alias.color };
            });
            return config;
        }, [state.analyticsSettings]),
        availableColumns,
        visibleColumnsData: useMemo(() => {
            return state.visibleColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean) as (typeof availableColumns)[0][];
        }, [state.visibleColumns]),
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    };
}
    
