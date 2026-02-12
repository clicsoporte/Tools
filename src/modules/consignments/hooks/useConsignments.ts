/**
 * @fileoverview Hook for managing the state and logic of the Consignments module main page.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { 
    getConsignmentAgreements, 
    saveConsignmentAgreement, 
    getAgreementDetails,
    deleteConsignmentAgreement,
    startOrContinueCountingSession, 
    saveCountLine,
    abandonCountingSession, 
    generateBoletaFromSession, 
    getBoletas,
    updateBoletaStatus,
    getBoletaDetails,
    updateBoleta,
} from '../lib/actions';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory } from '@/modules/core/types';

const emptyAgreement: Partial<ConsignmentAgreement> = {
    client_id: '',
    client_name: '',
    erp_warehouse_id: '',
    notes: '',
    is_active: 1,
};

const initialCountingState = {
    isLoading: false,
    selectedAgreementId: null as string | null,
    session: null as (CountingSession & { lines: CountingSessionLine[] }) | null,
    productsToCount: [] as ConsignmentProduct[],
};

const initialState = {
    isLoading: true,
    isSubmitting: false,
    currentTab: 'agreements',
    agreements: [] as (ConsignmentAgreement & { product_count?: number })[],
    showOnlyActiveAgreements: true,
    // Agreement Form
    isAgreementFormOpen: false,
    editingAgreement: null as ConsignmentAgreement | null,
    agreementToDelete: null as ConsignmentAgreement | null,
    agreementFormData: emptyAgreement,
    agreementProducts: [] as ConsignmentProduct[],
    clientSearchTerm: '',
    isClientSearchOpen: false,
    warehouseSearchTerm: '',
    isWarehouseSearchOpen: false,
    productSearchTerm: '',
    isProductSearchOpen: false,
    // Inventory Count
    countingState: initialCountingState,
    // Boletas
    boletasState: {
        isLoading: false,
        boletas: [] as RestockBoleta[],
        filters: { status: ['pending', 'approved'] },
    }
};


export const useConsignments = () => {
    const { setTitle } = usePageTitle();
    const { hasPermission, isAuthorized } = useAuthorization(['consignments:access']);
    const { toast } = useToast();
    const { user, customers, products, stockSettings, companyData } = useAuth();

    // --- MAIN STATE ---
    const [state, setState] = useState(initialState);

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const [debouncedClientSearch] = useDebounce(state.clientSearchTerm, companyData?.searchDebounceTime ?? 500);

    // --- DATA FETCHING ---
    const loadAgreements = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const agreementsData = await getConsignmentAgreements();
            updateState({ agreements: agreementsData });
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar los acuerdos.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        setTitle('Gestión de Consignaciones');
        if (isAuthorized) {
            loadAgreements();
        }
    }, [setTitle, isAuthorized, loadAgreements]);

    // --- AGREEMENTS LOGIC ---
    const agreementActions = {
        openAgreementForm: async (agreement: ConsignmentAgreement | null = null) => {
            if (agreement) {
                const details = await getAgreementDetails(agreement.id);
                if (details) {
                    updateState({
                        editingAgreement: agreement,
                        agreementFormData: details.agreement,
                        agreementProducts: details.products,
                        clientSearchTerm: details.agreement.client_name,
                        warehouseSearchTerm: details.agreement.erp_warehouse_id || '',
                        isAgreementFormOpen: true,
                    });
                }
            } else {
                updateState({
                    editingAgreement: null,
                    agreementFormData: emptyAgreement,
                    agreementProducts: [],
                    clientSearchTerm: '',
                    warehouseSearchTerm: '',
                    isAgreementFormOpen: true,
                });
            }
        },
        handleFieldChange: (field: keyof ConsignmentAgreement, value: any) => {
            const newFormData = { ...state.agreementFormData, [field]: value } as Partial<ConsignmentAgreement>;
            if (field === 'client_id') {
                const client = customers.find(c => c.id === value);
                if (client) {
                    newFormData.client_name = client.name;
                    agreementActions.setClientSearchTerm(client.name);
                }
            }
            if (field === 'erp_warehouse_id') {
                 agreementActions.setWarehouseSearchTerm(value);
            }
            updateState({ agreementFormData: newFormData });
        },
        addProductToAgreement: (productId: string) => {
            const product = products.find(p => p.id === productId);
            if (product && !state.agreementProducts.some(p => p.product_id === productId)) {
                const newProduct: ConsignmentProduct = { id: 0, agreement_id: 0, product_id: productId, max_stock: 0, price: 0 };
                updateState({ agreementProducts: [...state.agreementProducts, newProduct], productSearchTerm: '', isProductSearchOpen: false });
            }
        },
        removeProductFromAgreement: (index: number) => {
            updateState({ agreementProducts: state.agreementProducts.filter((_, i) => i !== index) });
        },
        updateProductField: (index: number, field: keyof ConsignmentProduct, value: any) => {
            const updatedProducts = [...state.agreementProducts];
            (updatedProducts[index] as any)[field] = value;
            updateState({ agreementProducts: updatedProducts });
        },
        handleSaveAgreement: async () => {
            if (!state.agreementFormData.client_id || !state.agreementFormData.client_name) {
                toast({ title: 'Cliente requerido', variant: 'destructive' });
                return;
            }
            updateState({ isSubmitting: true });
            try {
                const payload = {
                    ...state.agreementFormData,
                    client_id: state.agreementFormData.client_id,
                    client_name: state.agreementFormData.client_name,
                    is_active: state.agreementFormData.is_active ?? 1,
                } as Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id?: number };

                await saveConsignmentAgreement(payload, state.agreementProducts);
                toast({ title: 'Acuerdo Guardado' });
                updateState({ isAgreementFormOpen: false });
                await loadAgreements();
            } catch (error) {
                toast({ title: 'Error al Guardar', variant: 'destructive' });
            } finally {
                updateState({ isSubmitting: false });
            }
        },
        toggleAgreementStatus: async (id: number, isActive: boolean) => {
            const originalAgreement = state.agreements.find(a => a.id === id);
            if (!originalAgreement) return;
        
            // Optimistic UI update
            const updatedAgreements = state.agreements.map(a =>
              a.id === id ? { ...a, is_active: isActive ? 1 : 0 } : a
            );
            updateState({ agreements: updatedAgreements });
        
            const { product_count, ...agreementToSend } = originalAgreement;
            const payloadToSave: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id: number; is_active: 0 | 1; } = {
                ...agreementToSend,
                is_active: isActive ? 1 : 0,
            };
        
            try {
                await saveConsignmentAgreement(payloadToSave, []); // Pass empty products when just toggling status
                toast({ title: `Acuerdo ${isActive ? 'habilitado' : 'deshabilitado'}` });
                // No full reload needed, the UI is already updated.
            } catch (error) {
                toast({ title: 'Error al actualizar', variant: 'destructive' });
                // Revert UI on error
                const revertedAgreements = state.agreements.map(a =>
                    a.id === id ? { ...a, is_active: originalAgreement.is_active } : a
                );
                updateState({ agreements: revertedAgreements });
            }
        },
        handleDeleteAgreement: async () => {
            if (!state.agreementToDelete) return;
            updateState({ isSubmitting: true });
            try {
                await deleteConsignmentAgreement(state.agreementToDelete.id);
                toast({ title: 'Acuerdo Eliminado' });
                updateState({ agreementToDelete: null });
                await loadAgreements();
            } catch (error: any) {
                toast({ title: 'Error al Eliminar', description: error.message, variant: 'destructive' });
            } finally {
                updateState({ isSubmitting: false });
            }
        },
        setShowOnlyActiveAgreements: (show: boolean) => updateState({ showOnlyActiveAgreements: show }),
        setAgreementToDelete: (agreement: ConsignmentAgreement | null) => updateState({ agreementToDelete: agreement }),
        setIsAgreementFormOpen: (isOpen: boolean) => updateState({ isAgreementFormOpen: isOpen }),
        setClientSearchTerm: (term: string) => updateState({ clientSearchTerm: term }),
        setIsClientSearchOpen: (isOpen: boolean) => updateState({ isClientSearchOpen: isOpen }),
        setWarehouseSearchTerm: (term: string) => updateState({ warehouseSearchTerm: term }),
        setIsWarehouseSearchOpen: (isOpen: boolean) => updateState({ isWarehouseSearchOpen: isOpen }),
        setProductSearchTerm: (term: string) => updateState({ productSearchTerm: term }),
        setIsProductSearchOpen: (isOpen: boolean) => updateState({ isProductSearchOpen: isOpen }),
    };

    // --- COUNTING LOGIC ---
    const countActions = {
        handleSelectAgreement: (id: string) => updateState({ countingState: { ...state.countingState, selectedAgreementId: id } }),
        handleStartSession: async () => {
            if (!user || !state.countingState.selectedAgreementId) return;
            updateState({ countingState: { ...state.countingState, isLoading: true } });
            try {
                const session = await startOrContinueCountingSession(Number(state.countingState.selectedAgreementId), user.id);
                const details = await getAgreementDetails(Number(state.countingState.selectedAgreementId));
                updateState({ 
                    countingState: { 
                        ...state.countingState, 
                        isLoading: false,
                        session, 
                        productsToCount: details?.products || [] 
                    } 
                });
            } catch (error: any) {
                toast({ title: 'Error al iniciar sesión', description: error.message, variant: 'destructive' });
                updateState({ countingState: { ...state.countingState, isLoading: false } });
            }
        },
        handleSaveLine: (productId: string, quantity: number) => {
            if (!state.countingState.session) return;
            saveCountLine(state.countingState.session.id, productId, quantity);
            // No toast here to avoid being annoying
        },
        handleAbandonSession: async () => {
            if (!user || !state.countingState.session) return;
            await abandonCountingSession(state.countingState.session.id, user.id);
            updateState({ countingState: { ...initialCountingState, selectedAgreementId: state.countingState.selectedAgreementId } });
        },
        handleGenerateBoleta: async () => {
             if (!user || !state.countingState.session) return;
             updateState({ countingState: { ...state.countingState, isLoading: true } });
             try {
                const newBoleta = await generateBoletaFromSession(state.countingState.session.id, user.id, user.name);
                toast({ title: 'Boleta Generada', description: `Se creó la boleta ${newBoleta.consecutive}` });
                updateState({ currentTab: 'boletas', countingState: initialCountingState });
                boletaActions.loadBoletas();
             } catch (error) {
                 toast({ title: 'Error al generar boleta', variant: 'destructive'});
             } finally {
                updateState({ countingState: { ...state.countingState, isLoading: false } });
             }
        }
    };
    
    // --- BOLETAS LOGIC ---
     const boletaActions = {
        loadBoletas: async () => {
            updateState({ boletasState: { ...state.boletasState, isLoading: true } });
            try {
                const boletasData = await getBoletas(state.boletasState.filters);
                updateState({ boletasState: { ...state.boletasState, boletas: boletasData } });
            } catch (error) {
                 toast({ title: 'Error', description: 'No se pudieron cargar las boletas.', variant: 'destructive'});
            } finally {
                 updateState({ boletasState: { ...state.boletasState, isLoading: false } });
            }
        },
        openBoletaDetails: (boletaId: number) => { /* Logic to open detail modal */ },
        openStatusModal: (boleta: RestockBoleta, status: string) => { /* Logic to open status change modal */ },
    };

    useEffect(() => {
        if (state.currentTab === 'boletas') {
            boletaActions.loadBoletas();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.currentTab]);
    
    // --- SELECTORS ---
    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, companyData?.searchDebounceTime ?? 500);

    const selectors = {
        hasPermission,
        filteredAgreements: useMemo(() => {
            if (!state.showOnlyActiveAgreements) {
                return state.agreements;
            }
            return state.agreements.filter(a => a.is_active === 1);
        }, [state.agreements, state.showOnlyActiveAgreements]),
        agreementOptions: useMemo(() => {
            const activeAgreements = state.agreements.filter(a => a.is_active === 1);
            return activeAgreements.map(a => ({ value: String(a.id), label: a.client_name }));
        }, [state.agreements]),
        customerOptions: useMemo(() => {
            if (debouncedClientSearch.length < 2) return [];
            return customers.filter(c => c.name.toLowerCase().includes(debouncedClientSearch.toLowerCase()) || c.id.includes(debouncedClientSearch))
            .map(c => ({ value: c.id, label: `[${c.id}] ${c.name}` }));
        }, [customers, debouncedClientSearch]),
        warehouseOptions: useMemo(() => stockSettings?.warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.id})` })) || [], [stockSettings]),
        productOptions: useMemo(() => {
            if (debouncedProductSearch.length < 2) return [];
            return products
                .filter(p => p.id.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p.description.toLowerCase().includes(debouncedProductSearch.toLowerCase()))
                .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
        }, [products, debouncedProductSearch]),
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
        getAgreementName: (id: number) => state.agreements.find(a => a.id === id)?.client_name || 'Desconocido',
        getInitialCount: (productId: string) => state.countingState.session?.lines.find(l => l.product_id === productId)?.counted_quantity,
    };
    
    return {
        state,
        actions: {
            setCurrentTab: (tab: 'agreements' | 'inventory_count' | 'boletas') => updateState({ currentTab: tab }),
            agreementActions,
            countActions,
            boletaActions,
        },
        selectors,
        isAuthorized,
    };
};