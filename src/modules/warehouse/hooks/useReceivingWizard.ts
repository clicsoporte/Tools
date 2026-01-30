/**
 * @fileoverview Hook to manage the logic for the receiving wizard.
 */
'use client';

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getLocations, assignItemToLocation, getSelectableLocations, addInventoryUnit, getAllItemLocations } from '@/modules/warehouse/lib/actions';
import type { Product, WarehouseLocation, InventoryUnit, ItemLocation } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import jsPDF from "jspdf";
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { format } from 'date-fns';

type WizardStep = 'select_product' | 'select_location' | 'confirm_suggested' | 'confirm_new' | 'finished';

const renderLocationPathAsString = (locationId: number | null, locations: WarehouseLocation[]): string => {
    if (!locationId) return '';
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

export const useReceivingWizard = () => {
    useAuthorization(['warehouse:receiving-wizard:use']);
    const { toast } = useToast();
    const { user, companyData, products: authProducts } = useAuth();
    
    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        step: 'select_product' as WizardStep,
        allLocations: [] as WarehouseLocation[],
        itemLocations: [] as ItemLocation[],
        selectableLocations: [] as WarehouseLocation[],
        selectedProduct: null as Product | null,
        suggestedLocations: [] as WarehouseLocation[],
        selectedLocationId: null as number | null,
        newLocationId: null as number | null, // Location chosen in step 3
        quantity: '1',
        humanReadableId: '',
        documentId: '',
        erpDocumentId: '',
        saveAsDefault: true,
        lastCreatedUnit: null as InventoryUnit | null,
        isMixedLocationConfirmOpen: false,
        conflictingItems: [] as Product[],
        isTargetLocationMixed: false,
        // Search states
        productSearchTerm: '',
        isProductSearchOpen: false,
        locationSearchTerm: '',
        isLocationSearchOpen: false,
    });
    
    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, companyData?.searchDebounceTime ?? 300);
    const [debouncedLocationSearch] = useDebounce(state.locationSearchTerm, companyData?.searchDebounceTime ?? 300);
    
    useEffect(() => {
        const loadInitialData = async () => {
            updateState({ isLoading: true });
            try {
                const [locs, itemLocs] = await Promise.all([getLocations(), getAllItemLocations()]);
                updateState({
                    allLocations: locs,
                    selectableLocations: getSelectableLocations(locs),
                    itemLocations: itemLocs,
                });
            } catch (error) {
                logError("Failed to load data for receiving wizard", { error });
                toast({ title: "Error de Carga", variant: "destructive" });
            } finally {
                updateState({ isLoading: false });
            }
        };
        loadInitialData();
    }, [toast, updateState]);
    
    const productOptions = useMemo(() => {
        if (!debouncedProductSearch) return [];
        const searchLower = debouncedProductSearch.toLowerCase();
        if (searchLower.length < 2) return [];
        return authProducts
            .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower) || (p.barcode || '').toLowerCase().includes(searchLower))
            .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
    }, [authProducts, debouncedProductSearch]);

    const locationOptions = useMemo(() => {
        const searchTerm = debouncedLocationSearch.trim().toLowerCase();
        if (searchTerm === '*' || searchTerm === '') return state.selectableLocations.map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
        return state.selectableLocations
            .filter(l => renderLocationPathAsString(l.id, state.allLocations).toLowerCase().includes(searchTerm))
            .map(l => ({ value: String(l.id), label: renderLocationPathAsString(l.id, state.allLocations) }));
    }, [state.allLocations, state.selectableLocations, debouncedLocationSearch]);

    const handleSelectProduct = (productId: string) => {
        const product = authProducts.find(p => p.id === productId);
        if (product) {
            const suggestions = state.itemLocations
                .filter(il => il.itemId === productId)
                .map(il => state.allLocations.find(loc => loc.id === il.locationId))
                .filter(Boolean) as WarehouseLocation[];

            updateState({
                selectedProduct: product,
                suggestedLocations: suggestions,
                step: 'select_location',
                isProductSearchOpen: false,
                productSearchTerm: '',
            });
        }
    };
    
    const handleUseSuggestedLocation = (locationId: number) => {
        updateState({ selectedLocationId: locationId, newLocationId: locationId, step: 'confirm_suggested' });
    };

    const handleAssignNewLocation = () => {
        updateState({ selectedLocationId: null, newLocationId: null, step: 'confirm_new' });
    };

    const handleSelectLocation = (locationIdStr: string) => {
        const locationId = Number(locationIdStr);
        const location = state.allLocations.find(l => l.id === locationId);
        if (location) {
            updateState({ newLocationId: locationId, locationSearchTerm: renderLocationPathAsString(location.id, state.allLocations), isLocationSearchOpen: false });
        }
    };

    const handleGoBack = () => {
        switch (state.step) {
            case 'confirm_new':
            case 'confirm_suggested':
                updateState({ step: 'select_location' });
                break;
            case 'select_location':
                updateState({ step: 'select_product', selectedProduct: null, suggestedLocations: [] });
                break;
        }
    };
    
    const refreshItemLocations = useCallback(async () => {
        try {
            const itemLocs = await getAllItemLocations();
            updateState({ itemLocations: itemLocs });
        } catch (error) {
            logError("Failed to refresh item locations in wizard", { error });
        }
    }, [updateState]);

    const performRegistration = async () => {
        if (!user || !state.selectedProduct || !state.newLocationId || !state.quantity) return;
        updateState({ isSubmitting: true });
        
        try {
            if (state.saveAsDefault) {
                 await assignItemToLocation({
                    itemId: state.selectedProduct.id,
                    locationId: state.newLocationId,
                    clientId: null,
                    updatedBy: user.name,
                    isExclusive: 0,
                    requiresCertificate: 0,
                });
                // Re-fetch item locations to update suggestions for the next run
                await refreshItemLocations();
            }

            const newUnit = await addInventoryUnit({
                productId: state.selectedProduct.id,
                locationId: state.newLocationId,
                quantity: parseFloat(state.quantity),
                humanReadableId: state.humanReadableId,
                documentId: state.documentId,
                erpDocumentId: state.erpDocumentId,
                createdBy: user.name,
                notes: ''
            });

            updateState({ lastCreatedUnit: newUnit, step: 'finished' });
            
        } catch (error: any) {
            logError('Failed to register new unit', { error: error.message });
            toast({ title: "Error al Registrar", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleConfirmAndRegister = async () => {
        if (!user || !state.selectedProduct || !state.newLocationId || !state.quantity) return;

        const quantityNum = parseFloat(state.quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
            toast({ title: 'Cantidad Inválida', variant: 'destructive' });
            return;
        }
        
        const location = state.allLocations.find(l => l.id === state.newLocationId);
        const unitsInLocation = state.itemLocations.filter(il => il.locationId === state.newLocationId);
        
        const uniqueProductIdsInLocation = new Set(unitsInLocation.map(il => il.itemId));
        const uniqueConflictingProducts = Array.from(uniqueProductIdsInLocation)
            .map(id => authProducts.find(p => p.id === id))
            .filter(Boolean) as Product[];

        if (uniqueConflictingProducts.length > 0 && !uniqueConflictingProducts.some(p => p.id === state.selectedProduct!.id)) {
            updateState({ 
                conflictingItems: uniqueConflictingProducts, 
                isMixedLocationConfirmOpen: true,
                isTargetLocationMixed: location?.is_mixed === 1
            });
            return;
        }
        
        await performRegistration();
    };

    const handleConfirmAddMixed = async () => {
        await performRegistration();
        updateState({ isMixedLocationConfirmOpen: false });
    };

    const handleReset = () => {
        updateState({
            step: 'select_product',
            selectedProduct: null,
            suggestedLocations: [],
            selectedLocationId: null,
            newLocationId: null,
            quantity: '1',
            humanReadableId: '',
            documentId: '',
            erpDocumentId: '',
            saveAsDefault: true,
            lastCreatedUnit: null,
        });
    };
    
    const handlePrintLabel = async (unit: InventoryUnit) => {
        if (!user || !companyData) return;
        const product = authProducts.find(p => p.id === unit.productId);
        const location = state.allLocations.find(l => l.id === unit.locationId);

        try {
            const qrCodeDataUrl = await QRCode.toDataURL(unit.unitCode!, { errorCorrectionLevel: 'H', width: 200 });

            const barcodeCanvas = document.createElement('canvas');
            JsBarcode(barcodeCanvas, unit.unitCode!, { format: 'CODE128', displayValue: false });
            const barcodeDataUrl = barcodeCanvas.toDataURL('image/png');

            const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [4, 3] });
             const margin = 0.2;
            const contentWidth = 4 - (margin * 2);
            
            const leftColX = margin;
            const leftColWidth = 1.2;
            doc.addImage(qrCodeDataUrl, 'PNG', leftColX, margin, leftColWidth, leftColWidth);
            doc.addImage(barcodeDataUrl, 'PNG', leftColX, margin + leftColWidth + 0.1, leftColWidth, 0.4);
            doc.setFontSize(10).text(unit.unitCode!, leftColX + leftColWidth / 2, margin + leftColWidth + 0.1 + 0.4 + 0.15, { align: 'center' });

            const rightColX = leftColX + leftColWidth + 0.2;
            const rightColWidth = contentWidth - leftColWidth - 0.2;

            let currentY = margin + 0.1;
            doc.setFontSize(14).setFont('Helvetica', 'bold').text(`Producto: ${product?.id || 'N/A'}`, rightColX, currentY);
            currentY += 0.2;
            
            doc.setFontSize(9).setFont('Helvetica', 'normal');
            const descLines = doc.splitTextToSize(product?.description || 'Descripción no disponible', rightColWidth);
            doc.text(descLines, rightColX, currentY);
            currentY += (descLines.length * 0.15) + 0.2;
            
            doc.setFontSize(10).setFont('Helvetica', 'bold').text(`Ubicación:`, rightColX, currentY);
            currentY += 0.15;
            
            doc.setFontSize(9).setFont('Helvetica', 'normal');
            const locLines = doc.splitTextToSize(renderLocationPathAsString(location?.id || 0, state.allLocations), rightColWidth);
            doc.text(locLines, rightColX, currentY);
            
            const footerY = 3 - margin;
            doc.setFontSize(8).setTextColor(150);
            doc.text(`Creado: ${format(new Date(), 'dd/MM/yyyy')} por ${user?.name || 'Sistema'}`, 4 - margin, footerY, { align: 'right' });
            
            doc.save(`etiqueta_unidad_${unit.unitCode}.pdf`);

        } catch (err: any) {
            logError("Failed to generate and print label", { error: err.message, unitId: unit.id });
            toast({ title: 'Error al Imprimir', description: err.message, variant: 'destructive' });
        }
    };
    
    const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && productOptions.length > 0) {
            e.preventDefault();
            handleSelectProduct(productOptions[0].value);
        }
    };
    
    const selectors = {
        productOptions,
        locationOptions,
        renderLocationPath: (locationId: number) => renderLocationPathAsString(locationId, state.allLocations),
    };

    const actions = {
        handleSelectProduct,
        handleUseSuggestedLocation,
        handleAssignNewLocation,
        handleSelectLocation,
        handleGoBack,
        handleConfirmAndRegister,
        handleReset,
        handleConfirmAddMixed,
        handlePrintLabel,
        handleProductSearchKeyDown,
        setProductSearchTerm: (term: string) => updateState({ productSearchTerm: term }),
        setProductSearchOpen: (isOpen: boolean) => updateState({ isProductSearchOpen: isOpen }),
        setLocationSearchTerm: (term: string) => updateState({ locationSearchTerm: term }),
        setLocationSearchOpen: (isOpen: boolean) => updateState({ isLocationSearchOpen: isOpen }),
        setQuantity: (qty: string) => updateState({ quantity: qty }),
        setHumanReadableId: (id: string) => updateState({ humanReadableId: id }),
        setDocumentId: (id: string) => updateState({ documentId: id }),
        setErpDocumentId: (id: string) => updateState({ erpDocumentId: id }),
        setSaveAsDefault: (save: boolean) => updateState({ saveAsDefault: save }),
        setIsMixedLocationConfirmOpen: (open: boolean) => updateState({ isMixedLocationConfirmOpen: open }),
    };

    return { state, actions, selectors };
};
