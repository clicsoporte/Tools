/**
 * @fileoverview Hook for managing the logic for the Consignments Closures page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { 
    getPeriodClosures, 
    approvePeriodClosure, 
    rejectPeriodClosure, 
    getPhysicalCountDetails, 
    getAgreementDetails, 
    getRecentPhysicalCounts, 
    createClosureFromCount,
    getConsignmentAgreements, // Import missing function
    annulPeriodClosure,
} from '../lib/actions';
import type { PeriodClosure, PhysicalCount, ConsignmentAgreement, ConsignmentProduct } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useDebounce } from 'use-debounce';

interface State {
    isInitialLoading: boolean;
    isRefreshing: boolean;
    isSubmitting: boolean;
    closures: (PeriodClosure & { client_name: string; is_initial_inventory: boolean; previous_closure_consecutive?: string; })[];
    isDetailsModalOpen: boolean;
    isDetailsLoading: boolean;
    selectedClosure: (PeriodClosure & { is_initial_inventory: boolean }) | null;
    previousClosureId: number | null;
    notes: string;
    availablePreviousClosures: PeriodClosure[];
    physicalCountLines: PhysicalCount[];
    // New state for the "New Closure" wizard
    isNewClosureModalOpen: boolean;
    newClosureStep: 'select_client' | 'select_action';
    agreements: ConsignmentAgreement[];
    selectedAgreementForClosure: ConsignmentAgreement | null;
    newClosureClientSearch: string;
    isNewClosureClientSearchOpen: boolean;
    availablePhysicalCounts: { counted_at: string; counted_by: string; }[];
    selectedPhysicalCountRef: string | null;
    initialInventoryData: Record<string, string>;
    initialInventoryProducts: ConsignmentProduct[];
    // Annul state
    isAnnulConfirmOpen: boolean;
    annulConfirmationText: string;
    closureToAnnul: PeriodClosure | null;
}

export const useConsignmentsClosures = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['consignments:boleta:approve', 'consignments:closures:create', 'consignments:closures:annul']);
    const { toast } = useToast();
    const { user, products } = useAuth();
    const router = useRouter();

    const [state, setState] = useState<State>({
        isInitialLoading: true,
        isRefreshing: false,
        isSubmitting: false,
        closures: [],
        isDetailsModalOpen: false,
        isDetailsLoading: false,
        selectedClosure: null,
        previousClosureId: null,
        notes: '',
        availablePreviousClosures: [],
        physicalCountLines: [],
        isNewClosureModalOpen: false,
        newClosureStep: 'select_client',
        agreements: [],
        selectedAgreementForClosure: null,
        newClosureClientSearch: '',
        isNewClosureClientSearchOpen: false,
        availablePhysicalCounts: [],
        selectedPhysicalCountRef: null,
        initialInventoryData: {},
        initialInventoryProducts: [],
        isAnnulConfirmOpen: false,
        annulConfirmationText: '',
        closureToAnnul: null,
    });

    const [debouncedNewClosureClientSearch] = useDebounce(state.newClosureClientSearch, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) updateState({ isRefreshing: true });
        try {
            const [closuresData, agreementsData] = await Promise.all([
                getPeriodClosures({}),
                getConsignmentAgreements(),
            ]);
            updateState({ closures: closuresData, agreements: agreementsData.filter(a => a.is_active) });
        } catch (error: any) {
            logError('Failed to load period closures', { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar los cierres o acuerdos.", variant: "destructive" });
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
    
     const resetNewClosureModal = () => {
        updateState({
            isNewClosureModalOpen: false,
            newClosureStep: 'select_client',
            selectedAgreementForClosure: null,
            newClosureClientSearch: '',
            availablePhysicalCounts: [],
            selectedPhysicalCountRef: null,
            initialInventoryData: {},
            initialInventoryProducts: [],
        });
    };

    const handleNewClosureModalOpenChange = (open: boolean) => {
        if (!open) {
            resetNewClosureModal();
        } else {
            updateState({ isNewClosureModalOpen: true });
        }
    };

    const handleSelectAgreementForClosure = async (agreementId: string) => {
        const id = Number(agreementId);
        const agreement = state.agreements.find(a => a.id === id);
        if (!agreement) return;

        updateState({ isDetailsLoading: true, selectedAgreementForClosure: agreement, newClosureClientSearch: agreement.client_name, isNewClosureClientSearchOpen: false });

        try {
            if (agreement.has_initial_inventory === 1) {
                const physicalCounts = await getRecentPhysicalCounts(id);
                updateState({ availablePhysicalCounts: physicalCounts, newClosureStep: 'select_action' });
            } else {
                const details = await getAgreementDetails(id);
                updateState({ initialInventoryProducts: details?.products || [], newClosureStep: 'select_action' });
            }
        } catch (error: any) {
             toast({ title: 'Error', description: 'No se pudieron cargar los detalles del acuerdo.', variant: 'destructive'});
        } finally {
            updateState({ isDetailsLoading: false });
        }
    };
    
    const handleCreateClosureFromCount = async (physicalCountRef: string) => {
        if (!user || !state.selectedAgreementForClosure) return;
        updateState({ isSubmitting: true, selectedPhysicalCountRef: physicalCountRef });
        
        try {
            const counts = await getPhysicalCountDetails(state.selectedAgreementForClosure.id, physicalCountRef);
            const linesToSubmit = counts.map(c => ({ productId: c.product_id, quantity: c.quantity }));

            const closure = await createClosureFromCount(state.selectedAgreementForClosure.id, linesToSubmit, user.name);
            toast({ title: 'Solicitud de Cierre Generada', description: `Se creó el Cierre ${closure.consecutive} y está pendiente de aprobación.` });
            resetNewClosureModal();
            await loadData(true);
        } catch (error: any) {
            logError('Failed to create closure from count', { error: error.message });
            toast({ title: 'Error', description: `No se pudo generar el cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false, selectedPhysicalCountRef: null });
        }
    };

    const handleInitialInventoryDataChange = (productId: string, value: string) => {
        updateState({ initialInventoryData: { ...state.initialInventoryData, [productId]: value } });
    };

    const handleCreateInitialInventoryClosure = async () => {
        if (!user || !state.selectedAgreementForClosure) return;
        
        const linesToSubmit = Object.entries(state.initialInventoryData)
            .map(([productId, qtyStr]) => ({ productId, quantity: Number(qtyStr) || 0 }))
            .filter(line => line.quantity >= 0);

        if (linesToSubmit.length === 0) {
            toast({ title: 'Datos requeridos', description: 'Debe ingresar la cantidad para al menos un producto.', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            const closure = await createClosureFromCount(state.selectedAgreementForClosure.id, linesToSubmit, user.name);
            toast({ title: 'Inventario Inicial Registrado', description: `Se creó el Cierre ${closure.consecutive} y está pendiente de aprobación.` });
            resetNewClosureModal();
            await loadData(true);
        } catch (error: any) {
            logError('Failed to create initial inventory closure from office', { error: error.message });
            toast({ title: 'Error', description: `No se pudo generar el cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };


    const handleViewClosure = async (closure: PeriodClosure & { is_initial_inventory: boolean }) => {
        if (closure.status === 'approved') {
            router.push(`/dashboard/analytics/billing-report?closureId=${closure.id}`);
            return;
        }

        updateState({ isDetailsLoading: true, selectedClosure: closure, physicalCountLines: [] });

        try {
            if (closure.physical_count_ref) {
                const counts = await getPhysicalCountDetails(closure.agreement_id, closure.physical_count_ref);
                updateState({ physicalCountLines: counts });
            }

            if (closure.status === 'pending') {
                const usedClosureIds = new Set(state.closures.map(c => c.previous_closure_id).filter(Boolean));
                const previousClosures = state.closures
                    .filter(c => 
                        c.agreement_id === closure.agreement_id && 
                        c.status === 'approved' &&
                        !usedClosureIds.has(c.id) // Exclude used closures
                    )
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                updateState({ 
                    availablePreviousClosures: previousClosures,
                    previousClosureId: previousClosures.length > 0 ? previousClosures[0].id : null,
                });
            }

            updateState({ isDetailsModalOpen: true });
        } catch (error: any) {
            logError('Failed to get closure details', { error: error.message, closureId: closure.id });
            toast({ title: 'Error', description: `No se pudieron cargar los detalles del cierre: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isDetailsLoading: false });
        }
    };
    
    const handleInitiateClosure = () => {
        updateState({ isNewClosureModalOpen: true });
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

    const handleAnnul = async () => {
        if (!user || !state.closureToAnnul || state.annulConfirmationText !== 'ANULAR') return;
        updateState({ isSubmitting: true });
        try {
            await annulPeriodClosure(state.closureToAnnul.id, user.name);
            toast({ title: 'Cierre Anulado', description: 'El cierre ha sido anulado y el acuerdo podría necesitar una reinicialización.'});
            updateState({ isAnnulConfirmOpen: false, closureToAnnul: null, annulConfirmationText: '' });
            await loadData(true);
        } catch(error: any) {
            logError('Failed to annul period closure', { error: error.message });
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    }

    const selectors = {
        getStatusLabel: (status: string) => {
            switch (status) {
                case 'pending': return 'Pendiente Aprobación';
                case 'approved': return 'Aprobado';
                case 'rejected': return 'Rechazado';
                case 'invoiced': return 'Facturado';
                case 'annulled': return 'Anulado';
                default: return 'Desconocido';
            }
        },
        agreementOptions: useMemo(() => {
            if (!debouncedNewClosureClientSearch) {
                return state.agreements.map(a => ({ value: String(a.id), label: a.client_name }));
            }
            return state.agreements
                .filter(a => a.client_name.toLowerCase().includes(debouncedNewClosureClientSearch.toLowerCase()))
                .map(a => ({ value: String(a.id), label: a.client_name }));
        }, [state.agreements, debouncedNewClosureClientSearch]),
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
        hasPermission,
    };

    return {
        state,
        actions: {
            loadData,
            handleViewClosure,
            handleInitiateClosure,
            handleNewClosureModalOpenChange,
            handleSelectAgreementForClosure,
            setDetailsModalOpen: (open: boolean) => updateState({ isDetailsModalOpen: open }),
            setPreviousClosureId: (id: number | null) => updateState({ previousClosureId: id }),
            setNotes: (notes: string) => updateState({ notes }),
            handleApprove,
            handleReject,
            setNewClosureClientSearch: (term: string) => updateState({ newClosureClientSearch: term }),
            setIsNewClosureClientSearchOpen: (open: boolean) => updateState({ isNewClosureClientSearchOpen: open }),
            handleCreateClosureFromCount,
            handleInitialInventoryDataChange,
            handleCreateInitialInventoryClosure,
            setAnnulConfirmOpen: (open: boolean) => updateState({ isAnnulConfirmOpen: open }),
            setAnnulConfirmationText: (text: string) => updateState({ annulConfirmationText: text }),
            setClosureToAnnul: (closure: PeriodClosure | null) => updateState({ closureToAnnul: closure }),
            handleAnnul,
        },
        selectors
    };
};
