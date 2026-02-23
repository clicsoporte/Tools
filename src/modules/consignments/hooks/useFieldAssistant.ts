/**
 * @fileoverview Hook for managing the logic for the new unified Consignment Field Assistant.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, getAgreementDetails, savePhysicalCount, createClosureFromCount, saveReplenishmentBoleta, lockAgreement, forceRelayLock, releaseAgreementLock } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { ConsignmentAgreement, ConsignmentProduct } from '@/modules/core/types';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useDebounce } from 'use-debounce';

type WizardStep = 'select_client' | 'select_action' | 'counting' | 'finished';
type LockStatus = 'unlocked' | 'locked-by-me' | 'locked-by-other' | 'checking';
type SelectedAction = 'REPOSITION_REQUEST' | 'REPOSITION_BOLETA' | 'INFORMATIONAL_COUNT' | 'CLOSURE_REQUEST';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    step: WizardStep;
    agreements: ConsignmentAgreement[];
    selectedAgreement: ConsignmentAgreement | null;
    productsToCount: ConsignmentProduct[];
    counts: Record<string, string>;
    selectedAction: SelectedAction | null;
    lockStatus: LockStatus;
    lockConflictUser: string | null;
    // Search states
    clientSearchTerm: string;
    isClientSearchOpen: boolean;
}

export const useFieldAssistant = () => {
    const { hasPermission } = useAuthorization(['consignments:count']);
    const { toast } = useToast();
    const { user, products } = useAuth();
    const router = useRouter();
    usePageTitle().setTitle('Asistente de Campo');

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        step: 'select_client',
        agreements: [],
        selectedAgreement: null,
        productsToCount: [],
        counts: {},
        selectedAction: null,
        lockStatus: 'unlocked',
        lockConflictUser: null,
        clientSearchTerm: '',
        isClientSearchOpen: false,
    });

    const [debouncedSearch] = useDebounce(state.clientSearchTerm, 300);
    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const releaseMyLock = useCallback(async () => {
        if (state.selectedAgreement && user && state.lockStatus === 'locked-by-me') {
            await releaseAgreementLock(state.selectedAgreement.id, user.id);
            updateState({ lockStatus: 'unlocked' });
        }
    }, [state.selectedAgreement, user, state.lockStatus]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            try {
                const agreementsData = await getConsignmentAgreements();
                updateState({ agreements: agreementsData.filter(a => a.is_active) });
            } catch (error) {
                logError('Failed to load agreements for field assistant', { error });
            } finally {
                updateState({ isLoading: false });
            }
        };
        if (user) loadInitialData();
        
        // Add event listener for when user tries to leave the page
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (state.lockStatus === 'locked-by-me') {
                releaseMyLock();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Cleanup on unmount
            releaseMyLock();
        };
    }, [user, updateState, releaseMyLock, state.lockStatus]);

    const handleSelectClient = (id: string) => {
        const agreement = state.agreements.find(a => a.id === Number(id));
        if (agreement) {
            updateState({ 
                selectedAgreement: agreement,
                step: 'select_action',
                clientSearchTerm: agreement.client_name,
                isClientSearchOpen: false,
            });
        }
    };
    
    const handleSelectAction = async (action: SelectedAction) => {
        if (!state.selectedAgreement || !user) return;

        updateState({ selectedAction: action, isLoading: true, lockStatus: 'checking' });
        
        try {
            // Attempt to lock the agreement
            const lockResult = await lockAgreement(state.selectedAgreement.id, user.id, user.name);
            if (lockResult.locked) {
                updateState({ lockStatus: 'locked-by-other', lockConflictUser: lockResult.message.split('por ')[1] || 'otro usuario' });
                return;
            }

            // Lock successful
            updateState({ lockStatus: 'locked-by-me' });

            const agreementDetails = await getAgreementDetails(state.selectedAgreement.id);
            if (!agreementDetails || agreementDetails.products.length === 0) {
                toast({ title: 'Sin Productos', description: 'Este acuerdo no tiene productos autorizados.', variant: 'destructive' });
                await releaseMyLock();
                reset();
                return;
            }

            updateState({ productsToCount: agreementDetails.products, step: 'counting' });
        } catch (error: any) {
            logError('Error selecting action/locking agreement', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            reset();
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleForceRelayLock = async () => {
        if (!state.selectedAgreement || !user) return;
        await forceRelayLock(state.selectedAgreement.id, user.id, user.name);
        updateState({ lockStatus: 'unlocked' }); // Reset lock status
        await handleSelectAction(state.selectedAction!); // Re-try the action
    };

    const handleQuantityChange = useCallback((productId: string, value: string) => {
        updateState({ counts: { ...state.counts, [productId]: value } });
        // Implement debounced auto-save here if needed
    }, [state.counts, updateState]);
    
    const handleFinishCount = async () => {
        if (!user || !state.selectedAgreement || !state.selectedAction) return;

        updateState({ isSubmitting: true });
        try {
            const linesToSubmit = Object.entries(state.counts)
                .map(([productId, qtyStr]) => ({ productId, quantity: Number(qtyStr) || 0 }))
                .filter(line => line.quantity >= 0);

            switch(state.selectedAction) {
                case 'INFORMATIONAL_COUNT':
                    await savePhysicalCount(state.selectedAgreement.id, linesToSubmit, user.name);
                    toast({ title: 'Conteo Guardado', description: 'El conteo informativo ha sido guardado exitosamente.' });
                    break;
                case 'CLOSURE_REQUEST':
                    const closure = await createClosureFromCount(state.selectedAgreement.id, linesToSubmit, user.name);
                    toast({ title: 'Solicitud de Cierre Generada', description: `Se creó el Cierre ${closure.consecutive} y está pendiente de aprobación.` });
                    break;
                case 'REPOSITION_REQUEST':
                    const repoBoleta = await saveReplenishmentBoleta(state.selectedAgreement.id, linesToSubmit, user.name);
                    toast({ title: 'Boleta de Reposición Generada', description: `La boleta ${repoBoleta.consecutive} está pendiente de revisión.` });
                    break;
                case 'REPOSITION_BOLETA':
                    // This action requires more complex logic, creating a boleta with calculated quantities
                    // For now, we'll just log it. This needs full implementation.
                    console.log('Generating boleta by count...');
                    toast({ title: 'Acción Pendiente', description: 'La generación automática de boletas por conteo se implementará.' });
                    break;
            }
            updateState({ step: 'finished' });
        } catch (error: any) {
            logError('Failed to finish count action', { error: error.message });
            toast({ title: 'Error', description: `No se pudo completar la acción: ${error.message}`, variant: 'destructive' });
        } finally {
            await releaseMyLock();
            updateState({ isSubmitting: false });
        }
    };
    
    const cancelAndReleaseLock = async () => {
        await releaseMyLock();
        reset();
    };

    const reset = () => {
        updateState({
            step: 'select_client',
            selectedAgreement: null,
            productsToCount: [],
            counts: {},
            selectedAction: null,
            lockStatus: 'unlocked',
            lockConflictUser: null,
            clientSearchTerm: '',
        });
    };

    const selectors = {
        agreementOptions: useMemo(() => 
            state.agreements
                .filter(a => a.client_name.toLowerCase().includes(debouncedSearch.toLowerCase()))
                .map(a => ({ value: String(a.id), label: a.client_name })),
        [state.agreements, debouncedSearch]),
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
        hasCounts: useMemo(() => Object.values(state.counts).some(q => q.trim() !== ''), [state.counts]),
    };
    
    return {
        state,
        actions: {
            handleSelectClient,
            handleSelectAction,
            handleQuantityChange,
            handleFinishCount,
            reset,
            setClientSearchTerm: (term: string) => updateState({ clientSearchTerm: term }),
            setIsClientSearchOpen: (open: boolean) => updateState({ isClientSearchOpen: open }),
            handleForceRelayLock,
            cancelAndReleaseLock,
        },
        selectors
    };
};
