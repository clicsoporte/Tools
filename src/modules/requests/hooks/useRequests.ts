/**
 * @fileoverview Custom hook `useRequests` for managing the state and logic of the Purchase Request page.
 * This hook encapsulates all state and actions for the module, keeping the UI component clean.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { 
    getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, 
    updatePurchaseRequestStatus, getRequestHistory, getRequestSettings, 
    updatePendingAction, getErpOrderData
} from '@/modules/requests/lib/actions';
import type { 
    PurchaseRequest, PurchaseRequestStatus, PurchaseRequestPriority, 
    PurchaseRequestHistoryEntry, RequestSettings, Company, DateRange, 
    AdministrativeAction, AdministrativeActionPayload, Product, StockInfo 
} from '../../core/types';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { getDaysRemaining as getSimpleDaysRemaining } from '@/modules/core/lib/time-utils';

const emptyRequest: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus' | 'lastModifiedAt' | 'lastModifiedBy' | 'hasBeenModified' | 'approvedBy' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes'> = {
    requiredDate: '',
    clientId: '',
    clientName: '',
    clientTaxId: '',
    itemId: '',
    itemDescription: '',
    quantity: 0,
    notes: '',
    unitSalePrice: 0,
    manualSupplier: '',
    erpOrderNumber: '',
    erpOrderLine: 0,
    purchaseOrder: '',
    route: '',
    shippingMethod: '',
    inventory: 0,
    priority: 'medium',
    purchaseType: 'single',
    arrivalDate: '',
    pendingAction: 'none',
};

type ErpOrderLine = {
    PEDIDO: string;
    PEDIDO_LINEA: number;
    ARTICULO: string;
    PRECIO_UNITARIO: number;
    CANTIDAD_PEDIDA: number;
    // UI state
    product: Product;
    stock: StockInfo | null;
    selected: boolean;
    displayQuantity: string;
    displayPrice: string;
};


const statusConfig: { [key: string]: { label: string, color: string } } = {
    pending: { label: "Pendiente", color: "bg-yellow-500" },
    approved: { label: "Aprobada", color: "bg-green-500" },
    ordered: { label: "Ordenada", color: "bg-blue-500" },
    received: { label: "Recibida", color: "bg-teal-500" },
    'received-in-warehouse': { label: "En Bodega", color: "bg-gray-700" },
    canceled: { label: "Cancelada", color: "bg-red-700" }
};

const priorityConfig = { 
    low: { label: "Baja", className: "text-gray-500" }, 
    medium: { label: "Media", className: "text-blue-500" }, 
    high: { label: "Alta", className: "text-yellow-600" }, 
    urgent: { label: "Urgente", className: "text-red-600" }
};

type State = {
    isLoading: boolean;
    isSubmitting: boolean;
    isNewRequestDialogOpen: boolean;
    isEditRequestDialogOpen: boolean;
    activeRequests: PurchaseRequest[];
    archivedRequests: PurchaseRequest[];
    viewingArchived: boolean;
    archivedPage: number;
    pageSize: number;
    totalArchived: number;
    requestSettings: RequestSettings | null;
    companyData: Company | null;
    newRequest: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus' | 'lastModifiedAt' | 'lastModifiedBy' | 'hasBeenModified' | 'approvedBy' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes'>;
    requestToEdit: PurchaseRequest | null;
    searchTerm: string;
    statusFilter: string;
    classificationFilter: string;
    dateFilter: DateRange | undefined;
    showOnlyMyRequests: boolean;
    clientSearchTerm: string;
    isClientSearchOpen: boolean;
    itemSearchTerm: string;
    isItemSearchOpen: boolean;
    isStatusDialogOpen: boolean;
    requestToUpdate: PurchaseRequest | null;
    newStatus: PurchaseRequestStatus | null;
    statusUpdateNotes: string;
    deliveredQuantity: number | string;
    isHistoryDialogOpen: boolean;
    historyRequest: PurchaseRequest | null;
    history: PurchaseRequestHistoryEntry[];
    isHistoryLoading: boolean;
    isReopenDialogOpen: boolean;
    reopenStep: number;
    reopenConfirmationText: string;
    arrivalDate: string;
    isActionDialogOpen: boolean;
    isErpOrderModalOpen: boolean;
    isErpItemsModalOpen: boolean;
    erpOrderNumber: string;
    erpOrderHeaders: any[];
    selectedErpOrderHeader: any;
    erpOrderLines: ErpOrderLine[];
    isErpLoading: boolean;
    showOnlyShortageItems: boolean;
};


export const useRequests = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['requests:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, customers: authCustomers, products: authProducts, stockLevels: authStockLevels, companyData: authCompanyData } = useAuth();
    
    const abortControllerRef = useRef<AbortController | null>(null);

    const [state, setState] = useState<State>({
        isLoading: true,
        isSubmitting: false,
        isNewRequestDialogOpen: false,
        isEditRequestDialogOpen: false,
        activeRequests: [],
        archivedRequests: [],
        viewingArchived: false,
        archivedPage: 0,
        pageSize: 50,
        totalArchived: 0,
        requestSettings: null,
        companyData: null,
        newRequest: emptyRequest,
        requestToEdit: null,
        searchTerm: "",
        statusFilter: "all",
        classificationFilter: "all",
        dateFilter: undefined,
        showOnlyMyRequests: false,
        clientSearchTerm: "",
        isClientSearchOpen: false,
        itemSearchTerm: "",
        isItemSearchOpen: false,
        isStatusDialogOpen: false,
        requestToUpdate: null,
        newStatus: null,
        statusUpdateNotes: "",
        deliveredQuantity: "",
        isHistoryDialogOpen: false,
        historyRequest: null,
        history: [],
        isHistoryLoading: false,
        isReopenDialogOpen: false,
        reopenStep: 0,
        reopenConfirmationText: '',
        arrivalDate: '',
        isActionDialogOpen: false,
        isErpOrderModalOpen: false,
        isErpItemsModalOpen: false,
        erpOrderNumber: '',
        erpOrderHeaders: [],
        selectedErpOrderHeader: null,
        erpOrderLines: [],
        isErpLoading: false,
        showOnlyShortageItems: true,
    });
    
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, state.companyData?.searchDebounceTime ?? 500);
    const [debouncedClientSearch] = useDebounce(state.clientSearchTerm, state.companyData?.searchDebounceTime ?? 500);
    const [debouncedItemSearch] = useDebounce(state.itemSearchTerm, state.companyData?.searchDebounceTime ?? 500);
    
    const updateState = useCallback((newState: Partial<State>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadInitialData = useCallback(async (page = 0) => {
        let isMounted = true;
        updateState({ isLoading: true });
        try {
             const [settingsData, requestsData] = await Promise.all([
                getRequestSettings(),
                getPurchaseRequests({
                    page: state.viewingArchived ? page : undefined,
                    pageSize: state.viewingArchived ? state.pageSize : undefined,
                })
            ]);
            
            if (!isMounted) return;

            updateState({ requestSettings: settingsData });
            
            const useWarehouse = settingsData.useWarehouseReception;
            const activeFilter = (o: PurchaseRequest) => useWarehouse ? o.status !== 'received-in-warehouse' && o.status !== 'canceled' : o.status !== 'received' && o.status !== 'canceled';
            
            const allRequests = requestsData.requests;
            
            updateState({
                activeRequests: allRequests.filter(activeFilter),
                archivedRequests: allRequests.filter(req => !activeFilter(req)),
                totalArchived: requestsData.totalArchivedCount,
            });

        } catch (error) {
             if (isMounted) {
                logError("Failed to load purchase requests data", { error: (error as Error).message });
                toast({ title: "Error", description: "No se pudieron cargar las solicitudes de compra.", variant: "destructive" });
            }
        } finally {
            if (isMounted) {
                updateState({ isLoading: false });
            }
        }
         return () => { isMounted = false; };
    }, [toast, state.viewingArchived, state.pageSize, updateState]);
    
    useEffect(() => {
        setTitle("Solicitud de Compra");
        if (isAuthorized) {
            loadInitialData(state.archivedPage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);

     useEffect(() => {
        if (!isAuthorized || state.isLoading) return;
        loadInitialData(state.archivedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.archivedPage, state.pageSize, state.viewingArchived, isAuthorized]);

    useEffect(() => {
        updateState({ companyData: authCompanyData });
    }, [authCompanyData, updateState]);
    
    useEffect(() => {
        const fetchSettingsAndQueries = async () => {
            const settings = await getRequestSettings();
            
            const defaultHeaderQuery = `SELECT [PEDIDO], [ESTADO], [CLIENTE], [FECHA_PEDIDO], [FECHA_PROMETIDA], [ORDEN_COMPRA], [TOTAL_UNIDADES], [MONEDA_PEDIDO], [USUARIO] FROM [SOFTLAND].[GAREND].[PEDIDO] WHERE [ESTADO] <> 'F' AND [PEDIDO] = ?`;
            const defaultLinesQuery = `SELECT [PEDIDO], [PEDIDO_LINEA], [ARTICULO], [PRECIO_UNITARIO], [CANTIDAD_PEDIDA] FROM [SOFTLAND].[GAREND].[PEDIDO_LINEA] WHERE [PEDIDO] = ?`;

            let needsUpdate = false;
            if (!settings.erpHeaderQuery || !settings.erpHeaderQuery.includes('[PEDIDO] = ?')) {
                settings.erpHeaderQuery = defaultHeaderQuery;
                needsUpdate = true;
            }
            if (!settings.erpLinesQuery || !settings.erpLinesQuery.includes('[PEDIDO] = ?')) {
                settings.erpLinesQuery = defaultLinesQuery;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await saveRequestSettings(settings);
            }
            updateState({ requestSettings: settings });
        };

        if (isAuthorized) {
            fetchSettingsAndQueries();
        }
    }, [isAuthorized, updateState]);

    const handleCreateRequest = async () => {
        if (!state.newRequest.clientId || !state.newRequest.itemId || !state.newRequest.quantity || !state.newRequest.requiredDate || !currentUser) return;
        
        const requestWithFormattedDate = {
            ...state.newRequest,
            requiredDate: new Date(state.newRequest.requiredDate).toISOString().split('T')[0]
        };

        updateState({ isSubmitting: true });
        try {
            const createdRequest = await savePurchaseRequest(requestWithFormattedDate, currentUser.name);
            toast({ title: "Solicitud Creada" });
            updateState({
                isNewRequestDialogOpen: false,
                newRequest: emptyRequest,
                clientSearchTerm: '',
                itemSearchTerm: '',
                activeRequests: [createdRequest, ...state.activeRequests]
            });
        } catch (error: any) {
            logError("Failed to create request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleEditRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.requestToEdit || !currentUser) return;
        updateState({ isSubmitting: true });
        try {
            const updated = await updatePurchaseRequest({ requestId: state.requestToEdit.id, updatedBy: currentUser.name, ...state.requestToEdit });
            updateState({
                activeRequests: state.activeRequests.map(r => r.id === updated.id ? updated : r),
                archivedRequests: state.archivedRequests.map(r => r.id === updated.id ? updated : r),
                isEditRequestDialogOpen: false
            });
            toast({ title: "Solicitud Actualizada" });
        } catch (error: any) {
            logError("Failed to edit request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const openStatusDialog = (request: PurchaseRequest, status: PurchaseRequestStatus) => {
        updateState({
            requestToUpdate: request,
            newStatus: status,
            statusUpdateNotes: ".",
            deliveredQuantity: status === 'received' ? request.quantity : "",
            arrivalDate: '',
            isStatusDialogOpen: true
        });
    };

    const openAdminActionDialog = async (request: PurchaseRequest, action: AdministrativeAction) => {
        if (!currentUser) return;
        updateState({ isSubmitting: true });
        try {
            const payload: AdministrativeActionPayload = {
                entityId: request.id,
                action,
                notes: `Solicitud de ${action === 'unapproval-request' ? 'desaprobación' : 'cancelación'} iniciada.`,
                updatedBy: currentUser.name,
            };
            const updated = await updatePendingAction(payload);
            updateState({
                activeRequests: state.activeRequests.map(r => r.id === updated.id ? updated : r),
                archivedRequests: state.archivedRequests.map(r => r.id === updated.id ? updated : r)
            });
            toast({ title: "Solicitud Enviada", description: `Tu solicitud de ${action === 'unapproval-request' ? 'desaprobación' : 'cancelación'} ha sido enviada para revisión.` });
        } catch (error: any) {
            logError(`Failed to request ${action}`, { error: error.message });
            toast({ title: "Error al Solicitar", description: `No se pudo enviar la solicitud. ${error.message}`, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleAdminAction = async (approve: boolean) => {
        if (!state.requestToUpdate || !currentUser || !state.requestToUpdate.pendingAction || state.requestToUpdate.pendingAction === 'none') return;
        updateState({ isSubmitting: true });

        try {
            if (approve) {
                const targetStatus = state.requestToUpdate.pendingAction === 'unapproval-request' ? 'pending' : 'canceled';
                await handleStatusUpdate(targetStatus);
            } else {
                 const updated = await updatePendingAction({
                    entityId: state.requestToUpdate.id,
                    action: 'none',
                    notes: state.statusUpdateNotes,
                    updatedBy: currentUser.name,
                });
                toast({ title: 'Solicitud Rechazada' });
                updateState({
                    activeRequests: state.activeRequests.map(r => r.id === updated.id ? updated : r)
                });
            }
            updateState({ isActionDialogOpen: false });
        } catch (error: any) {
            logError("Failed to handle admin action", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleStatusUpdate = async (statusOverride?: PurchaseRequestStatus) => {
        const finalStatus = statusOverride || state.newStatus;
        if (!state.requestToUpdate || !finalStatus || !currentUser) return;
        updateState({ isSubmitting: true });
        try {
            await updatePurchaseRequestStatus({ 
                requestId: state.requestToUpdate.id, 
                status: finalStatus, 
                notes: state.statusUpdateNotes, 
                updatedBy: currentUser.name, 
                reopen: false, 
                deliveredQuantity: finalStatus === 'received' ? Number(state.deliveredQuantity) : undefined,
                arrivalDate: finalStatus === 'ordered' ? state.arrivalDate : undefined
            });
            toast({ title: "Estado Actualizado" });
            updateState({ isStatusDialogOpen: false, isActionDialogOpen: false });
            await loadInitialData(state.viewingArchived ? state.archivedPage : 0);
        } catch (error: any) {
            logError("Failed to update status", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
            await loadInitialData(state.viewingArchived ? state.archivedPage : 0);
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleOpenHistory = async (request: PurchaseRequest) => {
        updateState({ historyRequest: request, isHistoryDialogOpen: true, isHistoryLoading: true });
        try {
            updateState({ history: await getRequestHistory(request.id) });
        } catch (error: any) {
            logError("Failed to get history", {error: error.message});
            toast({ title: "Error", variant: "destructive" });
        } finally {
            updateState({ isHistoryLoading: false });
        }
    };
    
    const handleReopenRequest = async () => {
        if (!state.requestToUpdate || !currentUser || state.reopenStep !== 2 || state.reopenConfirmationText !== 'REABRIR') return;
        updateState({ isSubmitting: true });
        try {
            await updatePurchaseRequestStatus({ requestId: state.requestToUpdate.id, status: 'pending', notes: 'Solicitud reabierta.', updatedBy: currentUser.name, reopen: true });
            toast({ title: "Solicitud Reabierta" });
            updateState({ isReopenDialogOpen: false });
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to reopen request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
            await loadInitialData();
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleSelectItem = (value: string) => {
        updateState({ isItemSearchOpen: false });
        const product = authProducts.find(p => p.id === value);
        if (product) {
            const stock = authStockLevels.find(s => s.itemId === product.id)?.totalStock ?? 0;
            const dataToUpdate = { itemId: product.id, itemDescription: product.description || '', inventory: stock };
            if (state.requestToEdit) {
                 updateState({
                    requestToEdit: state.requestToEdit ? { ...state.requestToEdit, ...dataToUpdate } : null
                });
            } else {
                updateState({ newRequest: { ...state.newRequest, ...dataToUpdate }});
            }
            updateState({ itemSearchTerm: `[${product.id}] - ${product.description}` });
        } else {
             updateState({ itemSearchTerm: '' });
        }
    };

    const handleSelectClient = (value: string) => {
        updateState({ isClientSearchOpen: false });
        const client = authCustomers.find(c => c.id === value);
        if (client) {
            const dataToUpdate = { clientId: client.id, clientName: client.name, clientTaxId: client.taxId };
            if (state.requestToEdit) {
                 updateState({
                    requestToEdit: state.requestToEdit ? { ...state.requestToEdit, ...dataToUpdate } : null
                });
            } else {
                updateState({ newRequest: { ...state.newRequest, ...dataToUpdate }});
            }
            updateState({ clientSearchTerm: `[${client.id}] ${client.name} (${client.taxId})` });
        } else {
            updateState({ clientSearchTerm: '' });
        }
    };

    const handleFetchErpOrder = async () => {
        if (!state.erpOrderNumber) return;
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        updateState({ isErpLoading: true });
        try {
            const { headers, lines } = await getErpOrderData(state.erpOrderNumber, signal);

            if (signal.aborted) {
                console.log("Fetch ERP order aborted by user.");
                return;
            }

            if (headers.length === 1) {
                await processSingleErpOrder(headers[0], lines);
            } else if (headers.length > 1) {
                const enrichedHeaders = headers.map((h: any) => {
                    const client = authCustomers.find(c => c.id === h.CLIENTE);
                    return { ...h, CLIENTE_NOMBRE: client?.name || 'Cliente no encontrado' };
                });
                updateState({ erpOrderHeaders: enrichedHeaders });
            } else {
                 toast({ title: "Pedido no encontrado", description: `No se encontró ningún pedido con el número: ${state.erpOrderNumber}`, variant: "destructive" });
            }
            
        } catch (error: any) {
             if (error.name === 'AbortError') {
                toast({ title: "Búsqueda Cancelada", description: "La búsqueda del pedido ERP fue cancelada.", variant: "default" });
            } else {
                logError('Failed to fetch ERP order data', { error: error.message, orderNumber: state.erpOrderNumber });
                toast({ title: "Error al Cargar Pedido", description: error.message, variant: "destructive" });
            }
        } finally {
            if (!signal.aborted) {
                updateState({ isErpLoading: false });
            }
        }
    };

    const handleCancelErpFetch = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        updateState({
            isErpLoading: false,
            isErpOrderModalOpen: false,
            erpOrderHeaders: [],
            erpOrderNumber: ''
        });
    };
    
    const processSingleErpOrder = async (header: any, lines: any[]) => {
        const client = authCustomers.find(c => c.id === header.CLIENTE);
        const enrichedHeader = { ...header, CLIENTE_NOMBRE: client?.name || 'Cliente no encontrado' };
        
        const enrichedLines = lines.map(line => {
            const product = authProducts.find(p => p.id === line.ARTICULO) || {id: line.ARTICULO, description: `Artículo ${line.ARTICULO} no encontrado`, active: 'N', cabys: '', classification: '', isBasicGood: 'N', lastEntry: '', notes: '', unit: ''};
            const stock = authStockLevels.find(s => s.itemId === line.ARTICULO) || null;
            const needsBuying = stock ? line.CANTIDAD_PEDIDA > stock.totalStock : true;
            return {
                ...line,
                product,
                stock,
                selected: needsBuying,
                displayQuantity: String(line.CANTIDAD_PEDIDA),
                displayPrice: String(line.PRECIO_UNITARIO),
            };
        }).sort((a, b) => (a.selected === b.selected) ? 0 : a.selected ? -1 : 1);

        updateState({
            selectedErpOrderHeader: enrichedHeader,
            erpOrderLines: enrichedLines,
            isErpOrderModalOpen: false,
            isErpItemsModalOpen: true,
        });
    };

    const handleSelectErpOrderHeader = async (header: any) => {
        updateState({ isErpLoading: true, isErpOrderModalOpen: false });
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        try {
            const { lines } = await getErpOrderData(header.PEDIDO, signal);
             if (signal.aborted) return;
            await processSingleErpOrder(header, lines);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
             logError('Failed to fetch lines for selected ERP order', { error: error.message, orderNumber: header.PEDIDO });
            toast({ title: "Error al Cargar Líneas", description: error.message, variant: "destructive" });
        } finally {
             updateState({ isErpLoading: false });
        }
    };


    const handleErpLineChange = (lineIndex: number, field: keyof ErpOrderLine, value: string | boolean) => {
        if (lineIndex === -1) { // Select/Deselect all
             updateState({ erpOrderLines: state.erpOrderLines.map(line => ({ ...line, selected: !!value })) });
        } else {
            updateState({
                erpOrderLines: state.erpOrderLines.map((line, index) => 
                    index === lineIndex ? { ...line, [field]: value } : line
                )
            });
        }
    };

    const handleCreateRequestsFromErp = async () => {
        if (!state.selectedErpOrderHeader || !currentUser) return;
        const selectedLines = state.erpOrderLines.filter(line => line.selected);
        if (selectedLines.length === 0) {
            toast({ title: "No hay artículos seleccionados", description: "Marque al menos un artículo para crear solicitudes.", variant: "destructive" });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            for (const line of selectedLines) {
                const requestPayload = {
                    requiredDate: new Date(state.selectedErpOrderHeader.FECHA_PROMETIDA).toISOString().split('T')[0],
                    clientId: state.selectedErpOrderHeader.CLIENTE,
                    clientName: state.selectedErpOrderHeader.CLIENTE_NOMBRE,
                    clientTaxId: authCustomers.find(c => c.id === state.selectedErpOrderHeader.CLIENTE)?.taxId || '',
                    itemId: line.ARTICULO,
                    itemDescription: line.product.description,
                    quantity: parseFloat(line.displayQuantity) || 0,
                    notes: `Generado desde Pedido ERP: ${state.erpOrderNumber}`,
                    unitSalePrice: parseFloat(line.displayPrice) || 0,
                    purchaseOrder: state.selectedErpOrderHeader.ORDEN_COMPRA || '',
                    erpOrderNumber: state.erpOrderNumber,
                    erpOrderLine: line.PEDIDO_LINEA,
                    priority: 'medium' as PurchaseRequestPriority,
                    purchaseType: 'single' as const,
                    route: '',
                    shippingMethod: '',
                    inventory: 0,
                    manualSupplier: '',
                    arrivalDate: '',
                    pendingAction: 'none' as const,
                };
                await savePurchaseRequest(requestPayload, currentUser.name);
            }
            toast({ title: "Solicitudes Creadas", description: `Se crearon ${selectedLines.length} solicitudes de compra.` });
            updateState({ isErpItemsModalOpen: false, erpOrderNumber: '' });
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to create requests from ERP order", { error: error.message });
            toast({ title: "Error al Crear Solicitudes", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleExportPDF = async (orientation: 'portrait' | 'landscape' = 'portrait') => {
        if (!state.companyData || !state.requestSettings) return;
        
        let logoDataUrl: string | null = null;
        if (state.companyData.logoUrl) {
            try {
                const response = await fetch(state.companyData.logoUrl);
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error("Error fetching and processing logo:", e);
                toast({ title: "Advertencia", description: "No se pudo cargar el logo, se generará el PDF sin él.", variant: "default" });
            }
        }
        
        const allPossibleColumns: { id: string, header: string, width?: number }[] = [
            { id: 'consecutive', header: 'Solicitud', width: 40 },
            { id: 'itemDescription', header: 'Artículo' },
            { id: 'clientName', header: 'Cliente' },
            { id: 'quantity', header: 'Cant.', width: 30 },
            { id: 'requiredDate', header: 'Fecha Req.', width: 50 },
            { id: 'status', header: 'Estado', width: 60 },
            { id: 'requestedBy', header: 'Solicitante', width: 60 },
            { id: 'purchaseOrder', header: 'OC Cliente', width: 60 },
            { id: 'manualSupplier', header: 'Proveedor', width: 70 },
        ];
    };

    const handleExportSingleRequestPDF = async (request: PurchaseRequest) => {
        if (!state.companyData || !state.requestSettings) return;

        let logoDataUrl: string | null = null;
        if (state.companyData.logoUrl) {
            try {
                const response = await fetch(state.companyData.logoUrl);
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch(e) { console.error("Error adding logo to PDF:", e) }
        }
        
        const historyData = await getRequestHistory(request.id);
        const details = [
                { title: 'Cliente:', content: request.clientName },
                { title: 'Artículo:', content: `[${request.itemId}] ${request.itemDescription}` },
                { title: 'Cantidad Solicitada:', content: request.quantity.toLocaleString('es-CR') },
                { title: 'Fecha Solicitud:', content: format(parseISO(request.requestDate), 'dd/MM/yyyy') },
                { title: 'Fecha Requerida:', content: format(parseISO(request.requiredDate), 'dd/MM/yyyy') },
                { title: 'Estado:', content: statusConfig[request.status]?.label || request.status },
                { title: 'Prioridad:', content: priorityConfig[request.priority]?.label || request.priority },
                { title: 'Ruta:', content: request.route || 'N/A' },
                { title: 'Método Envío:', content: request.shippingMethod || 'N/A' },
                { title: 'Proveedor:', content: request.manualSupplier || 'N/A' },
                { title: 'Notas:', content: request.notes || 'N/A' },
                { title: 'Solicitado por:', content: request.requestedBy },
                { title: 'Aprobado por:', content: request.approvedBy || 'N/A' },
                { title: 'Última actualización:', content: `${request.lastStatusUpdateBy || 'N/A'} - ${request.lastStatusUpdateNotes || ''}` }
            ];

        generateDocument({
            docTitle: 'Solicitud de Compra',
            docId: request.consecutive,
            companyData: state.companyData,
            logoDataUrl,
            meta: [{ label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') }],
            blocks: [
                { title: "Detalles de la Solicitud", content: details.map(d => `${d.title} ${d.content}`).join('\n') },
            ],
            table: {
                columns: ["Fecha", "Estado", "Usuario", "Notas"],
                rows: historyData.map(entry => [
                    format(parseISO(entry.timestamp), 'dd/MM/yy HH:mm'),
                    statusConfig[entry.status]?.label || entry.status,
                    entry.updatedBy,
                    entry.notes || ''
                ]),
                columnStyles: {},
            },
            totals: []
        }).save(`sc_${request.consecutive}.pdf`);
    };

    const actions = {
        loadInitialData,
        handleCreateRequest,
        handleEditRequest,
        openStatusDialog,
        handleStatusUpdate,
        handleOpenHistory,
        handleReopenRequest,
        handleSelectClient,
        handleSelectItem,
        handleExportPDF,
        handleExportSingleRequestPDF,
        openAdminActionDialog,
        handleAdminAction,
        handleFetchErpOrder,
        handleErpLineChange,
        handleCreateRequestsFromErp,
        handleSelectErpOrderHeader,
        handleCancelErpFetch,
        setNewRequestDialogOpen: (isOpen: boolean) => updateState({ isNewRequestDialogOpen: isOpen, newRequest: emptyRequest, clientSearchTerm: '', itemSearchTerm: '' }),
        setEditRequestDialogOpen: (isOpen: boolean) => updateState({ isEditRequestDialogOpen: isOpen }),
        setViewingArchived: (isArchived: boolean) => updateState({ viewingArchived: isArchived, archivedPage: 0 }),
        setArchivedPage: (updater: (prev: number) => number) => updateState({ archivedPage: updater(state.archivedPage) }),
        setPageSize: (size: number) => updateState({ pageSize: size, archivedPage: 0 }),
        setNewRequest: (updater: (prev: State['newRequest']) => State['newRequest']) => updateState({ newRequest: updater(state.newRequest) }),
        setRequestToEdit: (request: PurchaseRequest | null) => updateState({ requestToEdit: request }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setStatusFilter: (filter: string) => updateState({ statusFilter: filter }),
        setClassificationFilter: (filter: string) => updateState({ classificationFilter: filter }),
        setDateFilter: (range: DateRange | undefined) => updateState({ dateFilter: range }),
        setShowOnlyMyRequests: (show: boolean) => updateState({ showOnlyMyRequests: show }),
        setClientSearchTerm: (term: string) => updateState({ clientSearchTerm: term }),
        setClientSearchOpen: (isOpen: boolean) => updateState({ isClientSearchOpen: isOpen }),
        setItemSearchTerm: (term: string) => updateState({ itemSearchTerm: term }),
        setItemSearchOpen: (isOpen: boolean) => updateState({ isItemSearchOpen: isOpen }),
        setStatusDialogOpen: (isOpen: boolean) => updateState({ isStatusDialogOpen: isOpen }),
        setRequestToUpdate: (request: PurchaseRequest | null) => updateState({ requestToUpdate: request }),
        setNewStatus: (status: PurchaseRequestStatus | null) => updateState({ newStatus: status }),
        setStatusUpdateNotes: (notes: string) => updateState({ statusUpdateNotes: notes }),
        setDeliveredQuantity: (qty: number | string) => updateState({ deliveredQuantity: qty }),
        setHistoryDialogOpen: (isOpen: boolean) => updateState({ isHistoryDialogOpen: isOpen }),
        setReopenDialogOpen: (isOpen: boolean) => updateState({ isReopenDialogOpen: isOpen }),
        setReopenStep: (step: number) => updateState({ reopenStep: step }),
        setReopenConfirmationText: (text: string) => updateState({ reopenConfirmationText: text }),
        setArrivalDate: (date: string) => updateState({ arrivalDate: date }),
        setActionDialogOpen: (isOpen: boolean) => updateState({ isActionDialogOpen: isOpen }),
        setErpOrderModalOpen: (isOpen: boolean) => updateState({ isErpOrderModalOpen: isOpen, erpOrderHeaders: [], erpOrderNumber: '' }),
        setErpItemsModalOpen: (isOpen: boolean) => updateState({ isErpItemsModalOpen: isOpen }),
        setErpOrderNumber: (num: string) => updateState({ erpOrderNumber: num }),
        setShowOnlyShortageItems: (show: boolean) => updateState({ showOnlyShortageItems: show }),
    };

    const selectors = {
        hasPermission,
        priorityConfig,
        statusConfig,
        getDaysRemaining: (dateStr: string) => getSimpleDaysRemaining(dateStr),
        clientOptions: useMemo(() => {
            if (debouncedClientSearch.length < 2) return [];
            const searchTerms = debouncedClientSearch.toLowerCase().split(' ').filter(Boolean);
            return authCustomers.filter(c => {
                const targetText = `${c.id} ${c.name} ${c.taxId}`.toLowerCase();
                return searchTerms.every(term => targetText.includes(term));
            }).map(c => ({ value: c.id, label: `[${c.id}] ${c.name} (${c.taxId})` }));
        }, [authCustomers, debouncedClientSearch]),
        itemOptions: useMemo(() => {
            if (debouncedItemSearch.length < 2) return [];
            const searchTerms = debouncedItemSearch.toLowerCase().split(' ').filter(Boolean);
            return authProducts.filter(p => {
                const targetText = `${p.id} ${p.description}`.toLowerCase();
                return searchTerms.every(term => targetText.includes(term));
            }).map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
        }, [authProducts, debouncedItemSearch]),
        classifications: useMemo(() => Array.from(new Set(authProducts.map(p => p.classification).filter(Boolean))), [authProducts]),
        filteredRequests: useMemo(() => {
            let requestsToFilter = state.viewingArchived ? state.archivedRequests : state.activeRequests;
            
            const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(Boolean);
            return requestsToFilter.filter(request => {
                const product = authProducts.find(p => p.id === request.itemId);
                const targetText = `${request.consecutive} ${request.clientName} ${request.itemDescription} ${request.purchaseOrder || ''} ${request.erpOrderNumber || ''}`.toLowerCase();
                
                const searchMatch = debouncedSearchTerm ? searchTerms.every(term => targetText.includes(term)) : true;
                const statusMatch = state.statusFilter === 'all' || request.status === state.statusFilter;
                const classificationMatch = state.classificationFilter === 'all' || (product && product.classification === state.classificationFilter);
                const dateMatch = !state.dateFilter || !state.dateFilter.from || (new Date(request.requiredDate) >= state.dateFilter.from && new Date(request.requiredDate) <= (state.dateFilter.to || state.dateFilter.from));
                const myRequestsMatch = !state.showOnlyMyRequests || request.requestedBy === currentUser?.name;
                
                return searchMatch && statusMatch && classificationMatch && dateMatch && myRequestsMatch;
            });
        }, [state.viewingArchived, state.activeRequests, state.archivedRequests, debouncedSearchTerm, state.statusFilter, state.classificationFilter, authProducts, state.dateFilter, state.showOnlyMyRequests, currentUser?.name]),
        stockLevels: authStockLevels,
        visibleErpOrderLines: useMemo(() => {
            if (!state.showOnlyShortageItems) {
                return state.erpOrderLines;
            }
            return state.erpOrderLines.filter(line => {
                const needsBuying = line.stock ? line.CANTIDAD_PEDIDA > line.stock.totalStock : true;
                return needsBuying;
            });
        }, [state.erpOrderLines, state.showOnlyShortageItems]),
    };

    return {
        state,
        actions,
        selectors,
        isLoading: state.isLoading,
        isAuthorized
    };
};

