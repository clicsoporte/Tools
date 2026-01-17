/**
 * @fileoverview Hook to manage the state and logic for the Inventory Correction tool.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { correctInventoryUnit, searchInventoryUnits } from '@/modules/warehouse/lib/actions';
import type { InventoryUnit, Product, DateRange } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { subDays } from 'date-fns';

interface State {
    isSearching: boolean;
    isSubmitting: boolean;
    filters: {
        dateRange?: DateRange;
        productId: string;
        humanReadableId: string;
        unitCode: string;
        documentId: string;
        showVoided: boolean;
    };
    searchResults: InventoryUnit[];
    unitToCorrect: InventoryUnit | null;
    isConfirmModalOpen: boolean;
    newProductSearch: string;
    isNewProductSearchOpen: boolean;
    newSelectedProduct: Product | null;
    editableUnit: Partial<InventoryUnit>; // The state for the form inputs
}

const emptyEditableUnit: Partial<InventoryUnit> = {
    productId: '',
    quantity: undefined,
    humanReadableId: '',
    documentId: '',
    erpDocumentId: '',
};

export const useCorrectionTool = () => {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    const { toast } = useToast();
    const { user, products: authProducts } = useAuth();

    const [state, setState] = useState<State>({
        isSearching: false,
        isSubmitting: false,
        filters: {
            dateRange: { from: subDays(new Date(), 7), to: new Date() },
            productId: '',
            humanReadableId: '',
            unitCode: '',
            documentId: '',
            showVoided: false,
        },
        searchResults: [],
        unitToCorrect: null,
        isConfirmModalOpen: false,
        newProductSearch: '',
        isNewProductSearchOpen: false,
        newSelectedProduct: null,
        editableUnit: {},
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);
    
    const [debouncedNewProductSearch] = useDebounce(state.newProductSearch, 300);

    const handleSearch = async () => {
        updateState({ isSearching: true, searchResults: [] });
        try {
            const results = await searchInventoryUnits(state.filters);
            updateState({ searchResults: results });
            if (results.length === 0) {
                toast({ title: 'Sin Resultados', description: 'No se encontraron ingresos con los filtros especificados.' });
            }
        } catch (error: any) {
            logError("Error searching for inventory units", { error: error.message });
            toast({ title: "Error de Búsqueda", variant: "destructive" });
        } finally {
            updateState({ isSearching: false });
        }
    };
    
    const handleClearFilters = () => {
        updateState({
            filters: {
                dateRange: { from: subDays(new Date(), 7), to: new Date() },
                productId: '',
                humanReadableId: '',
                unitCode: '',
                documentId: '',
                showVoided: false,
            },
            searchResults: [],
        });
    };

    const handleSelectNewProduct = (productId: string) => {
        const product = authProducts.find(p => p.id === productId);
        if (product) {
            updateState({
                newSelectedProduct: product,
                newProductSearch: `[${product.id}] ${product.description}`,
                isNewProductSearchOpen: false,
                editableUnit: { ...state.editableUnit, productId: product.id }
            });
        }
    };

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            updateState({
                unitToCorrect: null,
                isConfirmModalOpen: false,
                newProductSearch: '',
                newSelectedProduct: null,
                editableUnit: {},
            });
        } else {
             updateState({ isConfirmModalOpen: true });
        }
    };
    
    const handleConfirmCorrection = async () => {
        if (!user || !state.unitToCorrect || !state.newSelectedProduct) {
             toast({ title: "Error", description: "Faltan datos para la corrección.", variant: "destructive" });
             return;
        }
        
        updateState({ isSubmitting: true });
        try {
            await correctInventoryUnit({
                unitId: state.unitToCorrect.id,
                newProductId: state.newSelectedProduct.id,
                newQuantity: state.editableUnit.quantity ?? state.unitToCorrect.quantity,
                newHumanReadableId: state.editableUnit.humanReadableId ?? state.unitToCorrect.humanReadableId ?? '',
                newDocumentId: state.editableUnit.documentId ?? state.unitToCorrect.documentId ?? '',
                newErpDocumentId: state.editableUnit.erpDocumentId ?? state.unitToCorrect.erpDocumentId ?? '',
                userId: user.id,
                userName: user.name,
            });
            toast({ title: "Corrección Exitosa", description: `La unidad ${state.unitToCorrect.unitCode} ha sido actualizada.` });
            handleModalOpenChange(false);
            await handleSearch(); // Refresh search results after correction
        } catch (error: any) {
            logError('Error executing inventory correction', { error: error.message, payload: { unitId: state.unitToCorrect.id, newProductId: state.newSelectedProduct.id, newQuantity: state.editableUnit.quantity, userId: user.id } });
            toast({ title: "Error en la Corrección", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const setEditableUnitField = (field: keyof InventoryUnit, value: any) => {
        updateState({ editableUnit: { ...state.editableUnit, [field]: value } });
    };

    const resetEditableUnit = () => {
        const { unitToCorrect } = state;
        if (unitToCorrect) {
            const originalProduct = authProducts.find(p => p.id === unitToCorrect.productId);
            updateState({
                editableUnit: { ...unitToCorrect },
                newSelectedProduct: originalProduct || null,
                newProductSearch: originalProduct ? `[${originalProduct.id}] ${originalProduct.description}` : '',
            });
        }
    };
    
    const handleClearForm = () => {
        updateState({
            editableUnit: { ...emptyEditableUnit, locationId: state.unitToCorrect?.locationId },
            newSelectedProduct: null,
            newProductSearch: '',
        });
    }
    
    const setUnitToCorrect = (unit: InventoryUnit | null) => {
        if (unit) {
            const product = authProducts.find(p => p.id === unit.productId);
            updateState({ 
                unitToCorrect: unit,
                editableUnit: { ...unit },
                newSelectedProduct: product || null,
                newProductSearch: product ? `[${product.id}] ${product.description}`: '',
                isConfirmModalOpen: true 
            });
        }
    }

    const selectors = {
        productOptions: useMemo(() => {
            if (debouncedNewProductSearch.length < 2) return [];
            const searchLower = debouncedNewProductSearch.toLowerCase();
            return authProducts
                .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
                .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
        }, [authProducts, debouncedNewProductSearch]),
        getOriginalProductName: () => {
            if (!state.unitToCorrect) return '';
            return authProducts.find(p => p.id === state.unitToCorrect?.productId)?.description || state.unitToCorrect?.productId;
        },
        getProductName: (productId: string) => {
             return authProducts.find(p => p.id === productId)?.description || 'Desconocido';
        },
        isCorrectionFormValid: useMemo(() => {
            return !!state.newSelectedProduct && !!state.editableUnit.quantity && state.editableUnit.quantity > 0;
        }, [state.newSelectedProduct, state.editableUnit.quantity]),
    };

    return {
        state,
        actions: {
            setFilter: (field: keyof State['filters'], value: any) => {
                updateState({ filters: { ...state.filters, [field]: value } });
            },
            handleSearch,
            handleClearFilters,
            setUnitToCorrect,
            handleModalOpenChange,
            setNewProductSearch: (term: string) => updateState({ newProductSearch: term }),
            setNewProductSearchOpen: (isOpen: boolean) => updateState({ isNewProductSearchOpen: isOpen }),
            handleSelectNewProduct,
            handleConfirmCorrection,
            setEditableUnitField,
            resetEditableUnit,
            handleClearForm,
        },
        selectors,
    };
};
