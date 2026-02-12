
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
    abandonCountingSession as abandonCountingSessionServer, 
    generateBoletaFromSession, 
    getBoletas,
    updateBoletaStatus,
    getBoletaDetails,
    updateBoleta,
    getActiveCountingSessionForUser,
    getConsignmentSettings,
} from '../lib/actions';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory, User, ConsignmentSettings } from '@/modules/core/types';
import { generateDocument } from '@/lib/pdf-generator';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const emptyAgreement: Partial<ConsignmentAgreement> = {
    client_id: '',
    client_name: '',
    erp_warehouse_id: '',
    notes: '',
    is_active: 1,
};

type CountingStep = 'setup' | 'resume' | 'counting' | 'finished';

const initialCountingState: {
    step: CountingStep;
    isLoading: boolean;
    selectedAgreementId: string | null;
    session: (CountingSession & { lines: CountingSessionLine[] }) | null;
    existingSession: (CountingSession & { lines: CountingSessionLine[] }) | null;
    productsToCount: ConsignmentProduct[];
} = {
    step: 'setup',
    isLoading: false,
    selectedAgreementId: null,
    session: null,
    existingSession: null,
    productsToCount: [],
};

const initialBoletasState: {
    isLoading: boolean;
    boletas: RestockBoleta[];
    filters: { status: string[] };
    boletaToUpdate: RestockBoleta | null;
    statusUpdatePayload: { status: string; notes: string; erpInvoiceNumber?: string };
    isStatusModalOpen: boolean;
    isDetailsModalOpen: boolean;
    detailedBoleta: { boleta: RestockBoleta; lines: BoletaLine[]; history: BoletaHistory[] } | null;
    isDetailsLoading: boolean;
} = {
    isLoading: false,
    boletas: [],
    filters: { status: ['pending', 'approved', 'sent'] },
    boletaToUpdate: null,
    statusUpdatePayload: { status: '', notes: '', erpInvoiceNumber: '' },
    isStatusModalOpen: false,
    isDetailsModalOpen: false,
    detailedBoleta: null,
    isDetailsLoading: false,
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
    boletasState: initialBoletasState,
};

export const useConsignments = () => {
    const { setTitle } = usePageTitle();
    const { hasPermission, isAuthorized } = useAuthorization(['consignments:access']);
    const { toast } = useToast();
    const { user, customers, products, stockSettings, companyData } = useAuth();

    const [state, setState] = useState(initialState);
    
    const [debouncedClientSearch] = useDebounce(state.clientSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = useCallback((updater: (prevState: typeof initialState) => typeof initialState) => {
        setState(updater);
    }, []);

    const loadAgreements = useCallback(async () => {
        try {
            const agreementsData = await getConsignmentAgreements();
            updateState(prevState => ({ ...prevState, agreements: agreementsData }));
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar los acuerdos.", variant: "destructive" });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        setTitle('Gestión de Consignaciones');
        if (isAuthorized && user) {
            const loadData = async () => {
                updateState(prevState => ({ ...prevState, isLoading: true }));
                try {
                    const [agreementsData, activeSession] = await Promise.all([
                        getConsignmentAgreements(),
                        getActiveCountingSessionForUser(user.id)
                    ]);
                    
                    const newState: Partial<typeof initialState> = { 
                        agreements: agreementsData, 
                        isLoading: false 
                    };
                    if (activeSession) {
                        newState.countingState = {
                            ...initialCountingState,
                            existingSession: activeSession,
                            step: 'resume',
                        };
                    }
                    updateState(prevState => ({ ...prevState, ...newState }));

                } catch (error) {
                    toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
                    updateState(prevState => ({ ...prevState, isLoading: false }));
                }
            };
            loadData();
        } else if (isAuthorized) {
            updateState(prevState => ({ ...prevState, isLoading: false }));
        }
    }, [isAuthorized, user, toast, setTitle, updateState]);

    const agreementActions = useMemo(() => ({
        openAgreementForm: async (agreement: ConsignmentAgreement | null = null) => {
            if (agreement) {
                const details = await getAgreementDetails(agreement.id);
                if (details) {
                    updateState(prevState => ({
                        ...prevState,
                        editingAgreement: agreement,
                        agreementFormData: details.agreement,
                        agreementProducts: details.products,
                        clientSearchTerm: details.agreement.client_name,
                        warehouseSearchTerm: details.agreement.erp_warehouse_id || '',
                        isAgreementFormOpen: true,
                    }));
                }
            } else {
                updateState(prevState => ({
                    ...prevState,
                    editingAgreement: null,
                    agreementFormData: emptyAgreement,
                    agreementProducts: [],
                    clientSearchTerm: '',
                    warehouseSearchTerm: '',
                    isAgreementFormOpen: true,
                }));
            }
        },
        handleFieldChange: (field: keyof ConsignmentAgreement, value: any) => {
            updateState(prevState => {
                let newFormData = { ...prevState.agreementFormData, [field]: value } as Partial<ConsignmentAgreement>;
                let newClientSearchTerm = prevState.clientSearchTerm;
                let newWarehouseSearchTerm = prevState.warehouseSearchTerm;

                if (field === 'client_id') {
                    const client = customers.find(c => c.id === value);
                    if (client) {
                        newFormData = { ...newFormData, client_name: client.name };
                        newClientSearchTerm = client.name;
                    }
                }
                if (field === 'erp_warehouse_id') {
                     newWarehouseSearchTerm = value;
                }
                return { ...prevState, agreementFormData: newFormData, clientSearchTerm: newClientSearchTerm, warehouseSearchTerm: newWarehouseSearchTerm };
            });
        },
        addProductToAgreement: (productId: string) => {
            const product = products.find(p => p.id === productId);
            if (product && !state.agreementProducts.some(p => p.product_id === productId)) {
                const newProduct: ConsignmentProduct = { id: 0, agreement_id: 0, product_id: productId, max_stock: 0, price: 0 };
                updateState(prevState => ({
                    ...prevState,
                    agreementProducts: [...prevState.agreementProducts, newProduct],
                    productSearchTerm: '',
                    isProductSearchOpen: false
                }));
            }
        },
        removeProductFromAgreement: (index: number) => {
            updateState(prevState => ({
                ...prevState,
                agreementProducts: prevState.agreementProducts.filter((_, i) => i !== index)
            }));
        },
        updateProductField: (index: number, field: keyof ConsignmentProduct, value: any) => {
            updateState(prevState => {
                const updatedProducts = [...prevState.agreementProducts];
                (updatedProducts[index] as any)[field] = value;
                return { ...prevState, agreementProducts: updatedProducts };
            });
        },
        handleSaveAgreement: async () => {
            if (!state.agreementFormData.client_id || !state.agreementFormData.client_name) {
                toast({ title: 'Cliente requerido', variant: 'destructive' });
                return;
            }
            updateState(prevState => ({ ...prevState, isSubmitting: true }));
            try {
                 const payload = {
                    client_id: state.agreementFormData.client_id,
                    client_name: state.agreementFormData.client_name,
                    erp_warehouse_id: state.agreementFormData.erp_warehouse_id,
                    notes: state.agreementFormData.notes,
                    is_active: state.agreementFormData.is_active ?? 1,
                    ...(state.editingAgreement && { id: state.editingAgreement.id }),
                };

                await saveConsignmentAgreement(payload, state.agreementProducts);
                toast({ title: 'Acuerdo Guardado' });
                updateState(prevState => ({ ...prevState, isAgreementFormOpen: false }));
                await loadAgreements();
            } catch (error: any) {
                toast({ title: 'Error al Guardar', description: error.message, variant: 'destructive' });
            } finally {
                updateState(prevState => ({ ...prevState, isSubmitting: false }));
            }
        },
        toggleAgreementStatus: async (id: number, isActive: boolean) => {
            const originalAgreements = state.agreements;
            const originalAgreement = originalAgreements.find(a => a.id === id);
            if (!originalAgreement) return;
        
            const updatedAgreements = originalAgreements.map(a =>
              a.id === id ? { ...a, is_active: (isActive ? 1 : 0) as 0 | 1 } : a
            );
            updateState(prevState => ({ ...prevState, agreements: updatedAgreements }));
        
            const { product_count, ...agreementToSend } = originalAgreement;
            
            const updatedAgreementPayload = {
                ...agreementToSend,
                is_active: (isActive ? 1 : 0) as 0 | 1,
            };
        
            try {
                // Pass an empty array for products as we are only updating the agreement status
                await saveConsignmentAgreement(updatedAgreementPayload, []);
                toast({ title: `Acuerdo ${isActive ? 'habilitado' : 'deshabilitado'}` });
            } catch (error: any) {
                toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
                updateState(prevState => ({ ...prevState, agreements: originalAgreements }));
            }
        },
        handleDeleteAgreement: async () => {
            if (!state.agreementToDelete) return;
            updateState(prevState => ({ ...prevState, isSubmitting: true }));
            try {
                await deleteConsignmentAgreement(state.agreementToDelete.id);
                toast({ title: 'Acuerdo Eliminado' });
                updateState(prevState => ({ ...prevState, agreementToDelete: null }));
                await loadAgreements();
            } catch (error: any) {
                toast({ title: 'Error al Eliminar', description: error.message, variant: 'destructive' });
            } finally {
                updateState(prevState => ({ ...prevState, isSubmitting: false }));
            }
        },
        setShowOnlyActiveAgreements: (show: boolean) => updateState(prevState => ({ ...prevState, showOnlyActiveAgreements: show })),
        setAgreementToDelete: (agreement: ConsignmentAgreement | null) => updateState(prevState => ({ ...prevState, agreementToDelete: agreement })),
        setIsAgreementFormOpen: (isOpen: boolean) => updateState(prevState => ({ ...prevState, isAgreementFormOpen: isOpen })),
        setClientSearchTerm: (term: string) => updateState(prevState => ({ ...prevState, clientSearchTerm: term })),
        setIsClientSearchOpen: (isOpen: boolean) => updateState(prevState => ({ ...prevState, isClientSearchOpen: isOpen })),
        setWarehouseSearchTerm: (term: string) => updateState(prevState => ({ ...prevState, warehouseSearchTerm: term })),
        setIsWarehouseSearchOpen: (isOpen: boolean) => updateState(prevState => ({ ...prevState, isWarehouseSearchOpen: isOpen })),
        setProductSearchTerm: (term: string) => updateState(prevState => ({ ...prevState, productSearchTerm: term })),
        setIsProductSearchOpen: (isOpen: boolean) => updateState(prevState => ({ ...prevState, isProductSearchOpen: isOpen })),
    }), [customers, products, state.agreementFormData, state.editingAgreement, state.agreementProducts, loadAgreements, toast, updateState, state.agreements, state.agreementToDelete]);

    const countActions = useMemo(() => ({
        handleSelectAgreement: (id: string) => updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, selectedAgreementId: id } })),
        handleStartSession: async () => {
            if (!user || !state.countingState.selectedAgreementId) return;
            updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: true } }));
            try {
                const session = await startOrContinueCountingSession(Number(state.countingState.selectedAgreementId), user.id);
                const details = await getAgreementDetails(Number(state.countingState.selectedAgreementId));
                updateState(prevState => ({ 
                    ...prevState,
                    countingState: { 
                        ...prevState.countingState, 
                        isLoading: false,
                        session, 
                        productsToCount: details?.products || [],
                        step: 'counting',
                    } 
                }));
            } catch (error: any) {
                toast({ title: 'Error al iniciar sesión', description: error.message, variant: 'destructive' });
                updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: false } }));
            }
        },
        handleSaveLine: (productId: string, quantity: number) => {
            if (!state.countingState.session) return;
            saveCountLine(state.countingState.session.id, productId, quantity);
        },
        abandonCurrentSession: async () => {
            if (!user || !state.countingState.session) return;
            await abandonCountingSessionServer(state.countingState.session.id, user.id);
            updateState(prevState => ({ ...prevState, countingState: initialCountingState }));
        },
        handleGenerateBoleta: async () => {
             if (!user || !state.countingState.session) return;
             updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: true } }));
             try {
                const newBoleta = await generateBoletaFromSession(state.countingState.session.id, user.id, user.name);
                toast({ title: 'Boleta Generada', description: `Se creó la boleta ${newBoleta.consecutive}` });
                updateState(prevState => ({ ...prevState, currentTab: 'boletas', countingState: initialCountingState }));
             } catch (error: any) {
                 toast({ title: 'Error al generar boleta', description: error.message, variant: 'destructive'});
             } finally {
                updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: false } }));
             }
        },
        resumeSession: async () => {
            if (!state.countingState.existingSession) return;
            updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: true } }));
            try {
                const details = await getAgreementDetails(state.countingState.existingSession.agreement_id);
                updateState(prevState => ({
                    ...prevState,
                    countingState: {
                        ...prevState.countingState,
                        isLoading: false,
                        session: prevState.countingState.existingSession,
                        productsToCount: details?.products || [],
                        step: 'counting',
                        existingSession: null,
                    }
                }));
            } catch (error: any) {
                toast({ title: 'Error al reanudar', description: error.message, variant: 'destructive' });
                updateState(prevState => ({ ...prevState, countingState: { ...prevState.countingState, isLoading: false } }));
            }
        },
        abandonSession: async () => {
            if (!user || !state.countingState.existingSession) return;
            await abandonCountingSessionServer(state.countingState.existingSession.id, user.id);
            updateState(prevState => ({ ...prevState, countingState: initialCountingState }));
            toast({ title: 'Sesión Abandonada' });
        },
    }), [user, state.countingState, toast, updateState]);
    
    const loadBoletasCallback = useCallback(async () => {
        updateState(prevState => ({...prevState, boletasState: { ...prevState.boletasState, isLoading: true } }));
        try {
            const boletasData = await getBoletas(state.boletasState.filters);
            updateState(prevState => ({...prevState, boletasState: { ...prevState.boletasState, boletas: boletasData, isLoading: false }}));
        } catch (error: any) {
            toast({ title: 'Error', description: 'No se pudieron cargar las boletas.', variant: 'destructive' });
            updateState(prevState => ({...prevState, boletasState: { ...prevState.boletasState, isLoading: false }}));
        }
    }, [state.boletasState.filters, toast, updateState]);
    
    useEffect(() => {
        if (state.currentTab === 'boletas') {
            loadBoletasCallback();
        }
    }, [state.currentTab, loadBoletasCallback]);


    const boletaActions = useMemo(() => ({
        loadBoletas: loadBoletasCallback,
        openBoletaDetails: async (boletaId: number) => {
            updateState(prev => ({...prev, boletasState: { ...prev.boletasState, isDetailsModalOpen: true, isDetailsLoading: true }}));
            try {
                const details = await getBoletaDetails(boletaId);
                updateState(prev => ({...prev, boletasState: { ...prev.boletasState, detailedBoleta: details, isDetailsLoading: false }}));
            } catch (error: any) {
                toast({ title: 'Error', description: 'No se pudieron cargar los detalles.', variant: 'destructive' });
                 updateState(prev => ({...prev, boletasState: { ...prev.boletasState, isDetailsLoading: false }}));
            }
        },
        setDetailsModalOpen: (isOpen: boolean) => updateState(prev => ({...prev, boletasState: { ...prev.boletasState, isDetailsModalOpen: isOpen }})),
        openStatusModal: (boleta: RestockBoleta, status: string) => {
            updateState(prev => ({ ...prev, boletasState: {
                ...prev.boletasState,
                boletaToUpdate: boleta,
                statusUpdatePayload: { status, notes: '', erpInvoiceNumber: '' },
                isStatusModalOpen: true,
            }}));
        },
        setStatusModalOpen: (isOpen: boolean) => updateState(prev => ({...prev, boletasState: { ...prev.boletasState, isStatusModalOpen: isOpen }})),
        handleStatusUpdatePayloadChange: (field: string, value: string) => {
            updateState(prev => ({ ...prev, boletasState: {
                ...prev.boletasState,
                statusUpdatePayload: { ...prev.boletasState.statusUpdatePayload, [field]: value }
            }}));
        },
        submitStatusUpdate: async () => {
            const { boletaToUpdate, statusUpdatePayload } = state.boletasState;
            if (!boletaToUpdate || !user) return;
    
            if (statusUpdatePayload.status === 'invoiced' && !statusUpdatePayload.erpInvoiceNumber?.trim()) {
                toast({ title: "Número de Factura Requerido", variant: "destructive" });
                return;
            }
            updateState(prev => ({ ...prev, isSubmitting: true }));
            try {
                const payload = {
                    boletaId: boletaToUpdate.id,
                    ...statusUpdatePayload,
                    updatedBy: user.name,
                };
                const updatedBoleta = await updateBoletaStatus(payload);
                toast({ title: 'Estado de Boleta Actualizado' });
                
                updateState(prev => ({...prev, boletasState: { ...prev.boletasState, isStatusModalOpen: false, boletas: prev.boletasState.boletas.map(b => b.id === updatedBoleta.id ? updatedBoleta : b) }}));
            } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } finally {
                updateState(prev => ({ ...prev, isSubmitting: false }));
            }
        },
        handleDetailedLineChange: (lineId: number, newQuantity: number) => {
            updateState(prev => {
                if (!prev.boletasState.detailedBoleta) return prev;
                const newLines = prev.boletasState.detailedBoleta.lines.map(line => 
                    line.id === lineId ? { ...line, replenish_quantity: newQuantity } : line
                );
                return { ...prev, boletasState: { ...prev.boletasState, detailedBoleta: { ...prev.boletasState.detailedBoleta, lines: newLines } } };
            });
        },
        saveBoletaChanges: async () => {
            const { detailedBoleta } = state.boletasState;
            if (!detailedBoleta || !user) return;
            updateState(prev => ({ ...prev, isSubmitting: true }));
            try {
                const updatedBoleta = await updateBoleta(detailedBoleta.boleta, detailedBoleta.lines, user.name);
                toast({ title: 'Boleta Actualizada' });
                updateState(prev => ({
                    ...prev, 
                    boletasState: { 
                        ...prev.boletasState, 
                        isDetailsModalOpen: false,
                        boletas: prev.boletasState.boletas.map(b => b.id === updatedBoleta.id ? updatedBoleta : b),
                        detailedBoleta: { ...prev.boletasState.detailedBoleta!, boleta: updatedBoleta }
                    }
                }));
            } catch (error: any) {
                toast({ title: 'Error al Guardar', description: error.message, variant: 'destructive' });
            } finally {
                updateState(prev => ({ ...prev, isSubmitting: false }));
            }
        },
        handlePrintBoleta: async (boleta: RestockBoleta) => {
            if (!companyData || !user) return;
            updateState(prevState => ({...prevState, isSubmitting: true}));
            try {
                const details = await getBoletaDetails(boleta.id);
                if (!details) throw new Error('No se encontraron los detalles de la boleta.');

                const settings = await getConsignmentSettings();

                const allHeaders = ['Código', 'Descripción', 'Inv. Físico', 'Máximo', 'Reponer'];
                const allDataKeys = ['product_id', 'product_description', 'counted_quantity', 'max_stock', 'replenish_quantity'];
                
                const visibleColumns = settings.pdfExportColumns || allDataKeys;
                const tableHeaders = visibleColumns.map(key => allHeaders[allDataKeys.indexOf(key)]);
                const columnStyles: { [key: number]: any } = {};
                
                const tableRows = details.lines.map(line => {
                    const row: { [key: string]: any } = {};
                    allDataKeys.forEach(key => row[key] = (line as any)[key]);
                    return visibleColumns.map(key => String(row[key]));
                });
                
                visibleColumns.forEach((key, index) => {
                    if (['counted_quantity', 'max_stock', 'replenish_quantity'].includes(key)) {
                        columnStyles[index] = { halign: 'right' };
                    }
                    if (key === 'replenish_quantity') {
                        columnStyles[index] = { ...columnStyles[index], fontStyle: 'bold' };
                    }
                });

                const doc = generateDocument({
                    docTitle: 'BOLETA DE REPOSICIÓN DE CONSIGNACIÓN', docId: boleta.consecutive,
                    meta: [
                        { label: 'Fecha Creación', value: format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm') },
                        ...(boleta.approved_at ? [{ label: 'Fecha Aprobación', value: format(parseISO(boleta.approved_at), 'dd/MM/yyyy HH:mm') }] : []),
                    ],
                    companyData, logoDataUrl: companyData.logoUrl,
                    blocks: [
                        { title: 'CLIENTE:', content: state.agreements.find(a => a.id === boleta.agreement_id)?.client_name || 'N/A' },
                        { title: 'BODEGA ERP:', content: state.agreements.find(a => a.id === boleta.agreement_id)?.erp_warehouse_id || 'N/A' },
                        { title: 'CREADO POR:', content: boleta.created_by },
                        ...(boleta.approved_by ? [{ title: 'APROBADO POR:', content: boleta.approved_by }] : []),
                    ],
                    table: {
                        columns: tableHeaders,
                        rows: tableRows,
                        columnStyles,
                    },
                    totals: [],
                    signatureBlock: [{ label: 'Preparado y Entregado por:', value: '' }, { label: 'Recibido Conforme por:', value: '' }],
                    topLegend: settings.pdfTopLegend,
                });
                doc.save(`boleta_reposicion_${boleta.consecutive}.pdf`);
            } catch (error: any) {
                toast({ title: 'Error al Imprimir', description: error.message, variant: 'destructive' });
            } finally {
                updateState(prevState => ({...prevState, isSubmitting: false}));
            }
        },
    }), [loadBoletasCallback, user, toast, companyData, state.agreements, state.boletasState, products, updateState]);
    
    const selectors = useMemo(() => ({
        hasPermission,
        filteredAgreements: state.agreements.filter(a => !state.showOnlyActiveAgreements || a.is_active === 1),
        agreementOptions: state.agreements.filter(a => a.is_active).map(a => ({ value: String(a.id), label: a.client_name })),
        customerOptions: debouncedClientSearch.length < 2 ? [] : customers.filter(c => c.name.toLowerCase().includes(debouncedClientSearch.toLowerCase()) || c.id.includes(debouncedClientSearch)).map(c => ({ value: c.id, label: `[${c.id}] ${c.name}` })),
        warehouseOptions: stockSettings?.warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.id})` })) || [],
        productOptions: debouncedProductSearch.length < 2 ? [] : products.filter(p => p.id.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p.description.toLowerCase().includes(debouncedProductSearch.toLowerCase())).map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` })),
        getProductName: (id: string) => products.find(p => p.id === id)?.description || 'Desconocido',
        getAgreementName: (id: number) => state.agreements.find(a => a.id === id)?.client_name || 'Desconocido',
        getInitialCount: (productId: string) => state.countingState.session?.lines.find(l => l.product_id === productId)?.counted_quantity,
        statusConfig: {
            pending: { label: "Pendiente", color: "bg-yellow-500" },
            approved: { label: "Aprobada", color: "bg-green-500" },
            sent: { label: "Enviada", color: "bg-blue-500" },
            invoiced: { label: "Facturada", color: "bg-indigo-500" },
            canceled: { label: "Cancelada", color: "bg-red-700" },
        }
    }), [state.agreements, state.showOnlyActiveAgreements, debouncedClientSearch, debouncedProductSearch, customers, stockSettings, products, state.countingState.session, hasPermission]);
    
    return {
        state,
        actions: {
            setCurrentTab: (tab: 'agreements' | 'inventory_count' | 'boletas') => updateState(prevState => ({...prevState, currentTab: tab})),
            agreementActions,
            countActions,
            boletaActions,
        },
        selectors,
        isAuthorized,
    };
};
