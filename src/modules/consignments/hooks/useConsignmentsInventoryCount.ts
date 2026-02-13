/**
 * @fileoverview Hook for managing the logic for the Consignments Inventory Count page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, startOrContinueCountingSession, saveCountLine, abandonCountingSession, generateBoletaFromSession, getActiveCountingSessionForUser, getAgreementDetails } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { ConsignmentAgreement, CountingSession, CountingSessionLine, ConsignmentProduct } from '@/modules/core/types';
import { createNotificationForPermission } from '@/modules/core/lib/notifications-actions';

type WizardStep = 'setup' | 'resume' | 'counting' | 'finished';

interface State {
    isLoading: boolean;
    step: WizardStep;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    session: (CountingSession & { lines: CountingSessionLine[] }) | null;
    existingSession: (CountingSession & { lines: CountingSessionLine[] }) | null;
    productsToCount: ConsignmentProduct[];
    counts: Record<string, string>;
    lastCountInfo: { product: string; location: string; quantity: number } | null;
}


export const useConsignmentsInventoryCount = () => {
    const { hasPermission } = useAuthorization(['consignments:count']);
    const { toast } = useToast();
    const { user, products } = useAuth();
    const router = useRouter();

    const [state, setState] = useState<State>({
        isLoading: true,
        step: 'setup' as WizardStep,
        agreements: [] as ConsignmentAgreement[],
        selectedAgreementId: null as string | null,
        session: null as (CountingSession & { lines: CountingSessionLine[] }) | null,
        existingSession: null as (CountingSession & { lines: CountingSessionLine[] }) | null,
        productsToCount: [] as ConsignmentProduct[],
        counts: {} as Record<string, string>,
        lastCountInfo: null,
    });

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            try {
                const [agreementsData, activeSession] = await Promise.all([
                    getConsignmentAgreements(),
                    getActiveCountingSessionForUser(user.id)
                ]);
                updateState({ agreements: agreementsData.filter(a => a.is_active) });
                if (activeSession) {
                    const initialCounts: Record<string, string> = {};
                    activeSession.lines.forEach(line => {
                        initialCounts[line.product_id] = String(line.counted_quantity);
                    });
                    updateState({ existingSession: activeSession, step: 'resume', counts: initialCounts });
                }
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
    
    const handleSelectAgreement = (id: string) => updateState({ selectedAgreementId: id });

    const handleStartSession = async () => {
        if (!user || !state.selectedAgreementId) return;
        updateState({ isLoading: true });
        try {
            const agreementId = Number(state.selectedAgreementId);
            const [sessionData, agreementDetails] = await Promise.all([
                startOrContinueCountingSession(agreementId, user.id),
                getAgreementDetails(agreementId)
            ]);

            if (!agreementDetails || agreementDetails.products.length === 0) {
                 toast({ title: 'Sin Productos', description: 'Este acuerdo no tiene productos autorizados para consignación. No se puede iniciar el conteo.', variant: 'destructive', duration: 6000 });
                 await abandonCountingSession(sessionData.id, user.id);
                 updateState({ isLoading: false });
                 return;
            }

            const initialCounts: Record<string, string> = {};
            sessionData.lines.forEach(line => {
                initialCounts[line.product_id] = String(line.counted_quantity);
            });

            updateState({ 
                session: sessionData, 
                productsToCount: agreementDetails?.products || [],
                step: 'counting',
                counts: initialCounts,
            });
        } catch (error: any) {
            logError('Failed to start counting session', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleQuantityChange = (productId: string, value: string) => {
        updateState({
            counts: {
                ...state.counts,
                [productId]: value
            }
        });
    };

    const handleSaveLine = async (productId: string, quantity: number) => {
        if (!state.session) return;
        if (isNaN(quantity)) return;

        await saveCountLine(state.session.id, productId, quantity);
        toast({ title: 'Guardado', description: 'Conteo registrado.', duration: 2000 });
    };

    const abandonSession = async () => {
        if (!user || !state.existingSession) return;
        await abandonCountingSession(state.existingSession.id, user.id);
        updateState({ existingSession: null, step: 'setup' });
    };

    const resumeSession = async () => {
        if (!state.existingSession) return;
        updateState({ isLoading: true });
        try {
            const agreementDetails = await getAgreementDetails(state.existingSession.agreement_id);
            const initialCounts: Record<string, string> = {};
            state.existingSession.lines.forEach(line => {
                initialCounts[line.product_id] = String(line.counted_quantity);
            });
            updateState({ 
                session: state.existingSession, 
                productsToCount: agreementDetails?.products || [],
                step: 'counting',
                existingSession: null,
                counts: initialCounts,
            });
        } catch (error: any) {
            logError('Failed to resume session', { error: error.message });
            toast({ title: 'Error al Reanudar', description: 'No se pudieron cargar los detalles del acuerdo.', variant: 'destructive'});
        } finally {
            updateState({ isLoading: false });
        }
    };

    const abandonCurrentSession = async () => {
        if (!user || !state.session) return;
        await abandonCountingSession(state.session.id, user.id);
        updateState({ session: null, step: 'setup', productsToCount: [], counts: {} });
    };

    const handleGenerateBoleta = async () => {
        if (!user || !state.session) return;
        if (state.productsToCount.length === 0) {
            toast({ title: "Acción no permitida", description: "No puedes generar una boleta para un acuerdo sin productos autorizados.", variant: "destructive" });
            return;
        }
        updateState({ isLoading: true });
        try {
            const boleta = await generateBoletaFromSession(state.session.id, user.id, user.name);
            toast({ title: 'Boleta Generada', description: `La boleta ${boleta.consecutive} se ha creado y está pendiente de revisión.` });
            
            await createNotificationForPermission(
                'consignments:boleta:approve',
                `Nueva boleta de consignación ${boleta.consecutive} requiere revisión.`,
                '/dashboard/consignments/boletas',
                boleta.id,
                'consignment_boleta',
                'review'
            );

            router.push('/dashboard/consignments/boletas');
        } catch (error: any) {
            logError('Failed to generate boleta', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const reset = () => {
        updateState({
            step: 'setup',
            selectedAgreementId: null,
            session: null,
            productsToCount: [],
            counts: {},
            lastCountInfo: null,
        });
    };

    const selectors = {
        agreementOptions: useMemo(() => state.agreements.map(a => ({ value: String(a.id), label: a.client_name })), [state.agreements]),
        getAgreementName: (id: number) => state.agreements.find(a => a.id === id)?.client_name || 'Desconocido',
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
    };
    
    return {
        state,
        actions: {
            handleSelectAgreement,
            handleStartSession,
            handleQuantityChange,
            handleSaveLine,
            abandonSession,
            resumeSession,
            abandonCurrentSession,
            handleGenerateBoleta,
            reset,
        },
        selectors
    };
};
