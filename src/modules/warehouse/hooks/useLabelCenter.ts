
/**
 * @fileoverview Hook to manage the state and logic for the Label Center page.
 */
'use client';

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, getAllItemLocations, getWarehouseSettings } from '@/modules/warehouse/lib/actions';
import type { WarehouseLocation, ItemLocation, WarehouseSettings, Product } from '@/modules/core/types';
import { useDebounce } from 'use-debounce';
import jsPDF from "jspdf";
import QRCode from 'qrcode';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { format } from 'date-fns';

type LabelType = 'location' | 'product_location';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    allLocations: WarehouseLocation[];
    itemLocations: ItemLocation[];
    warehouseSettings: WarehouseSettings | null;
    selectedRack: WarehouseLocation | null;
    levelFilter: string[];
    positionFilter: string[];
    labelType: LabelType;
    rackSearchTerm: string;
    isRackSearchOpen: boolean;
}

const renderLocationPathAsString = (locationId: number, locations: WarehouseLocation[]): string => {
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


export const useLabelCenter = () => {
    const { isAuthorized } = useAuthorization(['warehouse:labels:generate']);
    const { toast } = useToast();
    const { user, products } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        allLocations: [],
        itemLocations: [],
        warehouseSettings: null,
        selectedRack: null,
        levelFilter: [],
        positionFilter: [],
        labelType: 'location',
        rackSearchTerm: '',
        isRackSearchOpen: false,
    });

    const [debouncedRackSearch] = useDebounce(state.rackSearchTerm, 300);

    const updateState = useCallback((newState: Partial<State>) => {
        setState((prevState: State) => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!isAuthorized) return;
            try {
                const [locs, itemLocs, settings] = await Promise.all([getLocations(), getAllItemLocations(), getWarehouseSettings()]);
                updateState({ allLocations: locs, itemLocations: itemLocs, warehouseSettings: settings, isLoading: false });
            } catch (error: any) {
                logError("Failed to load data for label center", { error: error.message });
                toast({ title: "Error de Carga", variant: "destructive" });
                updateState({ isLoading: false });
            }
        };
        loadData();
    }, [isAuthorized, toast, updateState]);

    const handleSelectRack = (rackIdStr: string) => {
        const rackId = Number(rackIdStr);
        const rack = state.allLocations.find((l: WarehouseLocation) => l.id === rackId);
        if (rack) {
            updateState({
                selectedRack: rack,
                rackSearchTerm: `${rack.name} (${rack.code})`,
                isRackSearchOpen: false,
                levelFilter: [],
                positionFilter: [],
            });
        }
    };
    
    const rackOptions = useMemo(() => {
        return state.allLocations
            .filter((l: WarehouseLocation) => l.type === 'rack' && (l.name.toLowerCase().includes(debouncedRackSearch.toLowerCase()) || l.code.toLowerCase().includes(debouncedRackSearch.toLowerCase())))
            .map((r: WarehouseLocation) => ({ value: String(r.id), label: `${r.name} (${r.code})` }));
    }, [state.allLocations, debouncedRackSearch]);

    const rackChildren = useMemo(() => {
        if (!state.selectedRack) return [];
        
        const getChildrenRecursive = (parentId: number): WarehouseLocation[] => {
            const directChildren = state.allLocations.filter((l: WarehouseLocation) => l.parentId === parentId);
            if (directChildren.length === 0) {
                 const parentItself = state.allLocations.find((l: WarehouseLocation) => l.id === parentId);
                 return parentItself ? [parentItself] : [];
            }
            return directChildren.flatMap((child: WarehouseLocation) => getChildrenRecursive(child.id));
        };

        return getChildrenRecursive(state.selectedRack.id);
    }, [state.selectedRack, state.allLocations]);

    const levelOptions = useMemo(() => {
        if (!state.selectedRack || !state.warehouseSettings?.locationLevels) return [];
        const levelType = state.warehouseSettings.locationLevels[3]?.type || 'shelf';
        const children = state.allLocations.filter((l: WarehouseLocation) => l.parentId === state.selectedRack?.id && l.type === levelType);
        return children.map((l: WarehouseLocation) => ({ value: String(l.id), label: l.name }));
    }, [state.selectedRack, state.allLocations, state.warehouseSettings]);
    
    const positionOptions = useMemo(() => {
        if (!state.selectedRack || !state.warehouseSettings?.locationLevels) return [];
        const levelType = state.warehouseSettings.locationLevels[3]?.type || 'shelf';
        const positionType = state.warehouseSettings.locationLevels[4]?.type || 'bin';
        
        const levels = state.allLocations.filter((l: WarehouseLocation) => l.parentId === state.selectedRack?.id && l.type === levelType);
        const positions = levels.flatMap((level: WarehouseLocation) => state.allLocations.filter((l: WarehouseLocation) => l.parentId === level.id && l.type === positionType));
        
        const uniquePositionNames = Array.from(new Set(positions.map((p: WarehouseLocation) => p.name))).sort();

        return uniquePositionNames.map(name => ({ value: name, label: name }));
    }, [state.selectedRack, state.allLocations, state.warehouseSettings]);

    const filteredLocations = useMemo(() => {
        if (!state.selectedRack) return [];

        let locationsToFilter = rackChildren;

        if (state.levelFilter.length > 0) {
            const levelIdsAsNumbers = new Set(state.levelFilter.map(Number));
            locationsToFilter = locationsToFilter.filter(l => {
                let current = l;
                while (current.parentId) {
                    if (levelIdsAsNumbers.has(current.id)) return true;
                    const parent = state.allLocations.find((p: WarehouseLocation) => p.id === current.parentId);
                    if (!parent || !state.selectedRack || parent.id === state.selectedRack.id) break;
                    current = parent;
                }
                return false;
            });
        }
        
        if (state.positionFilter.length > 0) {
            const positionNames = new Set(state.positionFilter);
            locationsToFilter = locationsToFilter.filter(l => positionNames.has(l.name));
        }

        if (state.labelType === 'product_location') {
            const assignedLocationIds = new Set(state.itemLocations.map((il: ItemLocation) => il.locationId));
            return locationsToFilter.filter(l => assignedLocationIds.has(l.id));
        }

        return locationsToFilter;
    }, [state.selectedRack, state.levelFilter, state.positionFilter, state.labelType, rackChildren, state.itemLocations, state.allLocations]);
    
    const handleGeneratePdf = async () => {
        if (filteredLocations.length === 0) {
            toast({ title: 'Sin etiquetas para generar', variant: 'destructive' });
            return;
        }
        updateState({ isSubmitting: true });
        
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
        doc.deletePage(1);

        for (const location of filteredLocations) {
            doc.addPage();
            
            let qrContent = String(location.id);
            let mainText = location.code;
            let secondaryText = renderLocationPathAsString(location.id, state.allLocations);
            let footerText = '';
            let clientText = '';

            if (state.labelType === 'product_location') {
                const itemAssignment = state.itemLocations.find((il: ItemLocation) => il.locationId === location.id);
                if (itemAssignment) {
                    qrContent = `${location.id}>${itemAssignment.itemId}`;
                    const product = products.find(p => p.id === itemAssignment.itemId);
                    mainText = product?.id || 'N/A';
                    secondaryText = product?.description || 'Producto no encontrado';
                    footerText = renderLocationPathAsString(location.id, state.allLocations);
                } else {
                    continue; 
                }
            }

            try {
                const qrCodeDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'M', width: 200 });
                const margin = 40;
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                // QR Code
                doc.addImage(qrCodeDataUrl, 'PNG', margin, margin, 100, 100);

                // Metadata
                doc.setFontSize(9);
                doc.setFont('Helvetica', 'normal');
                doc.setTextColor('#666');
                doc.text(`Creado: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin, margin, { align: 'right' });
                if (user) {
                    doc.text(`por ${user.name}`, pageWidth - margin, margin + 12, { align: 'right' });
                }

                // Main Content
                doc.setTextColor('#000');
                doc.setFontSize(150);
                doc.setFont('Helvetica', 'bold');
                const mainTextWidth = doc.getTextWidth(mainText);
                const mainTextX = (pageWidth - mainTextWidth) / 2;
                doc.text(mainText, pageWidth/2, pageHeight/2 - 40, { align: 'center'});

                doc.setFontSize(52);
                doc.setFont('Helvetica', 'normal');
                const secondaryTextLines = doc.splitTextToSize(secondaryText, pageWidth - margin * 2);
                doc.text(secondaryTextLines, pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

                // Footer
                if (footerText) {
                    const itemAssignment = state.itemLocations.find(il => il.locationId === location.id);
                    if (itemAssignment?.clientId) {
                        // We need to fetch customer name from main context or pass it down
                    }

                    doc.setFontSize(24);
                    doc.setFont('Helvetica', 'bold');
                    doc.text('Ubicación:', margin, pageHeight - 80);
                    doc.setFontSize(28);
                    doc.setFont('Helvetica', 'normal');
                    const footerLines = doc.splitTextToSize(footerText, pageWidth - margin * 2);
                    doc.text(footerLines, margin, pageHeight - 50);
                }
                
            } catch (err: any) {
                logError('PDF Generation Error', { error: err.message, locationId: location.id });
            }
        }
        
        if (doc.getNumberOfPages() > 0) {
            doc.save(`etiquetas_almacen_${Date.now()}.pdf`);
        } else {
            toast({ title: 'Sin Etiquetas', description: 'No se encontraron productos asignados para las ubicaciones filtradas.', variant: 'destructive'});
        }

        updateState({ isSubmitting: false });
    };

    return {
        state,
        actions: {
            handleSelectRack,
            setRackSearchTerm: (term: string) => updateState({ rackSearchTerm: term }),
            setIsRackSearchOpen: (isOpen: boolean) => updateState({ isRackSearchOpen: isOpen }),
            setLevelFilter: (filter: string[]) => updateState({ levelFilter: filter }),
            setPositionFilter: (filter: string[]) => updateState({ positionFilter: filter }),
            setLabelType: (type: LabelType) => updateState({ labelType: type }),
            handleGeneratePdf,
        },
        selectors: {
            rackOptions,
            levelOptions,
            positionOptions,
            filteredLocations,
        }
    };
};
