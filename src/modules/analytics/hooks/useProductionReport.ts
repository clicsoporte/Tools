/**
 * @fileoverview Hook to manage the logic for the production report page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getProductionReportData } from '@/modules/analytics/lib/actions';
import type { DateRange, ProductionOrder, Company } from '@/modules/core/types';
import { subDays, startOfDay, format, parseISO } from 'date-fns';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { exportToExcel } from '@/modules/core/lib/excel-export';
import { generateDocument } from '@/modules/core/lib/pdf-generator';

export interface ProductionReportData {
    totals: {
        totalRequested: number;
        totalDelivered: number;
        totalDefective: number;
        totalNet: number;
    };
    details: (ProductionOrder & { completionDate: string | null })[];
}

interface State {
    isLoading: boolean;
    dateRange: DateRange;
    reportData: ProductionReportData;
}

export function useProductionReport() {
    const { isAuthorized, hasPermission } = useAuthorization(['analytics:read', 'analytics:production-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData: authCompanyData } = useAuth();
    
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const [state, setState] = useState<State>({
        isLoading: false,
        dateRange: {
            from: startOfDay(subDays(new Date(), 30)),
            to: startOfDay(new Date()),
        },
        reportData: {
            totals: { totalRequested: 0, totalDelivered: 0, totalDefective: 0, totalNet: 0 },
            details: []
        },
    });

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
            const data = await getProductionReportData(state.dateRange);
            updateState({ reportData: data });
        } catch (error: any) {
            logError("Failed to get production report", { error: error.message });
            toast({ title: "Error al Generar Reporte", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
            if (isInitialLoading) setIsInitialLoading(false);
        }
    }, [isAuthorized, state.dateRange, toast, updateState, isInitialLoading]);
    
    useEffect(() => {
        setTitle("Reporte de Producción");
        if (isAuthorized) {
            handleAnalyze();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);

    const getNetDifference = (item: ProductionOrder) => {
        return (item.deliveredQuantity ?? 0) - (item.defectiveQuantity ?? 0) - item.quantity;
    };

    const handleExportExcel = () => {
        const dataToExport = state.reportData.details.map(item => [
            item.consecutive,
            item.customerName,
            `[${item.productId}] ${item.productDescription}`,
            item.quantity,
            item.deliveredQuantity ?? 0,
            item.defectiveQuantity ?? 0,
            getNetDifference(item),
            item.completionDate ? format(parseISO(item.completionDate), 'dd/MM/yyyy') : 'N/A',
        ]);

        exportToExcel({
            fileName: 'reporte_produccion',
            sheetName: 'Producción',
            headers: ['OP', 'Cliente', 'Producto', 'Solicitado', 'Producido', 'Defectuoso', 'Diferencia Neta', 'Fecha Completada'],
            data: dataToExport,
            columnWidths: [10, 25, 40, 12, 12, 12, 15, 18],
        });
    };

    const handleExportPDF = async () => {
        if (!authCompanyData) return;

        let logoDataUrl: string | null = null;
        if (authCompanyData.logoUrl) {
            try {
                const response = await fetch(authCompanyData.logoUrl);
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) { console.error("Error processing logo for PDF:", e); }
        }

        const tableRows = state.reportData.details.map(item => [
            item.consecutive,
            item.customerName,
            item.productDescription,
            item.quantity.toLocaleString('es-CR'),
            (item.deliveredQuantity ?? 0).toLocaleString('es-CR'),
            (item.defectiveQuantity ?? 0).toLocaleString('es-CR'),
            getNetDifference(item).toLocaleString('es-CR'),
        ]);

        const doc = generateDocument({
            docTitle: "Reporte de Producción",
            docId: '',
            companyData: authCompanyData,
            logoDataUrl,
            meta: [
                { label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') },
                { label: 'Rango de Fechas', value: `${format(state.dateRange.from!, 'dd/MM/yy')} - ${format(state.dateRange.to!, 'dd/MM/yy')}` },
            ],
            blocks: [],
            table: {
                columns: ['OP', 'Cliente', 'Producto', 'Solicitado', 'Producido', 'Defectuoso', 'Dif. Neta'],
                rows: tableRows,
            },
            totals: [
                { label: 'Total Producido:', value: state.reportData.totals.totalDelivered.toLocaleString('es-CR') },
                { label: 'Total Defectuoso:', value: state.reportData.totals.totalDefective.toLocaleString('es-CR') },
                { label: 'Total Neto:', value: state.reportData.totals.totalNet.toLocaleString('es-CR') },
            ],
            orientation: 'landscape'
        });

        doc.save(`reporte_produccion_${new Date().getTime()}.pdf`);
    };

    return {
        state,
        actions: {
            setDateRange: (range: DateRange | undefined) => updateState({ dateRange: range || { from: undefined, to: undefined } }),
            handleAnalyze,
            handleExportExcel,
            handleExportPDF,
        },
        selectors: {
            getNetDifference,
        },
        isAuthorized,
        isInitialLoading,
    };
}
