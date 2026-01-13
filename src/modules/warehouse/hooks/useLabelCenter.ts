/**
 * @fileoverview Hook to manage the state and logic for the Label Center page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getLocations, getChildLocations, getAllItemLocations } from '@/modules/warehouse/lib/actions';
import type { WarehouseLocation, ItemLocation } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import jsPDF from "jspdf";
import QRCode from 'qrcode';
import { format } from 'date-fns';

type LabelType = 'location' | 'product_location';

interface State {
    isLoading: boolean;
    isSubmitting: boolean;
    allLocations: WarehouseLocation[];
    itemLocations: ItemLocation[];
    selectedRack: WarehouseLocation | null;
    levelFilter: string[];
    positionFilter: string[];
    labelType: LabelType;
    rackSearchTerm: string;
    isRackSearchOpen: boolean;
}

export const useLabelCenter = () => {
    const { isAuthorized } = useAuthorization(['warehouse:labels:generate']);
    const { toast } = useToast();
    const { companyData } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        allLocations: [],
        itemLocations: [],
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
                const [locs, itemLocs] = await Promise.all([getLocations(), getAllItemLocations()]);
                updateState({ allLocations: locs, itemLocations: itemLocs, isLoading: false });
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
        return getChildLocations([state.selectedRack.id], state.allLocations);
    }, [state.selectedRack, state.allLocations]);

    const levelOptions = useMemo(() => {
        if (!state.selectedRack) return [];
        const levelType = companyData?.locationLevels?.[3]?.type || 'shelf';
        return state.allLocations
            .filter(l => l.parentId === state.selectedRack?.id && l.type === levelType)
            .map(l => ({ value: String(l.id), label: l.name }));
    }, [state.selectedRack, state.allLocations, companyData]);
    
    const positionOptions = useMemo(() => {
        if (!state.selectedRack) return [];
        const positionType = companyData?.locationLevels?.[4]?.type || 'bin';
        const childrenOfLevels = state.allLocations.filter(l => l.parentId === state.selectedRack?.id).flatMap(level => getChildLocations([level.id], state.allLocations));
        
        const uniquePositions = Array.from(new Set(childrenOfLevels.filter(l => l.type === positionType).map(l => l.name)));
        
        return uniquePositions.map(name => ({ value: name, label: name }));
    }, [state.selectedRack, state.allLocations, companyData]);

    const filteredLocations = useMemo(() => {
        if (!state.selectedRack) return [];

        let locations = rackChildren;

        if (state.levelFilter.length > 0) {
            const levelIds = new Set(state.levelFilter.map(Number));
            locations = locations.filter(l => {
                let current = l;
                while(current.parentId !== state.selectedRack?.id && current.parentId) {
                    const parent = state.allLocations.find(p => p.id === current.parentId);
                    if(!parent) return false;
                    current = parent;
                }
                return levelIds.has(current.id);
            });
        }
        
        if (state.positionFilter.length > 0) {
            const positionNames = new Set(state.positionFilter);
            locations = locations.filter(l => positionNames.has(l.name));
        }

        if (state.labelType === 'product_location') {
            const assignedLocationIds = new Set(state.itemLocations.map(il => il.locationId));
            return locations.filter(l => assignedLocationIds.has(l.id));
        }

        return locations;
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
```