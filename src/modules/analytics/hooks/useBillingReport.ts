
/**
 * @fileoverview Hook to manage the logic for the new official Consignments Billing Report.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentsBillingReportData } from '@/modules/analytics/lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { exportToExcel } from '@/lib/excel-export';
import type { ConsignmentReportRow, RestockBoleta, BoletaLine, BoletaHistory, PeriodClosure } from '@/modules/core/types';

interface State {
    isLoading: boolean;
    reportData: ConsignmentReportRow[] | null;
    boletasInPeriod: (RestockBoleta & { lines: BoletaLine[], history: BoletaHistory[] })[];
    closureInfo: (PeriodClosure & { client_name: string }) | null;
    previousClosure: PeriodClosure | null;
}

export function useBillingReport() {
    const { isAuthorized } = useAuthorization(['analytics:consignments-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData } = useAuth();
    const searchParams = useSearchParams();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        reportData: null,
        boletasInPeriod: [],
        closureInfo: null,
        previousClosure: null,
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const closureId = searchParams?.get('closureId');
    
    useEffect(() => {
        setTitle("Reporte de Facturación");
        const fetchReportData = async () => {
            if (!closureId) {
                toast({ title: 'ID de Cierre no encontrado', description: 'No se especificó un cierre para generar el reporte.', variant: 'destructive'});
                updateState({ isLoading: false });
                return;
            }
            try {
                const data = await getConsignmentsBillingReportData(Number(closureId));
                updateState({ 
                    reportData: data.reportRows, 
                    boletasInPeriod: data.boletas,
                    closureInfo: data.currentClosure,
                    previousClosure: data.previousClosure,
                });
            } catch (error: any) {
                logError("Failed to fetch billing report data", { error: error.message, closureId });
                toast({ title: "Error al Generar", description: error.message, variant: 'destructive' });
            } finally {
                updateState({ isLoading: false });
            }
        };

        if (isAuthorized) {
            fetchReportData();
        }
    }, [closureId, isAuthorized, setTitle, toast, updateState]);
    
    const handleExportExcel = () => {
        if (!state.reportData || !state.closureInfo) return;

        const headers = ["Código", "Descripción", "Alias Cliente", "A Facturar", "Precio Unit.", "Valor Total"];
        
        const dataToExport = state.reportData.map(row => [
            row.productId,
            row.productDescription,
            row.clientProductCode,
            row.consumption,
            row.price,
            row.totalValue,
        ]);
        
        const title = `Facturación de Cierre: ${state.closureInfo.consecutive}`;
        const meta = [
            { label: "Cliente:", value: state.closureInfo.client_name },
            { label: "Período:", value: `Cierre del ${state.closureInfo.created_at}` }
        ];

        exportToExcel({
            fileName: `facturacion_${state.closureInfo.consecutive}`,
            sheetName: 'Facturacion',
            title,
            meta,
            headers,
            data: dataToExport,
            columnWidths: [20, 40, 20, 15, 15, 15],
        });
    };

    return {
        state,
        actions: {
            handleExportExcel,
        },
        selectors: {},
        isAuthorized,
    };
}

    