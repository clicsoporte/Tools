/**
 * @fileoverview Hook for managing the logic for the Consignments Closures page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getPeriodClosures, approvePeriodClosure, rejectPeriodClosure } from '../lib/actions';
import type { PeriodClosure } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface State {
    isInitialLoading: boolean;
    isRefreshing: boolean;
    isSubmitting: boolean;
    closures: (PeriodClosure & { client_name: string })[];
    isDetailsModalOpen: boolean;
    selectedClosure: PeriodClosure | null;
    previousClosureId: number | null;
    notes: string;
    availablePreviousClosures: PeriodClosure[];
}

export const useConsignmentsClosures = () => {
    const { isAuthorized } = useAuthorization(['consignments:boleta:approve']);
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();

    const [state, setState] = useState<State>({
        isInitialLoading: true,
        isRefreshing: false,
        isSubmitting: false,
        closures: [],
        isDetailsModalOpen: false,
        selectedClosure: null,
        previousClosureId: null,
        notes: '',
        availablePreviousClosures: [],
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) updateState({ isRefreshing: true });
        try {
            const closuresData = await getPeriodClosures({});
            updateState({ closures: closuresData });
        } catch (error: any) {
            logError('Failed to load period closures', { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar los cierres.", variant: "destructive" });
        } finally {
            if (isRefresh) updateState({ isRefreshing: false });
            if (state.isInitialLoading) updateState({ isInitialLoading: false });
        }
    }, [toast, updateState, state.isInitialLoading]);

    useEffect(() => {
        if (isAuthorized) {
            loadData();
        } else {
            updateState({ isInitialLoading: false });
        }
    }, [isAuthorized, loadData, updateState]);

    const handleViewClosure = async (closureId: number) => {
        const closure = state.closures.find(c => c.id === closureId);
        if (!closure) return;
        
        if (closure.status === 'approved') {
            router.push(`/dashboard/analytics/billing-report?closureId=${closureId}`);
            return;
        }

        if (closure.status === 'pending') {
            const previousClosures = state.closures
                .filter(c => c.agreement_id === closure.agreement_id && c.status === 'approved')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            updateState({ 
                selectedClosure: closure, 
                availablePreviousClosures: previousClosures,
                previousClosureId: previousClosures.length > 0 ? previousClosures[0].id : null,
                isDetailsModalOpen: true 
            });
        }
    };
    
    const handleInitiateClosure = () => {
        router.push('/dashboard/consignments/inventory-count');
    }

    const handleApprove = async () => {
        if (!user || !state.selectedClosure) return;
        updateState({ isSubmitting: true });
        try {
            await approvePeriodClosure(state.selectedClosure.id, state.previousClosureId, user.name);
            toast({ title: 'Cierre Aprobado', description: 'El período está listo para generar el reporte de facturación.' });
            updateState({ isDetailsModalOpen: false, selectedClosure: null });
            await loadData(true);
        } catch (error: any) {
            logError('Failed to approve period closure', { error: error.message });
            toast({ title: 'Error', description: `No se pudo aprobar el cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleReject = async (notes: string) => {
        if (!user || !state.selectedClosure) return;
        if (!notes.trim()) {
            toast({ title: 'Rechazo requiere nota', description: 'Por favor, indica el motivo del rechazo.', variant: 'destructive' });
            return;
        }
        updateState({ isSubmitting: true });
        try {
            await rejectPeriodClosure(state.selectedClosure.id, notes, user.name);
            toast({ title: 'Cierre Rechazado' });
            updateState({ isDetailsModalOpen: false, selectedClosure: null });
            await loadData(true);
        } catch (error: any) {
            logError('Failed to reject period closure', { error: error.message });
            toast({ title: 'Error', description: `No se pudo rechazar el cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const selectors = {
        getStatusLabel: (status: string) => {
            switch (status) {
                case 'pending': return 'Pendiente Aprobación';
                case 'approved': return 'Aprobado';
                case 'rejected': return 'Rechazado';
                case 'invoiced': return 'Facturado';
                default: return 'Desconocido';
            }
        },
    };

    return {
        state,
        actions: {
            loadData,
            handleViewClosure,
            handleInitiateClosure,
            setDetailsModalOpen: (open: boolean) => updateState({ isDetailsModalOpen: open }),
            setPreviousClosureId: (id: number | null) => updateState({ previousClosureId: id }),
            setNotes: (notes: string) => updateState({ notes }),
            handleApprove,
            handleReject,
        },
        selectors
    };
};
