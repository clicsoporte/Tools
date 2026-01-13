/**
 * @fileoverview Hook to manage the state and logic for the Label Center page.
 */
'use client';

import React, { useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, getAllItemLocations, getWarehouseSettings } from '@/modules/warehouse/lib/actions';
import type { WarehouseLocation, ItemLocation, WarehouseSettings } from '@/modules/core/types';
import { useDebounce } from 'use-debounce';
import jsPDF from "jspdf";
import QRCode from 'qrcode';

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
        setState(prevState => ({ ...prevState, ...newState }));
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
        const rack = state.allLocations.find(l => l.id === rackId);
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
            .filter(l => l.type === 'rack' && (l.name.toLowerCase().includes(debouncedRackSearch.toLowerCase()) || l.code.toLowerCase().includes(debouncedRackSearch.toLowerCase())))
            .map(r => ({ value: String(r.id), label: `${r.name} (${r.code})` }));
    }, [state.allLocations, debouncedRackSearch]);

    const rackChildren = useMemo(() => {
        if (!state.selectedRack) return [];
        
        const getChildrenRecursive = (parentId: number): WarehouseLocation[] => {
            const directChildren = state.allLocations.filter(l => l.parentId === parentId);
            if (directChildren.length === 0) {
                 const parentItself = state.allLocations.find(l => l.id === parentId);
                 return parentItself ? [parentItself] : [];
            }
            return directChildren.flatMap(child => getChildrenRecursive(child.id));
        };

        return getChildrenRecursive(state.selectedRack.id);
    }, [state.selectedRack, state.allLocations]);

    const levelOptions = useMemo(() => {
        if (!state.selectedRack || !state.warehouseSettings?.locationLevels) return [];
        const levelType = state.warehouseSettings.locationLevels[3]?.type || 'shelf';
        const children = state.allLocations.filter(l => l.parentId === state.selectedRack?.id && l.type === levelType);
        return children.map(l => ({ value: String(l.id), label: l.name }));
    }, [state.selectedRack, state.allLocations, state.warehouseSettings]);
    
    const positionOptions = useMemo(() => {
        if (!state.selectedRack || !state.warehouseSettings?.locationLevels) return [];
        const levelType = state.warehouseSettings.locationLevels[3]?.type || 'shelf';
        const positionType = state.warehouseSettings.locationLevels[4]?.type || 'bin';
        
        const levels = state.allLocations.filter(l => l.parentId === state.selectedRack?.id && l.type === levelType);
        const positions = levels.flatMap(level => state.allLocations.filter(l => l.parentId === level.id && l.type === positionType));
        
        const uniquePositionNames = Array.from(new Set(positions.map(p => p.name))).sort();

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
                    const parent = state.allLocations.find(p => p.id === current.parentId);
                    if (!parent || parent.id === state.selectedRack.id) break;
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
            const assignedLocationIds = new Set(state.itemLocations.map(il => il.locationId));
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
        
        const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [4, 2] });
        doc.deletePage(1); // Start with a blank slate

        for (const location of filteredLocations) {
            doc.addPage();
            const locationPath = renderLocationPathAsString(location.id, state.allLocations);
            
            let qrContent = String(location.id);
            if (state.labelType === 'product_location') {
                const itemAssignment = state.itemLocations.find(il => il.locationId === location.id);
                if (itemAssignment) {
                    qrContent = `${location.id}>${itemAssignment.itemId}`;
                }
            }

            try {
                const qrCodeDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'M', width: 150 });
                doc.addImage(qrCodeDataUrl, 'PNG', 0.2, 0.25, 1.5, 1.5);

                doc.setFontSize(24).setFont('Helvetica', 'bold');
                const pathLines = doc.splitTextToSize(locationPath, 2);
                doc.text(pathLines, 1.9, 0.6);
                
                doc.setFontSize(10).setFont('Helvetica', 'normal');
                doc.text(`Código: ${location.code}`, 1.9, 1.6);
                doc.text(`Tipo: ${location.type}`, 1.9, 1.75);
                
            } catch (err: any) {
                logError('PDF Generation Error', { error: err.message, locationId: location.id });
            }
        }
        
        doc.save(`etiquetas_almacen_${Date.now()}.pdf`);
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
