
/**
 * @fileoverview Hook for managing the logic for the new Consignments Report page.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentsReportData } from '@/modules/analytics/lib/actions';
import { getConsignmentAgreements } from '@/modules/consignments/lib/actions';
import type { DateRange, ConsignmentAgreement, Company, RestockBoleta, BoletaLine, BoletaHistory, UserPreferences } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/lib/excel-export';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';

export interface ConsignmentReportRow {
    productId: string;
    productDescription: string;
    initialStock: number;
    totalReplenished: number;
    adjustments: number;
    finalStock: number;
    consumption: number;
    price: number;
    totalValue: number;
    boletaConsecutives: string;
    creationDates: string;
    deliveryDates: string;
    erpInvoices: string;
    erpMovementIds: string;
    approvers: string;
    clientProductCode?: string;
}

export type ConsignmentsReportSortKey = 'productId' | 'productDescription' | 'consumption' | 'totalValue';
export type SortDirection = 'asc' | 'desc';

interface State {
    isLoading: boolean;
    hasRun: boolean;
    dateRange: DateRange;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    reportData: ConsignmentReportRow[];
    processedBoletas: (RestockBoleta & { lines: BoletaLine[], history: BoletaHistory[] })[];
    sortKey: ConsignmentsReportSortKey;
    sortDirection: SortDirection;
    visibleColumns: string[];
}

export function useConsignmentsReport() {
    const { isAuthorized } = useAuthorization(['analytics:consignments-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, companyData } = useAuth();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        hasRun: false,
        dateRange: { from: undefined, to: undefined },
        agreements: [],
        selectedAgreementId: null,
        reportData: [],
        processedBoletas: [],
        sortKey: 'consumption',
        sortDirection: 'desc',
        visibleColumns: ['productId', 'productDescription', 'boletaConsecutives', 'consumption', 'price', 'totalValue'],
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);
    
    useEffect(() => {
        // Set initial date range only on the client-side to avoid hydration issues
        updateState({
            dateRange: { from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: new Date() }
        });
    }, [updateState]);

    useEffect(() => {
        setTitle("Reporte de Cierre de Consignaciones");
        const fetchInitialData = async () => {
            if (isAuthorized) {
                try {
                    const [agreementsData, prefs] = await Promise.all([
                        getConsignmentAgreements(),
                        user ? getUserPreferences(user.id, 'consignmentsReportPrefs') : null
                    ]);

                    updateState({ 
                        agreements: agreementsData, 
                        isLoading: false,
                        visibleColumns: prefs?.visibleColumns || state.visibleColumns,
                    });
                } catch (error) {
                    logError('Failed to fetch consignment agreements for report', { error });
                    toast({ title: 'Error', description: 'No se pudieron cargar los acuerdos de consignación.', variant: 'destructive'});
                    updateState({ isLoading: false });
                }
            }
        };
        if(isAuthorized) {
            fetchInitialData();
        } else {
             updateState({ isLoading: false });
        }
    }, [setTitle, isAuthorized, toast, updateState, user, state.visibleColumns]);

    const handleGenerateReport = useCallback(async () => {
        if (!state.selectedAgreementId || !state.dateRange.from || !state.dateRange.to) {
            toast({ title: "Datos incompletos", description: "Por favor, selecciona un cliente y un rango de fechas.", variant: 'destructive'});
            return;
        }
        updateState({ isLoading: true, hasRun: true });
        try {
            const { reportRows, boletas } = await getConsignmentsReportData(state.selectedAgreementId, state.dateRange as { from: Date, to: Date });
            updateState({ reportData: reportRows, processedBoletas: boletas });
        } catch (error: any) {
            logError("Failed to generate consignments report", { error: error.message });
            toast({ title: "Error al Generar", description: error.message, variant: 'destructive'});
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.selectedAgreementId, state.dateRange, toast, updateState]);
    
    const handleSort = (key: ConsignmentsReportSortKey) => {
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
                : state.visibleColumns.filter(id => id !== columnId),
        });
    };

    const savePreferences = async () => {
        if (!user) return;
        try {
            await saveUserPreferences(user.id, 'consignmentsReportPrefs', { visibleColumns: state.visibleColumns });
            toast({ title: 'Preferencias Guardadas' });
        } catch (error: any) {
            logError('Failed to save preferences', { error: error.message });
            toast({ title: 'Error', description: 'No se pudieron guardar las preferencias.', variant: 'destructive' });
        }
    };

    const handleExportExcel = () => {
        if (!state.reportData.length) return;
        const agreement = state.agreements.find(a => String(a.id) === state.selectedAgreementId);

        const headers = ["Código", "Producto", "Alias Cliente", "Boleta(s)", "Fecha(s) Creación", "Fecha(s) Entrega", "Movimiento(s) Interno(s)", "Factura(s) ERP", "Aprobado Por", "Inv. Inicial", "Repuesto", "Ajustes", "Inv. Final", "Consumo", "Precio Unit.", "Valor Total"];
        
        const dataToExport = sortedReportData.map(row => [
            row.productId,
            row.productDescription,
            row.clientProductCode,
            row.boletaConsecutives,
            row.creationDates,
            row.deliveryDates,
            row.erpMovementIds,
            row.erpInvoices,
            row.approvers,
            row.initialStock,
            row.totalReplenished,
            row.adjustments,
            row.finalStock,
            row.consumption,
            row.price,
            row.totalValue,
        ]);
        
        const title = "Reporte de Cierre de Consignación";
        const meta = [
            { label: "Cliente:", value: agreement?.client_name || 'N/A' },
            { label: "Período:", value: `${state.dateRange.from ? format(state.dateRange.from, 'dd/MM/yyyy', { locale: es }) : ''} al ${state.dateRange.to ? format(state.dateRange.to, 'dd/MM/yyyy', { locale: es }) : ''}` }
        ];

        exportToExcel({
            fileName: `cierre_consignacion_${agreement?.client_name.replace(/\s+/g, '_') || ''}`,
            sheetName: 'Cierre',
            title,
            meta,
            headers,
            data: dataToExport,
            columnWidths: [20, 40, 20, 20, 20, 20, 20, 20, 20, 15, 15, 15, 15, 15, 15, 15],
        });
    };

    const handleExportPDF = async () => {
        if (!state.reportData.length || !companyData) return;
        const agreement = state.agreements.find(a => String(a.id) === state.selectedAgreementId);
        
        const totalToBill = selectors.totalConsumptionValue;

        const doc = generateDocument({
            docTitle: "Reporte de Cierre de Consignación",
            docId: '',
            companyData: companyData as Company,
            logoDataUrl: companyData.logoUrl,
            meta: [{ label: 'Cliente', value: agreement?.client_name || '' }, { label: 'Período', value: `${state.dateRange.from ? format(state.dateRange.from, 'dd/MM/yyyy') : ''} al ${state.dateRange.to ? format(state.dateRange.to, 'dd/MM/yyyy') : ''}` }],
            blocks: [],
            table: {
                columns: ["Código", "Descripción", "Consumo", "Precio Unit.", "Total"],
                rows: sortedReportData.map(r => [
                    r.productId,
                    r.productDescription,
                    r.consumption.toLocaleString('es-CR'),
                    `¢${r.price.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`,
                    `¢${r.totalValue.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`
                ]),
                columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
            },
            totals: [{ label: 'Total a Facturar:', value: `¢${totalToBill.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` }],
        });
        doc.save(`cierre_consignacion_${agreement?.client_name.replace(/\s+/g, '_')}.pdf`);
    };
    
    const sortedReportData = useMemo(() => {
        if (!state.reportData) return [];
        return [...state.reportData].sort((a, b) => {
            const dir = state.sortDirection === 'asc' ? 1 : -1;
            const key = state.sortKey;

            switch (key) {
                case 'productId':
                    return a.productId.localeCompare(b.productId) * dir;
                case 'productDescription':
                    return a.productDescription.localeCompare(b.productDescription) * dir;
                case 'consumption':
                case 'totalValue':
                    return (a[key] - b[key]) * dir;
                default:
                    return 0;
            }
        });
    }, [state.reportData, state.sortKey, state.sortDirection]);
    
    const availableColumns = [
        { id: 'productId', label: 'Código Artículo', sortable: true },
        { id: 'productDescription', label: 'Producto', sortable: true },
        { id: 'boletaConsecutives', label: 'Boleta(s)' },
        { id: 'creationDates', label: 'Fecha(s)' },
        { id: 'erpInvoices', label: 'Factura(s) ERP' },
        { id: 'approvers', label: 'Aprobado Por' },
        { id: 'initialStock', label: 'Inv. Inicial', align: 'right' },
        { id: 'totalReplenished', label: 'Total Repuesto', align: 'right' },
        { id: 'finalStock', label: 'Inv. Final', align: 'right' },
        { id: 'consumption', label: 'Consumo', sortable: true, align: 'right' },
        { id: 'price', label: 'Precio Unit.', align: 'right' },
        { id: 'totalValue', label: 'Valor Total', sortable: true, align: 'right' },
    ];
    
    const selectors = {
        agreementOptions: useMemo(() => 
            state.agreements.map(a => ({ value: String(a.id), label: a.client_name }))
        , [state.agreements]),
        totalConsumptionValue: useMemo(() => 
            state.reportData.reduce((sum, row) => sum + row.totalValue, 0)
        , [state.reportData]),
        sortedReportData,
        availableColumns,
        visibleColumnsData: useMemo(() => 
            state.visibleColumns.map(id => availableColumns.find(c => c.id === id)).filter(Boolean) as (typeof availableColumns)[0][]
        , [state.visibleColumns]),
        getColumnContent: (row: ConsignmentReportRow, colId: string): { content: React.ReactNode, className?: string } => {
            switch(colId) {
                case 'productId': return { content: row.productId, className: 'font-mono' };
                case 'productDescription': return { content: row.productDescription };
                case 'boletaConsecutives': return { content: row.boletaConsecutives };
                case 'creationDates': return { content: row.creationDates };
                case 'erpInvoices': return { content: row.erpInvoices };
                case 'approvers': return { content: row.approvers };
                case 'initialStock': return { content: row.initialStock.toLocaleString() };
                case 'totalReplenished': return { content: row.totalReplenished.toLocaleString(), className: 'text-blue-600' };
                case 'finalStock': return { content: row.finalStock.toLocaleString() };
                case 'consumption': return { content: row.consumption.toLocaleString(), className: 'font-bold text-lg' };
                case 'price': return { content: `¢${row.price.toLocaleString('es-CR')}` };
                case 'totalValue': return { content: `¢${row.totalValue.toLocaleString('es-CR')}`, className: 'font-bold text-primary text-lg' };
                default: return { content: '' };
            }
        }
    };

    return {
        state: { ...state, reportData: sortedReportData },
        actions: {
            setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined }}),
            setSelectedAgreementId: (id: string) => updateState({ selectedAgreementId: id }),
            handleGenerateReport,
            handleExportExcel,
            handleExportPDF,
            handleSort,
            handleColumnVisibilityChange,
            savePreferences,
        },
        selectors,
        isAuthorized,
    };
}
