
/**
 * @fileoverview Hook for managing the logic for the new Consignments Report page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentsReportData } from '@/modules/analytics/lib/actions';
import { getConsignmentAgreements } from '@/modules/consignments/lib/actions';
import type { DateRange, ConsignmentAgreement, Company, RestockBoleta, BoletaLine, BoletaHistory } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/lib/excel-export';
import { generateDocument } from '@/lib/pdf-generator';
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// Define types for report data if they are not already in core types
export interface ConsignmentReportRow {
    productId: string;
    productDescription: string;
    initialStock: number;
    totalReplenished: number;
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

interface State {
    isLoading: boolean;
    hasRun: boolean;
    dateRange: DateRange;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    reportData: ConsignmentReportRow[];
    processedBoletas: (RestockBoleta & { lines: BoletaLine[], history: BoletaHistory[] })[];
}

export function useConsignmentsReport() {
    const { isAuthorized } = useAuthorization(['analytics:consignments-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData } = useAuth();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        hasRun: false,
        dateRange: { from: undefined, to: undefined },
        agreements: [],
        selectedAgreementId: null,
        reportData: [],
        processedBoletas: [],
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
        const fetchAgreements = async () => {
            if (isAuthorized) {
                try {
                    const agreementsData = await getConsignmentAgreements();
                    updateState({ agreements: agreementsData, isLoading: false });
                } catch (error) {
                    logError('Failed to fetch consignment agreements for report', { error });
                    toast({ title: 'Error', description: 'No se pudieron cargar los acuerdos de consignación.', variant: 'destructive'});
                    updateState({ isLoading: false });
                }
            }
        };
        if(isAuthorized) {
            fetchAgreements();
        } else {
             updateState({ isLoading: false });
        }
    }, [setTitle, isAuthorized, toast, updateState]);

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

    const handleExportExcel = () => {
        if (!state.reportData.length) return;
        const agreement = state.agreements.find(a => String(a.id) === state.selectedAgreementId);

        const headers = ["Código", "Producto", "Alias Cliente", "Boleta(s)", "Fecha(s) Creación", "Fecha(s) Entrega", "Movimiento(s) Interno(s)", "Factura(s) ERP", "Aprobado Por", "Inv. Inicial", "Repuesto", "Inv. Final", "Consumo", "Precio Unit.", "Valor Total"];
        
        const dataToExport = state.reportData.map(row => [
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
            columnWidths: [20, 40, 20, 20, 20, 20, 20, 20, 20, 15, 15, 15, 15, 15, 15],
        });
    };

    const handleExportPDF = async () => {
        if (!state.reportData.length || !companyData) return;
        const agreement = state.agreements.find(a => String(a.id) === state.selectedAgreementId);

        let logoDataUrl: string | null = null;
        if (companyData.logoUrl) {
            try {
                const response = await fetch(companyData.logoUrl);
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) { console.error("Error processing logo for PDF:", e); }
        }

        const tableHeaders = ["Producto", "Boleta(s)", "Fecha(s)", "Factura(s)", "Aprobado", "Inv. Inicial", "Repuesto", "Inv. Final", "Consumo", "Precio", "Total"];
        const tableRows = state.reportData.map(row => [
            `${row.productDescription}\n(${row.productId})`,
            row.boletaConsecutives,
            row.creationDates,
            row.erpInvoices,
            row.approvers,
            row.initialStock.toLocaleString(),
            row.totalReplenished.toLocaleString(),
            row.finalStock.toLocaleString(),
            row.consumption.toLocaleString(),
            `¢${row.price.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`,
            `¢${row.totalValue.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`
        ]);

        const doc = generateDocument({
            docTitle: "Reporte de Cierre de Consignación",
            docId: '',
            companyData,
            logoDataUrl,
            meta: [{ label: 'Cliente', value: agreement?.client_name || '' }, { label: 'Período', value: `${state.dateRange.from ? format(state.dateRange.from, 'dd/MM/yyyy') : ''} al ${state.dateRange.to ? format(state.dateRange.to, 'dd/MM/yyyy') : ''}` }],
            blocks: [],
            table: { 
                columns: tableHeaders, 
                rows: tableRows, 
                columnStyles: { 
                    5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 
                    8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } 
                } 
            },
            totals: [{ label: 'Total a Facturar:', value: `¢${selectors.totalConsumptionValue.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` }],
            orientation: 'landscape'
        });
        doc.save(`cierre_consignacion_${agreement?.client_name.replace(/\s+/g, '_')}.pdf`);
    };
    
    const selectors = {
        agreementOptions: useMemo(() => 
            state.agreements.map(a => ({ value: String(a.id), label: a.client_name }))
        , [state.agreements]),
        totalConsumptionValue: useMemo(() => 
            state.reportData.reduce((sum, row) => sum + row.totalValue, 0)
        , [state.reportData]),
    };

    return {
        state,
        actions: {
            setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined }}),
            setSelectedAgreementId: (id: string) => updateState({ selectedAgreementId: id }),
            handleGenerateReport,
            handleExportExcel,
            handleExportPDF,
        },
        selectors,
        isAuthorized,
    };
}
