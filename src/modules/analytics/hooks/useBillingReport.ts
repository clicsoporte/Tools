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
import { generateDocument } from '@/lib/pdf-generator';
import type { ConsignmentReportRow, RestockBoleta, BoletaLine, BoletaHistory, PeriodClosure, Company } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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
    
        const mainDataHeaders = [ "Código", "Descripción", "Alias Cliente", "Inv. Inicial", "Total Entregado", "Inv. Final", "Consumo (a Facturar)", "Precio Unit.", "Valor Total"];
        const mainDataToExport = state.reportData.map(row => [
            row.productId,
            row.productDescription,
            row.clientProductCode,
            row.initialStock,
            row.totalReplenished,
            row.finalStock,
            row.consumption,
            row.price,
            row.totalValue,
        ]);
        
        const boletasHeaders = ["Boletas de Entrega en el Período", "", "", ""];
        const boletaSubHeaders = ["Consecutivo", "Fecha", "Usuario", "Movimiento ERP"];
        const boletasData = state.boletasInPeriod.map(b => [
            b.consecutive, 
            format(parseISO(b.created_at), 'dd/MM/yyyy HH:mm'), 
            b.created_by,
            b.erp_movement_id || ''
        ]);
    
        // Combine all data into a single array for aoa_to_sheet
        const combinedData: (string | number | undefined | null)[][] = [
            mainDataHeaders,
            ...mainDataToExport,
            [], // Spacer row
            boletasHeaders,
            boletaSubHeaders,
            ...boletasData
        ];

        exportToExcel({
            fileName: `reporte_facturacion_${state.closureInfo.consecutive}`,
            sheetName: 'Facturacion',
            title: `Reporte de Facturación: ${state.closureInfo.consecutive}`,
            meta: [
                { label: "Cliente:", value: state.closureInfo.client_name },
                { label: "Período:", value: `${state.previousClosure ? format(parseISO(state.previousClosure.created_at), 'dd/MM/yy HH:mm') : 'Inicio'} a ${format(parseISO(state.closureInfo.created_at), 'dd/MM/yy HH:mm')}` }
            ],
            data: combinedData, // Pass the combined data array
            headers: [], // Headers are now part of the data array
            columnWidths: [20, 40, 20, 15, 15, 15, 20, 15, 15],
        });
    };

    const handleExportPDF = () => {
        if (!state.reportData || !state.closureInfo || !companyData) return;
        
        const totalToBill = state.reportData.reduce((sum, row) => sum + row.totalValue, 0);

        const doc = generateDocument({
            docTitle: "Reporte de Facturación por Consumo",
            docId: state.closureInfo.consecutive,
            companyData: companyData as Company,
            logoDataUrl: companyData.logoUrl,
            meta: [
                { label: 'Cliente', value: state.closureInfo.client_name },
                { label: 'Período de Facturación', value: `${state.previousClosure ? format(parseISO(state.previousClosure.created_at), 'dd/MM/yyyy') : 'Inicio'} al ${format(parseISO(state.closureInfo.created_at), 'dd/MM/yyyy')}` },
            ],
            blocks: [],
            table: {
                columns: ["Código", "Descripción", "Cantidad a Facturar", "Precio Unit.", "Total"],
                rows: state.reportData.map(r => [
                    r.productId,
                    r.productDescription,
                    r.consumption.toLocaleString('es-CR'),
                    `¢${r.price.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `¢${r.totalValue.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ]),
                columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
            },
            totals: [{ label: 'Total a Facturar:', value: `¢${totalToBill.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }],
            topLegend: 'DOCUMENTO PARA FACTURACIÓN INTERNA'
        });
        doc.save(`facturacion_${state.closureInfo.consecutive}.pdf`);
    };

    return {
        state,
        actions: {
            handleExportExcel,
            handleExportPDF,
        },
        selectors: {},
        isAuthorized,
    };
}
