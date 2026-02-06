/**
 * @fileoverview Hook for the guided rack population wizard.
 * This has been converted from a page component to a hook to centralize logic.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getLocations, getChildLocations, lockEntity, releaseLock, assignItemToLocation, updateLocationPopulationStatus, finalizePopulationSession } from '@/modules/warehouse/lib/actions';
import { getActiveWizardSession, saveWizardSession, clearWizardSession } from '@/modules/core/lib/db';
import type { Product, WarehouseLocation, WizardSession } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

export type WizardStep = 'setup' | 'populating' | 'finished' | 'resume';

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


export const usePopulationWizard = () => {
    useAuthorization(['warehouse:access']);
    const { toast } = useToast();
    const { user, companyData, products: authProducts } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [wizardStep, setWizardStep] = useState<WizardStep>('setup');
    const [allLocations, setAllLocations] = useState<(WarehouseLocation & { isCompleted?: boolean })[]>([]);
    
    const [selectedRackId, setSelectedRackId] = useState<number | null>(null);
    const [rackLevels, setRackLevels] = useState<(WarehouseLocation & { isCompleted?: boolean })[]>([]);
    const [selectedLevelIds, setSelectedLevelIds] = useState<Set<number>>(new Set());

    const [locationsToPopulate, setLocationsToPopulate] = useState<WarehouseLocation[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [productSearch, setProductSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [lastAssignment, setLastAssignment] = useState<{ location: string; product: string; code: string; } | null>(null);
    
    const [rackSearchTerm, setRackSearchTerm] = useState('');
    const [isRackSearchOpen, setIsRackSearchOpen] = useState(false);

    const [debouncedProductSearch] = useDebounce(productSearch, companyData?.searchDebounceTime ?? 300);
    const [debouncedRackSearch] = useDebounce(rackSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [existingSession, setExistingSession] = useState<WizardSession | null>(null);
    
    const [sessionAssignments, setSessionAssignments] = useState<{ locationId: number, itemId: string }[]>([]);

    const rackOptions = useMemo(() => {
        if (!debouncedRackSearch && !isRackSearchOpen) return allLocations.filter(l => l.type === 'rack').map(r => ({ value: String(r.id), label: `${r.name} (${r.code})` }));

        return allLocations
            .filter(l => l.type === 'rack' && 
                (l.name.toLowerCase().includes(debouncedRackSearch.toLowerCase()) || l.code.toLowerCase().includes(debouncedRackSearch.toLowerCase()))
            )
            .map(r => ({ value: String(r.id), label: `${r.name} (${r.code})` }));
    }, [allLocations, debouncedRackSearch, isRackSearchOpen]);
    
    const productOptions = useMemo(() => {
        if (!debouncedProductSearch) return [];
        const searchLower = debouncedProductSearch.toLowerCase();
        if (searchLower.length < 2) return [];

        return authProducts
            .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
            .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
    }, [authProducts, debouncedProductSearch]);

    useEffect(() => {
        const loadInitial = async () => {
            setIsLoading(true);
            try {
                if (user) {
                    const [locs, session] = await Promise.all([
                        getLocations(),
                        getActiveWizardSession(user.id)
                    ]);
                    setAllLocations(locs);
                    if (session) {
                        setExistingSession(session);
                        setWizardStep('resume');
                    }
                }
            } catch (err: any) {
                toast({ title: 'Error', description: 'No se pudieron cargar los datos iniciales.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        if (user) {
            loadInitial();
        }
    }, [toast, user]);

    const handleSelectRack = async (rackIdStr: string) => {
        const id = Number(rackIdStr);
        setSelectedRackId(id);
        const selectedRack = allLocations.find(l => l.id === id);
        if (selectedRack) {
            setRackSearchTerm(`${selectedRack.name} (${selectedRack.code})`);
        }
        setIsRackSearchOpen(false);

        const allLocs = await getLocations(); // Re-fetch to get latest lock and completion status
        setAllLocations(allLocs);
        const levels = allLocs.filter(l => l.parentId === id);
        setRackLevels(levels);
        setSelectedLevelIds(new Set());
    };

    const handleToggleLevel = (levelId: number) => {
        setSelectedLevelIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(levelId)) {
                newSet.delete(levelId);
            } else {
                newSet.add(levelId);
            }
            return newSet;
        });
    };

    const handleStartWizard = async () => {
        if (!user || !selectedRackId || selectedLevelIds.size === 0) {
            toast({ title: 'Selección Incompleta', description: 'Por favor, selecciona un rack y al menos un nivel para continuar.', variant: 'destructive' });
            return;
        }

        if (!rackLevels || rackLevels.length === 0 || !allLocations || allLocations.length === 0) {
            toast({ title: 'Error de Datos', description: 'Los datos de ubicación no se cargaron correctamente. Intenta seleccionar el rack de nuevo.', variant: 'destructive' });
            return;
        }
        
        setIsLoading(true);

        try {
            const { locked } = await lockEntity({
                entityIds: Array.from(selectedLevelIds),
                userName: user.name,
                userId: user.id
            });

            if (locked) {
                 toast({ title: 'Niveles ya en uso', description: 'Algunos de los niveles seleccionados están siendo poblados por otro usuario.', variant: 'destructive' });
                 setIsLoading(false);
                 await handleSelectRack(String(selectedRackId)); // Re-fetch to update lock status display
                 return;
            }

            const childLocations = await getChildLocations(Array.from(selectedLevelIds));
            setLocationsToPopulate(childLocations.sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
            
            const sessionData: WizardSession = { rackId: selectedRackId, levelIds: Array.from(selectedLevelIds), currentIndex: 0 };
            await saveWizardSession(user.id, sessionData);

            setCurrentIndex(0);
            setWizardStep('populating');
            
        } catch (err: any) {
            toast({ title: 'Error al Iniciar', description: err.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const assignAndNext = async (productId?: string) => {
        const currentLocation = locationsToPopulate[currentIndex];
        if (user) {
            try {
                if (productId) { // If an item is assigned
                    await assignItemToLocation({
                        itemId: productId,
                        locationId: currentLocation.id,
                        clientId: null,
                        updatedBy: user.name,
                    });
                     setSessionAssignments(prev => [...prev, { locationId: currentLocation.id, itemId: productId }]);
                    const product = authProducts.find(p => p.id === productId);
                    const productName = product?.description || productId;
                    const productCode = product?.id || productId;
                    setLastAssignment({ 
                        location: renderLocationPathAsString(currentLocation.id, allLocations), 
                        product: productName,
                        code: productCode
                    });
                } else { // If the item is skipped
                    await updateLocationPopulationStatus(currentLocation.id, 'S');
                }
            } catch (err: any) {
                toast({ title: "Error al Asignar", description: err.message, variant: "destructive" });
                return; // Stop flow on error
            }
        }
        setProductSearch('');
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < locationsToPopulate.length) {
            setCurrentIndex(nextIndex);
            if (user && selectedRackId !== null) {
                await saveWizardSession(user.id, { rackId: selectedRackId, levelIds: Array.from(selectedLevelIds), currentIndex: nextIndex });
            }
        } else {
            await handleFinishWizard();
        }
    };
    
    const handleProductSelect = (productId: string) => {
        setProductSearch(productId);
        setIsProductSearchOpen(false);
        assignAndNext(productId);
    };

    const handleSkip = () => {
        assignAndNext(); // No product ID, just move to next
    };

    const handlePrevious = async () => {
        const prevIndex = Math.max(0, currentIndex - 1);
        setCurrentIndex(prevIndex);
        if (user && selectedRackId !== null) {
            await saveWizardSession(user.id, { rackId: selectedRackId, levelIds: Array.from(selectedLevelIds), currentIndex: prevIndex });
        }
    };

    const handleFinishWizard = async () => {
        if (user) {
            await clearWizardSession(user.id);
            await finalizePopulationSession({ 
                levelIds: Array.from(selectedLevelIds), 
                userName: user.name, 
                userId: user.id,
                assignments: sessionAssignments,
            });
        }
        setWizardStep('finished');
    };
    
    const resetWizard = () => {
        setSelectedRackId(null);
        setRackLevels([]);
        setSelectedLevelIds(new Set());
        setLocationsToPopulate([]);
        setCurrentIndex(0);
        setLastAssignment(null);
        setExistingSession(null);
        setRackSearchTerm('');
        setSessionAssignments([]);
        setWizardStep('setup');
    };

    const abandonSession = async () => {
        if(user && existingSession) {
            await clearWizardSession(user.id);
            await releaseLock(existingSession.levelIds, user.id);
        }
        resetWizard();
    };

    const resumeSession = async () => {
        if (!user || !existingSession) return;
        setIsLoading(true);

        const locationMap = new Map(allLocations.map(l => [l.id, l]));
        const rackExists = locationMap.has(existingSession.rackId);
        const allLevelsExist = existingSession.levelIds.every(id => locationMap.has(id));

        if (!rackExists || !allLevelsExist) {
            toast({
                title: "Sesión Corrupta",
                description: "El rack o los niveles guardados en esta sesión ya no existen. La sesión será abandonada.",
                variant: "destructive",
                duration: 7000
            });
            await abandonSession();
            setIsLoading(false);
            return;
        }

        try {
            await handleSelectRack(String(existingSession.rackId));
            setSelectedLevelIds(new Set(existingSession.levelIds));
            const childLocations = await getChildLocations(existingSession.levelIds);
            setLocationsToPopulate(childLocations.sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
            setCurrentIndex(existingSession.currentIndex);
            setWizardStep('populating');
        } catch (error: any) {
            toast({ title: 'Error al Reanudar', description: 'No se pudo cargar la sesión. Puede que necesites abandonarla y empezar de nuevo.', variant: 'destructive'});
            resetWizard();
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && productOptions.length > 0) {
            e.preventDefault();
            handleProductSelect(productOptions[0].value);
        }
    };
    
    return {
        state: {
            isLoading, wizardStep, allLocations, selectedRackId, rackLevels, selectedLevelIds,
            locationsToPopulate, currentIndex, productSearch, isProductSearchOpen,
            lastAssignment, rackSearchTerm, isRackSearchOpen, existingSession
        },
        actions: {
            handleSelectRack, handleToggleLevel, handleStartWizard, handleProductSelect, handleKeyDown,
            handleSkip, handlePrevious, handleFinishWizard, resetWizard, abandonSession, resumeSession,
            setProductSearch, setIsProductSearchOpen, setRackSearchTerm, setIsRackSearchOpen
        },
        selectors: {
            rackOptions, productOptions, renderLocationPathAsString
        }
    };
};
