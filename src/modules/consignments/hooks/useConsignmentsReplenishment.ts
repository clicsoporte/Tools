/**
 * @fileoverview Hook for managing the logic for the new Consignments Replenishment Request page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, getAgreementDetails, saveReplenishmentBoleta } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import type { ConsignmentAgreement, ConsignmentProduct } from '@/modules/core/types';
import { useRouter } from 'next/navigation';

type WizardStep = 'setup' | 'requesting' | 'finished';

interface State {
    isLoading: boolean;
    step: WizardStep;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    products: ConsignmentProduct[];
    quantities: Record<string, string>;
    agreementSearchTerm: string;
    isAgreementSearchOpen: boolean;
}

export const useConsignmentsReplenishment = () => {
    const { hasPermission } = useAuthorization(['consignments:count']);
    const { toast } = useToast();
    const { user, products: authProducts } = useAuth();
    const router = useRouter();

    const [state, setState] = useState<State>({
        isLoading: true,
        step: 'setup',
        agreements: [],
        selectedAgreementId: null,
        products: [],
        quantities: {},
        agreementSearchTerm: '',
        isAgreementSearchOpen: false,
    });
    
    const [debouncedSearch] = useDebounce(state.agreementSearchTerm, 300);
    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadAgreements = async () => {
            try {
                const agreementsData = await getConsignmentAgreements();
                updateState({ agreements: agreementsData.filter(a => a.is_active), isLoading: false });
            } catch (error) {
                logError('Failed to load agreements for replenishment', { error });
                updateState({ isLoading: false });
            }
        };
        if (hasPermission('consignments:count')) {
            loadAgreements();
        }
    }, [hasPermission, updateState]);

    const handleSelectAgreement = (id: string) => {
        const agreement = state.agreements.find(a => String(a.id) === id);
        if (agreement) {
            updateState({ 
                selectedAgreementId: id,
                agreementSearchTerm: agreement.client_name,
                isAgreementSearchOpen: false,
            });
        }
    };

    const handleStartRequest = async () => {
        if (!state.selectedAgreementId) return;
        updateState({ isLoading: true });
        try {
            const details = await getAgreementDetails(Number(state.selectedAgreementId));
            if (!details || details.products.length === 0) {
                toast({ title: 'Sin Productos', description: 'Este acuerdo no tiene productos autorizados.', variant: 'destructive' });
                updateState({ isLoading: false });
                return;
            }
            updateState({
                products: details.products,
                step: 'requesting',
            });
        } catch (error: any) {
            logError('Failed to start replenishment request', { error: error.message });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleQuantityChange = (productId: string, value: string) => {
        updateState({
            quantities: { ...state.quantities, [productId]: value },
        });
    };

    const handleGenerateBoleta = async () => {
        if (!user || !state.selectedAgreementId || selectors.isRequestEmpty) return;
        updateState({ isLoading: true });
        try {
            const linesToSubmit = Object.entries(state.quantities)
                .map(([productId, qtyStr]) => ({
                    productId,
                    quantity: Number(qtyStr) || 0,
                }))
                .filter(line => line.quantity > 0);
            
            const boleta = await saveReplenishmentBoleta(Number(state.selectedAgreementId), linesToSubmit, user.name);
            toast({ title: 'Boleta de Reposición Generada', description: `La boleta ${boleta.consecutive} está pendiente de revisión.` });
            router.push('/dashboard/consignments/boletas');

        } catch (error: any) {
            logError('Failed to generate replenishment boleta', { error: error.message });
            toast({ title: 'Error', description: 'No se pudo generar la boleta.', variant: 'destructive' });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const reset = () => {
        updateState({
            step: 'setup',
            selectedAgreementId: null,
            products: [],
            quantities: {},
            agreementSearchTerm: '',
        });
    };

    const selectors = {
        agreementOptions: useMemo(() => 
            state.agreements
                .filter(a => a.client_name.toLowerCase().includes(debouncedSearch.toLowerCase()))
                .map(a => ({ value: String(a.id), label: a.client_name })),
        [state.agreements, debouncedSearch]),
        getAgreementName: (id: string) => state.agreements.find(a => String(a.id) === id)?.client_name || 'Desconocido',
        getProductName: (id: string) => authProducts.find(p => p.id === id)?.description || 'Desconocido',
        isRequestEmpty: useMemo(() => Object.values(state.quantities).every(q => !q || Number(q) === 0), [state.quantities]),
    };

    return {
        state,
        actions: {
            handleSelectAgreement,
            handleStartRequest,
            handleQuantityChange,
            handleGenerateBoleta,
            reset,
            setAgreementSearchTerm: (term: string) => updateState({ agreementSearchTerm: term }),
            setIsAgreementSearchOpen: (open: boolean) => updateState({ isAgreementSearchOpen: open }),
        },
        selectors
    };
};
