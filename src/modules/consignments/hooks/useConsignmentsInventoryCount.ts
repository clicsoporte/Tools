/**
 * @fileoverview Hook for managing the logic for the Consignments Inventory Count page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, getAgreementDetails, savePhysicalCount, createClosureFromCount } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { ConsignmentAgreement, ConsignmentProduct } from '@/modules/core/types';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';

type WizardStep = 'setup' | 'counting' | 'finished';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    step: WizardStep;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    productsToCount: ConsignmentProduct[];
    counts: Record<string, string>;
    isClosureConfirmOpen: boolean;
}

export const useConsignmentsInventoryCount = () => {
    const { hasPermission } = useAuthorization(['consignments:count']);
    const { toast } = useToast();
    const { user, products } = useAuth();
    const router = useRouter();
    usePageTitle().setTitle('Conteo Físico de Consignación');

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        step: 'setup',
        agreements: [],
        selectedAgreementId: null,
        productsToCount: [],
        counts: {},
        isClosureConfirmOpen: false,
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            try {
                const agreementsData = await getConsignmentAgreements();
                updateState({ agreements: agreementsData.filter(a => a.is_active) });
            } catch (error) {
                logError('Failed to load initial data for inventory count', { error });
            } finally {
                updateState({ isLoading: false });
            }
        };
        if (user) {
            loadInitialData();
        }
    }, [user, updateState]);
    
    const handleSelectAgreement = async (id: string) => {
        if (!id) return;
        updateState({ isLoading: true, selectedAgreementId: id, step: 'counting' });
        try {
            const agreementDetails = await getAgreementDetails(Number(id));
            if (!agreementDetails || agreementDetails.products.length === 0) {
                 toast({ title: 'Sin Productos', description: 'Este acuerdo no tiene productos autorizados.', variant: 'destructive', duration: 6000 });
                 updateState({ productsToCount: [] });
                 return;
            }
            updateState({ productsToCount: agreementDetails.products });
        } catch (error) {
            logError('Failed to load agreement products', { error });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleQuantityChange = (productId: string, value: string) => {
        updateState({
            counts: { ...state.counts, [productId]: value }
        });
    };

    const handleSaveInformationalCount = async () => {
        if (!user || !state.selectedAgreementId || Object.keys(state.counts).length === 0) {
            toast({ title: 'Sin Datos', description: 'Debes ingresar al menos una cantidad para guardar.', variant: 'destructive' });
            return;
        }
        updateState({ isSubmitting: true });
        try {
            const linesToSave = Object.entries(state.counts)
                .map(([productId, qtyStr]) => ({ productId, quantity: Number(qtyStr) }))
                .filter(line => !isNaN(line.quantity));

            await savePhysicalCount(Number(state.selectedAgreementId), linesToSave, user.name);
            toast({ title: 'Conteo Guardado', description: 'El conteo informativo ha sido guardado exitosamente.' });
            updateState({ step: 'finished' });
        } catch (error: any) {
            logError('Failed to save informational count', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleRequestClosure = async () => {
        if (!user || !state.selectedAgreementId || Object.keys(state.counts).length === 0) {
            toast({ title: 'Sin Datos', description: 'Debes ingresar al menos una cantidad para generar un cierre.', variant: 'destructive' });
            return;
        }
        updateState({ isSubmitting: true, isClosureConfirmOpen: false });
        try {
            const linesToSubmit = Object.entries(state.counts)
                .map(([productId, qtyStr]) => ({ productId, quantity: Number(qtyStr) }))
                .filter(line => !isNaN(line.quantity));
            
            const closure = await createClosureFromCount(Number(state.selectedAgreementId), linesToSubmit, user.name);
            toast({ title: 'Solicitud de Cierre Generada', description: `Se creó el Cierre ${closure.consecutive} y está pendiente de aprobación.` });
            router.push('/dashboard/consignments/cierres');
        } catch (error: any) {
            logError('Failed to request period closure', { error: error.message });
            toast({ title: 'Error', description: `No se pudo generar el cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const reset = () => {
        updateState({
            step: 'setup',
            selectedAgreementId: null,
            productsToCount: [],
            counts: {},
        });
    };

    const selectors = {
        agreementOptions: useMemo(() => state.agreements.map(a => ({ value: String(a.id), label: a.client_name })), [state.agreements]),
        getAgreementName: (id: string | null) => id ? state.agreements.find(a => String(a.id) === id)?.client_name || 'Desconocido' : '',
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
        hasCounts: useMemo(() => Object.values(state.counts).some(q => q.trim() !== ''), [state.counts]),
    };
    
    return {
        state,
        actions: {
            handleSelectAgreement,
            handleQuantityChange,
            handleSaveInformationalCount,
            handleRequestClosure,
            reset,
            setIsClosureConfirmOpen: (open: boolean) => updateState({ isClosureConfirmOpen: open }),
        },
        selectors
    };
};
