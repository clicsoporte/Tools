/**
 * @fileoverview Hook to manage the state and logic for the Inventory Correction tool.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getInventoryUnitById, correctInventoryUnit, getLocations } from '@/modules/warehouse/lib/actions';
import type { InventoryUnit, Product, WarehouseLocation } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

interface State {
    isLoading: boolean;
    isSearching: boolean;
    isSubmitting: boolean;
    searchTerm: string;
    searchResult: { unit: InventoryUnit; product: Product; } | null;
    unitToCorrect: InventoryUnit | null;
    isConfirmModalOpen: boolean;
    newProductSearch: string;
    isNewProductSearchOpen: boolean;
    newSelectedProduct: Product | null;
    confirmStep: number;
    confirmText: string;
    allLocations: WarehouseLocation[];
    editableUnit: Partial<InventoryUnit>;
}

const renderLocationPathAsString = (locationId: number | null, locations: WarehouseLocation[]): string => {
    if (!locationId) return 'N/A';
    const path: WarehouseLocation[] = [];
    let current: WarehouseLocation | undefined = locations.find(l => l.id === locationId);
    while (current) {
        path.unshift(current);
        const parentId = current.parentId;
        if (!parentId) break;
        current = locations.find(l => l.id === parentId);
    }
    return path.map(l => l.name).join(' > ');
};

export const useCorrectionTool = () => {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    const { toast } = useToast();
    const { user, products: authProducts } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isSearching: false,
        isSubmitting: false,
        searchTerm: '',
        searchResult: null,
        unitToCorrect: null,
        isConfirmModalOpen: false,
        newProductSearch: '',
        isNewProductSearchOpen: false,
        newSelectedProduct: null,
        confirmStep: 0,
        confirmText: '',
        allLocations: [],
        editableUnit: {},
    });

    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const setEditableUnit = (unit: Partial<InventoryUnit>) => {
        updateState({ editableUnit: unit });
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const locations = await getLocations();
                updateState({ allLocations: locations, isLoading: false });
            } catch (error) {
                logError('Failed to load locations for correction tool', { error });
                updateState({ isLoading: false });
            }
        };
        loadInitialData();
    }, [updateState]);

    const [debouncedNewProductSearch] = useDebounce(state.newProductSearch, 300);

    const handleSearch = async () => {
        if (!state.searchTerm.trim()) return;
        updateState({ isSearching: true, searchResult: null });
        try {
            const unit = await getInventoryUnitById(state.searchTerm.trim());
            if (unit) {
                const product = authProducts.find(p => p.id === unit.productId);
                if (product) {
                    updateState({ searchResult: { unit, product } });
                } else {
                    toast({ title: "Producto no encontrado", description: `No se encontró el producto con ID ${unit.productId} en el sistema.`, variant: "destructive" });
                }
            } else {
                toast({ title: "No encontrado", description: "No se encontró ninguna unidad de inventario con ese ID.", variant: "destructive" });
            }
        } catch (error: any) {
            logError("Error searching for inventory unit", { error: error.message });
            toast({ title: "Error de Búsqueda", variant: "destructive" });
        } finally {
            updateState({ isSearching: false });
        }
    };
    
    const handleSelectNewProduct = (productId: string) => {
        const product = authProducts.find(p => p.id === productId);
        if (product) {
            updateState({
                newSelectedProduct: product,
                newProductSearch: `[${product.id}] ${product.description}`,
                isNewProductSearchOpen: false,
            });
        }
    };

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            // Reset modal state when closing
            updateState({
                unitToCorrect: null,
                isConfirmModalOpen: false,
                newProductSearch: '',
                newSelectedProduct: null,
                confirmStep: 0,
                confirmText: '',
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
            updateState({ searchResult: null, searchTerm: '' }); // Clear search after correction
        } catch (error: any) {
            logError("Error executing inventory correction", { error: error.message });
            toast({ title: "Error en la Corrección", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
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
        getOriginalLocationPath: () => {
            return renderLocationPathAsString(state.searchResult?.unit.locationId || null, state.allLocations);
        },
    };

    return {
        state,
        actions: {
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            handleSearch,
            setUnitToCorrect,
            handleModalOpenChange,
            setNewProductSearch: (term: string) => updateState({ newProductSearch: term }),
            setNewProductSearchOpen: (isOpen: boolean) => updateState({ isNewProductSearchOpen: isOpen }),
            handleSelectNewProduct,
            setConfirmStep: (step: number) => updateState({ confirmStep: step }),
            setConfirmText: (text: string) => updateState({ confirmText: text }),
            handleConfirmCorrection,
            setEditableUnit,
        },
        selectors,
    };
};
