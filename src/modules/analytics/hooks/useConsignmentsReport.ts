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
import type { DateRange, ConsignmentAgreement } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { exportToExcel } from '@/modules/core/lib/excel-export';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { format } from 'date-fns';
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
}

interface State {
    isLoading: boolean;
    hasRun: boolean;
    dateRange: DateRange;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    reportData: ConsignmentReportRow[];
}

export function useConsignmentsReport() {
    const { isAuthorized } = useAuthorization(['analytics:consignments-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData } = useAuth();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        hasRun: false,
        dateRange: { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() },
        agreements: [],
        selectedAgreementId: null,
        reportData: [],
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);
    
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
        fetchAgreements();
    }, [setTitle, isAuthorized, toast, updateState]);

    const handleGenerateReport = useCallback(async () => {
        if (!state.selectedAgreementId || !state.dateRange.from || !state.dateRange.to) {
            toast({ title: "Datos incompletos", description: "Por favor, selecciona un cliente y un rango de fechas.", variant: 'destructive'});
            return;
        }
        updateState({ isLoading: true, hasRun: true });
        try {
            const data = await getConsignmentsReportData(state.selectedAgreementId, state.dateRange as { from: Date, to: Date });
            updateState({ reportData: data });
        } catch (error: any) {
            logError("Failed to generate consignments report", { error: error.message });
            toast({ title: "Error al Generar", description: error.message, variant: 'destructive'});
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.selectedAgreementId, state.dateRange, toast, updateState]);
    
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
            // Add export actions here
        },
        selectors,
        isAuthorized,
    };
}
