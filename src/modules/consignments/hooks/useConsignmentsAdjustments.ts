/**
 * @fileoverview Hook for managing the logic for the Consignments Adjustments page.
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getConsignmentAgreements, getAgreementDetails, saveAdjustment } from '../lib/actions';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { ConsignmentAgreement, ConsignmentProduct, ConsignmentAdjustmentReason } from '@/modules/core/types';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useDebounce } from 'use-debounce';
import { useRouter } from 'next/navigation';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    agreements: ConsignmentAgreement[];
    selectedAgreementId: string | null;
    agreementProducts: ConsignmentProduct[];
    selectedProductId: string | null;
    quantity: string;
    reason: ConsignmentAdjustmentReason | '';
    notes: string;
    agreementSearchTerm: string;
    isAgreementSearchOpen: boolean;
    productSearchTerm: string;
    isProductSearchOpen: boolean;
}

const adjustmentReasons: ConsignmentAdjustmentReason[] = ['Dañado', 'Vencido', 'Pérdida', 'Corrección de Conteo'];

export const useConsignmentsAdjustments = () => {
    const { isAuthorized } = useAuthorization(['consignments:adjustments:create']);
    const { toast } = useToast();
    const { user, products: authProducts } = useAuth();
    const router = useRouter();
    usePageTitle().setTitle('Ajustes de Inventario de Consignación');

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        agreements: [],
        selectedAgreementId: null,
        agreementProducts: [],
        selectedProductId: null,
        quantity: '',
        reason: '',
        notes: '',
        agreementSearchTerm: '',
        isAgreementSearchOpen: false,
        productSearchTerm: '',
        isProductSearchOpen: false,
    });

    const [debouncedAgreementSearch] = useDebounce(state.agreementSearchTerm, 300);
    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadAgreements = async () => {
            if (!isAuthorized) return;
            try {
                const agreementsData = await getConsignmentAgreements();
                updateState({ agreements: agreementsData.filter(a => a.is_active), isLoading: false });
            } catch (error: any) {
                logError('Failed to load agreements for adjustments', { error: error.message });
                updateState({ isLoading: false });
            }
        };
        loadAgreements();
    }, [isAuthorized, updateState]);
    
    const handleSelectAgreement = async (agreementId: string) => {
        const agreement = state.agreements.find(a => String(a.id) === agreementId);
        if (agreement) {
            updateState({
                selectedAgreementId: agreementId,
                agreementSearchTerm: agreement.client_name,
                isAgreementSearchOpen: false,
                isLoading: true, // Show loading while fetching products
                selectedProductId: null,
                productSearchTerm: '',
            });
            try {
                const details = await getAgreementDetails(Number(agreementId));
                updateState({ agreementProducts: details?.products || [] });
            } catch (error: any) {
                 toast({ title: 'Error', description: 'No se pudieron cargar los productos del acuerdo.', variant: 'destructive' });
            } finally {
                updateState({ isLoading: false });
            }
        }
    };

    const handleSelectProduct = (productId: string) => {
        const product = state.agreementProducts.find(p => p.product_id === productId);
        if (product) {
            updateState({
                selectedProductId: productId,
                productSearchTerm: authProducts.find(p => p.id === productId)?.description || productId,
                isProductSearchOpen: false,
            });
        }
    };

    const handleSaveAdjustment = async () => {
        if (!user || !state.selectedAgreementId || !state.selectedProductId || !state.quantity || !state.reason) {
            toast({ title: 'Datos Incompletos', description: 'Todos los campos son requeridos.', variant: 'destructive' });
            return;
        }

        const quantityNum = parseInt(state.quantity, 10);
        if (isNaN(quantityNum)) {
            toast({ title: 'Cantidad inválida', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            await saveAdjustment({
                agreementId: Number(state.selectedAgreementId),
                productId: state.selectedProductId,
                quantity: quantityNum,
                reason: state.reason,
                notes: state.notes,
                userName: user.name,
            });
            toast({ title: 'Ajuste Guardado', description: 'El ajuste de inventario ha sido registrado.' });
            
            // Reset form for next entry
            updateState({
                selectedProductId: null,
                quantity: '',
                reason: '',
                notes: '',
                productSearchTerm: '',
            });

        } catch (error: any) {
            logError('Failed to save adjustment', { error: error.message });
            toast({ title: 'Error', description: `No se pudo guardar el ajuste: ${error.message}`, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const agreementOptions = useMemo(() => state.agreements
        .filter(a => a.client_name.toLowerCase().includes(debouncedAgreementSearch.toLowerCase()))
        .map(a => ({ value: String(a.id), label: a.client_name })), 
    [state.agreements, debouncedAgreementSearch]);

    const productOptions = useMemo(() => state.agreementProducts
        .map(p => authProducts.find(ap => ap.id === p.product_id))
        .filter(Boolean)
        .filter(p => p!.description.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p!.id.toLowerCase().includes(debouncedProductSearch.toLowerCase()))
        .map(p => ({ value: p!.id, label: `[${p!.id}] ${p!.description}` })),
    [state.agreementProducts, authProducts, debouncedProductSearch]);

    return {
        state,
        actions: {
            handleSelectAgreement,
            handleSelectProduct,
            handleSaveAdjustment,
            setAgreementSearchTerm: (term: string) => updateState({ agreementSearchTerm: term }),
            setIsAgreementSearchOpen: (open: boolean) => updateState({ isAgreementSearchOpen: open }),
            setProductSearchTerm: (term: string) => updateState({ productSearchTerm: term }),
            setIsProductSearchOpen: (open: boolean) => updateState({ isProductSearchOpen: open }),
            setQuantity: (qty: string) => updateState({ quantity: qty }),
            setReason: (reason: ConsignmentAdjustmentReason) => updateState({ reason }),
            setNotes: (notes: string) => updateState({ notes }),
        },
        selectors: {
            agreementOptions,
            productOptions,
            adjustmentReasons,
        },
        isAuthorized,
    };
};
