/**
 * @fileoverview Hook for managing the logic for the Consignments Agreements page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, saveConsignmentAgreement, deleteConsignmentAgreement, getAgreementDetails } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import type { ConsignmentAgreement, ConsignmentProduct, Product, Warehouse } from '@/modules/core/types';

const emptyAgreement: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> = {
  client_id: '',
  client_name: '',
  is_active: 1,
};

export const useConsignmentsAgreements = () => {
    const { hasPermission } = useAuthorization(['consignments:setup']);
    const { toast } = useToast();
    const { customers, products: authProducts, stockSettings, companyData } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        agreements: [] as (ConsignmentAgreement & { product_count?: number })[],
        isAgreementFormOpen: false,
        editingAgreement: null as ConsignmentAgreement | null,
        agreementFormData: emptyAgreement,
        agreementProducts: [] as ConsignmentProduct[],
        agreementToDelete: null as ConsignmentAgreement | null,
        showOnlyActiveAgreements: true,
        clientSearchTerm: '',
        isClientSearchOpen: false,
        productSearchTerm: '',
        isProductSearchOpen: false,
        warehouseSearchTerm: '',
        isWarehouseSearchOpen: false,
    });

    const [debouncedClientSearch] = useDebounce(state.clientSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedWarehouseSearch] = useDebounce(state.warehouseSearchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadAgreements = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const data = await getConsignmentAgreements();
            updateState({ agreements: data, isLoading: false });
        } catch (error) {
            logError('Failed to load consignment agreements', { error });
            toast({ title: 'Error', description: 'No se pudieron cargar los acuerdos.', variant: 'destructive' });
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);

    useEffect(() => {
        loadAgreements();
    }, [loadAgreements]);

    const openAgreementForm = async (agreement: ConsignmentAgreement | null = null) => {
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
    };
    
    const handleFieldChange = (field: keyof ConsignmentAgreement, value: any) => {
        if (field === 'client_id') {
            const customer = customers.find(c => c.id === value);
            updateState({ 
                agreementFormData: { ...state.agreementFormData, client_id: value, client_name: customer?.name || '' },
                clientSearchTerm: customer ? `[${customer.id}] ${customer.name}` : '',
                isClientSearchOpen: false,
            });
        } else if (field === 'erp_warehouse_id') {
            updateState({
                agreementFormData: { ...state.agreementFormData, erp_warehouse_id: value },
                warehouseSearchTerm: value,
                isWarehouseSearchOpen: false,
            });
        } else {
            updateState({ agreementFormData: { ...state.agreementFormData, [field]: value } });
        }
    };
    
    const addProductToAgreement = (productId: string) => {
        if (!state.agreementProducts.some(p => p.product_id === productId)) {
            updateState({
                agreementProducts: [...state.agreementProducts, { id: 0, agreement_id: state.editingAgreement?.id || 0, product_id: productId, max_stock: 0, price: 0 }],
                productSearchTerm: '',
                isProductSearchOpen: false,
            });
        }
    };

    const removeProductFromAgreement = (index: number) => {
        updateState({ agreementProducts: state.agreementProducts.filter((_, i) => i !== index) });
    };

    const updateProductField = (index: number, field: keyof ConsignmentProduct, value: any) => {
        const updatedProducts = [...state.agreementProducts];
        (updatedProducts[index] as any)[field] = value;
        updateState({ agreementProducts: updatedProducts });
    };

    const handleSaveAgreement = async () => {
        if (!state.agreementFormData.client_id) {
            toast({ title: 'Cliente requerido', variant: 'destructive' });
            return;
        }
        updateState({ isSubmitting: true });
        try {
            await saveConsignmentAgreement(state.agreementFormData, state.agreementProducts);
            toast({ title: state.editingAgreement ? 'Acuerdo Actualizado' : 'Acuerdo Creado' });
            updateState({ isAgreementFormOpen: false });
            await loadAgreements();
        } catch (error: any) {
            logError('Failed to save agreement', { error: error.message });
            toast({ title: 'Error al Guardar', variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleDeleteAgreement = async () => {
        if (!state.agreementToDelete) return;
        updateState({ isSubmitting: true });
        try {
            await deleteConsignmentAgreement(state.agreementToDelete.id);
            toast({ title: 'Acuerdo Eliminado' });
            updateState({ agreementToDelete: null });
            await loadAgreements();
        } catch (error: any) {
            logError('Failed to delete agreement', { error: error.message });
            toast({ title: 'Error al Eliminar', description: error.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const toggleAgreementStatus = async (agreementId: number, isActive: boolean) => {
        const agreement = state.agreements.find(a => a.id === agreementId);
        if (!agreement) return;
        
        try {
            await saveConsignmentAgreement({ ...agreement, is_active: isActive ? 1 : 0 }, []);
            toast({ title: 'Estado Actualizado' });
            await loadAgreements();
        } catch(error) {
            logError('Failed to toggle agreement status', { error });
            toast({ title: 'Error', variant: 'destructive' });
        }
    };
    
    const selectors = {
        hasPermission,
        filteredAgreements: useMemo(() => state.showOnlyActiveAgreements ? state.agreements.filter(a => a.is_active) : state.agreements, [state.agreements, state.showOnlyActiveAgreements]),
        customerOptions: useMemo(() => debouncedClientSearch.length < 2 ? [] : customers.filter(c => c.name.toLowerCase().includes(debouncedClientSearch.toLowerCase()) || c.id.toLowerCase().includes(debouncedClientSearch.toLowerCase())).map(c => ({ value: c.id, label: `[${c.id}] ${c.name}` })), [customers, debouncedClientSearch]),
        productOptions: useMemo(() => debouncedProductSearch.length < 2 ? [] : authProducts.filter(p => p.description.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p.id.toLowerCase().includes(debouncedProductSearch.toLowerCase())).map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` })), [authProducts, debouncedProductSearch]),
        warehouseOptions: useMemo(() => {
            const warehouses = stockSettings?.warehouses || [];
            return warehouses.filter(w => w.name.toLowerCase().includes(debouncedWarehouseSearch.toLowerCase()) || w.id.toLowerCase().includes(debouncedWarehouseSearch.toLowerCase())).map(w => ({ value: w.id, label: `[${w.id}] ${w.name}` }))
        }, [stockSettings, debouncedWarehouseSearch]),
        getProductName: (id: string) => authProducts.find(p => p.id === id)?.description || 'Desconocido',
    };

    return {
        state,
        actions: {
            loadAgreements,
            openAgreementForm,
            handleFieldChange,
            addProductToAgreement,
            removeProductFromAgreement,
            updateProductField,
            handleSaveAgreement,
            handleDeleteAgreement,
            toggleAgreementStatus,
            setAgreementToDelete: (agreement: ConsignmentAgreement | null) => updateState({ agreementToDelete: agreement }),
            setShowOnlyActiveAgreements: (show: boolean) => updateState({ showOnlyActiveAgreements: show }),
            setIsAgreementFormOpen: (open: boolean) => updateState({ isAgreementFormOpen: open }),
            setClientSearchTerm: (term: string) => updateState({ clientSearchTerm: term }),
            setIsClientSearchOpen: (open: boolean) => updateState({ isClientSearchOpen: open }),
            setProductSearchTerm: (term: string) => updateState({ productSearchTerm: term }),
            setIsProductSearchOpen: (open: boolean) => updateState({ isProductSearchOpen: open }),
            setWarehouseSearchTerm: (term: string) => updateState({ warehouseSearchTerm: term }),
            setIsWarehouseSearchOpen: (open: boolean) => updateState({ isWarehouseSearchOpen: open }),
        },
        selectors
    };
};
