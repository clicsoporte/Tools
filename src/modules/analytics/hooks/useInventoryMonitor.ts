/**
 * @fileoverview Hook for managing the logic for the new official Consignments Inventory Monitor.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getInventoryMonitorData } from '@/modules/analytics/lib/actions';
import { getConsignmentAgreements } from '@/modules/consignments/lib/actions';
import type { ConsignmentAgreement } from '@/modules/core/types';

interface State {
    isLoading: boolean;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    monitorData: any | null; // Define a proper type later
}

export function useInventoryMonitor() {
    const { isAuthorized } = useAuthorization(['analytics:consignments-report:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    
    const [state, setState] = useState<State>({
        isLoading: true,
        agreements: [],
        selectedAgreementId: null,
        monitorData: null,
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);
    
    useEffect(() => {
        setTitle("Monitor de Inventario en Consignación");
        if (isAuthorized) {
            getConsignmentAgreements()
                .then(data => updateState({ agreements: data, isLoading: false }))
                .catch(err => {
                    logError('Failed to load agreements for monitor', { error: err });
                    toast({ title: 'Error', description: 'No se pudieron cargar los acuerdos.', variant: 'destructive'});
                    updateState({ isLoading: false });
                });
        }
    }, [setTitle, isAuthorized, toast, updateState]);
    
    const handleFetchData = async () => {
        if (!state.selectedAgreementId) {
            toast({ title: 'Selección requerida', description: 'Por favor, selecciona un cliente para consultar.', variant: 'destructive' });
            return;
        }
        updateState({ isLoading: true, monitorData: null });
        try {
            const data = await getInventoryMonitorData(Number(state.selectedAgreementId));
            updateState({ monitorData: data });
        } catch (error: any) {
            logError('Failed to fetch inventory monitor data', { error: error.message });
            toast({ title: 'Error al Consultar', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isLoading: false });
        }
    };
    
    return {
        state,
        actions: {
            setSelectedAgreementId: (id: string) => updateState({ selectedAgreementId: id, monitorData: null }),
            handleFetchData,
        },
        selectors: {},
        isAuthorized,
    };
}
