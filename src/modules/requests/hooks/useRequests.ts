

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


```
  </change>
  <change>
    <file>/home/user/studio/src/app/dashboard/requests/page.tsx</file>
    <content><![CDATA[

'use client';

import React from 'react';
import { useRequests } from '@/modules/requests/hooks/useRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlusCircle, FilePlus, Loader2, Check, MoreVertical, History, RefreshCcw, AlertTriangle, Undo2, PackageCheck, Truck, XCircle, Home, Pencil, FilterX, CalendarIcon, Users, User as UserIcon, ChevronLeft, ChevronRight, Clock, FileDown, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { PurchaseRequest } from '@/modules/core/types';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight) {
        return <span>{text}</span>;
    }
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <span key={i} className="text-green-600 font-bold">
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </span>
    );
};


export default function PurchaseRequestPage() {
    const { state, actions, selectors, isLoading, isAuthorized } = useRequests();

    const {
        isSubmitting, isNewRequestDialogOpen, isEditRequestDialogOpen, viewingArchived,
        archivedPage, pageSize, totalArchived, requestSettings, newRequest, requestToEdit,
        searchTerm, statusFilter, classificationFilter, dateFilter, showOnlyMyRequests,
        clientSearchTerm, isClientSearchOpen, itemSearchTerm, isItemSearchOpen,
        isStatusDialogOpen, requestToUpdate, newStatus, statusUpdateNotes, deliveredQuantity,
        isHistoryDialogOpen, historyRequest, history, isHistoryLoading,
        isReopenDialogOpen, reopenStep, reopenConfirmationText, arrivalDate,
        isActionDialogOpen, isErpOrderModalOpen, isErpItemsModalOpen, erpOrderNumber, erpOrderHeaders, selectedErpOrderHeader, erpOrderLines, isErpLoading,
        showOnlyShortageItems
    } = state;


    if (isAuthorized === null || (isAuthorized && isLoading)) {
        return (
            <main className="flex-1 p-4 md:p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Solicitudes de Compra</h1>
                    <Button disabled><Loader2 className="mr-2 animate-spin" /> Cargando...</Button>
                </div>
                 <div className="space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </main>
        )
    }

    const renderRequestCard = (request: PurchaseRequest) => {
        const finalState = requestSettings?.useWarehouseReception ? 'received-in-warehouse' : 'received';
        const canBeReopened = selectors.hasPermission('requests:reopen') && (request.status === finalState || request.status === 'canceled');
        const canApprove = selectors.hasPermission('requests:status:approve') && request.status === 'pending';
        const canOrder = selectors.hasPermission('requests:status:ordered') && request.status === 'approved';
        const canRevertToApproved = selectors.hasPermission('requests:status:approve') && request.status === 'ordered';
        const canReceive = selectors.hasPermission('requests:status:received') && request.status === 'ordered';
        const canReceiveInWarehouse = selectors.hasPermission('requests:status:received') && request.status === 'received' && requestSettings?.useWarehouseReception;
        const canRequestCancel = selectors.hasPermission('requests:status:cancel') && ['pending', 'approved', 'ordered'].includes(request.status) && request.pendingAction === 'none';
        
        const canEditPending = selectors.hasPermission('requests:edit:pending') && request.status === 'pending';
        const canEditApproved = selectors.hasPermission('requests:edit:approved') && ['approved', 'ordered'].includes(request.status);
        const canEdit = canEditPending || canEditApproved;
        const daysRemaining = selectors.getDaysRemaining(request.requiredDate);
        
        return (
            <Card key={request.id} className="w-full">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <CardTitle className="text-lg">{request.consecutive} - [{request.itemId}] {request.itemDescription}</CardTitle>
                            <CardDescription>Cliente: {request.clientName}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            {!!request.reopened && <Badge variant="destructive"><RefreshCcw className="mr-1 h-3 w-3" /> Reabierta</Badge>}
                            {!!request.hasBeenModified && <Badge variant="destructive" className="animate-pulse"><AlertTriangle className="mr-1 h-3 w-3" /> Modificado</Badge>}
                             <Button variant="ghost" size="icon" onClick={() => actions.handleOpenHistory(request)}><History className="h-4 w-4" /></Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones de Solicitud</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {canEdit && <DropdownMenuItem onSelect={() => { actions.setRequestToEdit(request); actions.setEditRequestDialogOpen(true); }}><Pencil className="mr-2"/> Editar Solicitud</DropdownMenuItem>}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Cambio de Estado</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {canBeReopened && <DropdownMenuItem onSelect={() => { actions.setRequestToUpdate(request); actions.setReopenDialogOpen(true); }} className="text-orange-600"><Undo2 className="mr-2"/> Reabrir</DropdownMenuItem>}
                                    {canApprove && <DropdownMenuItem onSelect={() => actions.openStatusDialog(request, 'approved')} className="text-green-600"><Check className="mr-2"/> Aprobar</DropdownMenuItem>}
                                    {canRevertToApproved && <DropdownMenuItem onSelect={() => actions.openStatusDialog(request, 'approved')} className="text-orange-600"><Undo2 className="mr-2"/> Revertir a Aprobada</DropdownMenuItem>}
                                    {canOrder && <DropdownMenuItem onSelect={() => actions.openStatusDialog(request, 'ordered')} className="text-blue-600"><Truck className="mr-2"/> Marcar como Ordenada</DropdownMenuItem>}
                                    {canReceive && <DropdownMenuItem onSelect={() => actions.openStatusDialog(request, 'received')} className="text-indigo-600"><PackageCheck className="mr-2"/> Marcar como Recibida</DropdownMenuItem>}
                                    {canReceiveInWarehouse && <DropdownMenuItem onSelect={() => actions.openStatusDialog(request, 'received-in-warehouse')} className="text-gray-700"><Home className="mr-2"/> Recibir en Bodega</DropdownMenuItem>}
                                    <DropdownMenuSeparator />
                                    {canRequestCancel && <DropdownMenuItem onSelect={() => actions.openAdminActionDialog(request, 'cancellation-request')} className="text-red-600"><XCircle className="mr-2"/> Solicitar Cancelación</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6 text-sm">
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Estado Actual</p>
                            <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-full", selectors.statusConfig[request.status]?.color)}></span>
                                <span className="font-medium">{selectors.statusConfig[request.status]?.label || request.status}</span>
                            </div>
                        </div>
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Prioridad</p>
                            <span className={cn("font-medium", selectors.priorityConfig[request.priority]?.className)}>{selectors.priorityConfig[request.priority]?.label || request.priority}</span>
                        </div>
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha Requerida</p>
                            <div className="flex items-center gap-2">
                                <span>{format(parseISO(request.requiredDate), 'dd/MM/yyyy')}</span>
                                <span className={cn('text-xs font-semibold', daysRemaining.color)}>({daysRemaining.label})</span>
                            </div>
                        </div>
                        {request.arrivalDate && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Llegada Estimada</p><p>{format(parseISO(request.arrivalDate), 'dd/MM/yyyy')}</p></div>}
                        {request.receivedDate && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Fecha Recibida</p><p>{format(parseISO(request.receivedDate), 'dd/MM/yyyy HH:mm')}</p></div>}
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Cant. Solicitada</p>
                            <p className="font-bold text-lg">{request.quantity.toLocaleString()}</p>
                        </div>
                         {request.deliveredQuantity !== null && request.deliveredQuantity !== undefined && (
                            <><div className="space-y-1"><p className="font-semibold text-muted-foreground">Cant. Recibida</p><p className="font-bold text-lg text-green-600">{request.deliveredQuantity.toLocaleString()}</p></div>
                                 <div className="space-y-1"><p className="font-semibold text-muted-foreground">Diferencia</p><p className={cn("font-bold text-lg",(request.deliveredQuantity - request.quantity) > 0 && "text-blue-600",(request.deliveredQuantity - request.quantity) < 0 && "text-destructive")}>{(request.deliveredQuantity - request.quantity).toLocaleString()}</p></div></>
                         )}
                         <div className="space-y-1"><p className="font-semibold text-muted-foreground">Precio Venta (s/IVA)</p><p>{request.unitSalePrice ? `₡${request.unitSalePrice.toLocaleString()}` : 'N/A'}</p></div>
                        {request.purchaseOrder && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Nº OC Cliente</p><p>{request.purchaseOrder}</p></div>}
                        {request.manualSupplier && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Proveedor</p><p>{request.manualSupplier}</p></div>}
                        {request.erpOrderNumber && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Pedido ERP</p><p>{request.erpOrderNumber} (L{request.erpOrderLine})</p></div>}
                        {request.route && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Ruta de Entrega</p><p>{request.route}</p></div>}
                         {request.shippingMethod && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Método de Envío</p><p>{request.shippingMethod}</p></div>}
                        <div className="space-y-1"><p className="font-semibold text-muted-foreground">Tipo de Compra</p><div className="flex items-center gap-2">{request.purchaseType === 'multiple' ? <Users className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}<span>{request.purchaseType === 'multiple' ? 'Múltiples Proveedores' : 'Proveedor Único'}</span></div></div>
                    </div>
                    {request.pendingAction !== 'none' && (
                        <div className="mt-4">
                            <AlertDialog open={isActionDialogOpen && requestToUpdate?.id === request.id} onOpenChange={(open) => { if (!open) actions.setActionDialogOpen(false); }}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 w-full" onClick={() => { actions.setRequestToUpdate(request); actions.setActionDialogOpen(true); }}>
                                        <AlertTriangle className="mr-2 h-4 w-4 animate-pulse" />
                                        Solicitud Pendiente: Cancelación
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Gestionar Solicitud de Cancelación</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta solicitud tiene una petición de cancelación pendiente. Puedes aprobar o rechazar esta acción.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="py-4 space-y-2">
                                        <Label htmlFor="admin-action-notes-req">Notas (Requerido)</Label>
                                        <Textarea id="admin-action-notes-req" value={statusUpdateNotes} onChange={e => actions.setStatusUpdateNotes(e.target.value)} placeholder="Motivo de la aprobación o rechazo..." />
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                        <Button variant="secondary" onClick={() => actions.handleAdminAction(false)} disabled={!statusUpdateNotes.trim() || isSubmitting}>Rechazar Solicitud</Button>
                                        <Button onClick={() => actions.handleAdminAction(true)} className='bg-destructive hover:bg-destructive/90' disabled={!statusUpdateNotes.trim() || isSubmitting}>Aprobar Cancelación</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                     {request.notes && (<div className="mt-4 text-xs bg-muted p-2 rounded-md"><p className="font-semibold">Notas de la Solicitud:</p><p className="text-muted-foreground">&quot;{request.notes}&quot;</p></div>)}
                     {request.lastStatusUpdateNotes && (<div className="mt-2 text-xs bg-muted p-2 rounded-md"><p className="font-semibold">Última nota de estado:</p><p className="text-muted-foreground">&quot;{request.lastStatusUpdateNotes}&quot; - <span className="italic">{request.lastStatusUpdateBy}</span></p></div>)}
                     {request.hasBeenModified && request.lastModifiedBy && (<div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded-md"><p className="font-semibold">Última Modificación por:</p><p className="">{request.lastModifiedBy} el {format(parseISO(request.lastModifiedAt as string), "dd/MM/yy 'a las' HH:mm")}</p></div>)}
                </CardContent>
                <CardFooter className="p-4 pt-0 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
                    <span>Solicitado por: {request.requestedBy} el {format(parseISO(request.requestDate), 'dd/MM/yyyy')}</span>
                    {request.approvedBy && <span>Aprobado por: {request.approvedBy}</span>}
                </CardFooter>
            </Card>
        );
    }

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-lg font-semibold md:text-2xl">Solicitudes de Compra</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                     <Button variant="outline" onClick={() => actions.loadInitialData()} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}Refrescar</Button>
                     <div className="flex items-center gap-1">
                        <Button variant={viewingArchived ? "outline" : "secondary"} onClick={() => actions.setViewingArchived(false)}>Activas</Button>
                        <Button variant={viewingArchived ? "secondary" : "outline"} onClick={() => actions.setViewingArchived(true)}>Archivadas</Button>
                     </div>
                      <Dialog open={isErpOrderModalOpen} onOpenChange={actions.setErpOrderModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary"><Layers className="mr-2"/>Crear desde Pedido ERP</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Buscar Pedido en ERP</DialogTitle><DialogDescription>Ingresa el número de pedido del ERP para cargar sus artículos.</DialogDescription></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Label htmlFor="erp-order-number">Nº de Pedido ERP</Label>
                                <Input id="erp-order-number" value={erpOrderNumber} onChange={e => actions.setErpOrderNumber(e.target.value)} onKeyDown={e => e.key === 'Enter' && actions.handleFetchErpOrder()} placeholder="Ej: PE0000123456" />
                            </div>
                            {isErpLoading && <div className="flex justify-center"><Loader2 className="animate-spin" /></div>}
                            {erpOrderHeaders.length > 0 && !isErpLoading && (
                                <div className="space-y-2">
                                    <p className="font-semibold">Múltiples pedidos encontrados. Por favor, selecciona uno:</p>
                                    <ScrollArea className="h-60">
                                        <div className="space-y-2 pr-4">
                                            {erpOrderHeaders.map((header: any) => (
                                                <Card key={header.PEDIDO} className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSelectErpOrderHeader(header)}>
                                                    <CardContent className="p-3">
                                                        <p className="font-bold"><HighlightedText text={header.PEDIDO} highlight={erpOrderNumber} /></p>
                                                        <p className="text-sm">{header.CLIENTE_NOMBRE}</p>
                                                        <p className="text-xs text-muted-foreground">Fecha: {format(new Date(header.FECHA_PEDIDO), 'dd/MM/yyyy')}</p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => actions.handleCancelErpFetch()}>Cancelar</Button>
                                <Button onClick={actions.handleFetchErpOrder} disabled={isErpLoading || !erpOrderNumber}>{isErpLoading && <Loader2 className="mr-2 animate-spin"/>}Cargar Pedido</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                     {selectors.hasPermission('requests:create') && (
                        <Dialog open={isNewRequestDialogOpen} onOpenChange={actions.setNewRequestDialogOpen}>
                            <DialogTrigger asChild><Button><FilePlus className="mr-2"/> Nueva Solicitud</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateRequest(); }}>
                                    <DialogHeader><DialogTitle>Crear Nueva Solicitud de Compra</DialogTitle><DialogDescription>Complete los detalles para crear una nueva solicitud.</DialogDescription></DialogHeader>
                                    <ScrollArea className="h-[60vh] md:h-auto"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4"><div className="space-y-2"><Label htmlFor="client-search">Cliente</Label><SearchInput options={selectors.clientOptions} onSelect={(value) => actions.handleSelectClient(value)} value={clientSearchTerm} onValueChange={(val) => { actions.setClientSearchTerm(val); if(!val) actions.handleSelectClient(''); }} placeholder="Buscar cliente..." open={isClientSearchOpen} onOpenChange={actions.setClientSearchOpen} /></div><div className="space-y-2"><Label htmlFor="item-search">Artículo / Servicio</Label><SearchInput options={selectors.itemOptions} onSelect={(value) => actions.handleSelectItem(value)} value={itemSearchTerm} onValueChange={(val) => { actions.setItemSearchTerm(val); if(!val) actions.handleSelectItem(''); }} placeholder="Buscar artículo..." open={isItemSearchOpen} onOpenChange={actions.setItemSearchOpen} /></div><div className="space-y-2"><Label htmlFor="new-request-po">Nº Orden de Compra Cliente</Label><Input id="new-request-po" value={newRequest.purchaseOrder || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, purchaseOrder: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="new-request-quantity">Cantidad</Label><Input id="new-request-quantity" type="number" placeholder="0.00" value={newRequest.quantity || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, quantity: Number(e.target.value) }))} required /></div><div className="space-y-2"><Label htmlFor="new-request-unit-sale-price">Precio de Venta Unitario (sin IVA)</Label><Input id="new-request-unit-sale-price" type="number" placeholder="0.00" value={newRequest.unitSalePrice || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, unitSalePrice: Number(e.target.value) }))} /></div><div className="space-y-2"><Label htmlFor="new-request-required-date">Fecha Requerida</Label><Input id="new-request-required-date" type="date" value={newRequest.requiredDate} onChange={e => actions.setNewRequest(prev => ({ ...prev, requiredDate: e.target.value }))} required /></div><div className="space-y-2"><Label htmlFor="new-request-supplier">Proveedor (Manual)</Label><Input id="new-request-supplier" value={newRequest.manualSupplier || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, manualSupplier: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="new-request-erp">Número de Pedido ERP</Label><Input id="new-request-erp" value={newRequest.erpOrderNumber || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, erpOrderNumber: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="new-request-inventory-manual">Inventario Actual (Manual)</Label><Input id="new-request-inventory-manual" type="number" placeholder="0.00" value={newRequest.inventory || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, inventory: Number(e.target.value) }))} /></div><div className="space-y-2"><Label htmlFor="new-request-inventory-erp">Inventario Actual (ERP)</Label><Input id="new-request-inventory-erp" value={(selectors.stockLevels.find(s => s.itemId === newRequest.itemId)?.totalStock ?? 0).toLocaleString()} disabled /></div><div className="space-y-2"><Label htmlFor="new-request-route">Ruta</Label><Select value={newRequest.route} onValueChange={(value) => actions.setNewRequest(prev => ({...prev, route: value}))}><SelectTrigger id="new-request-route"><SelectValue placeholder="Seleccione una ruta" /></SelectTrigger><SelectContent>{requestSettings?.routes.map(route => (<SelectItem key={route} value={route}>{route}</SelectItem>))}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="new-request-shipping-method">Método de Envío</Label><Select value={newRequest.shippingMethod} onValueChange={(value) => actions.setNewRequest(prev => ({...prev, shippingMethod: value}))}><SelectTrigger id="new-request-shipping-method"><SelectValue placeholder="Seleccione un método" /></SelectTrigger><SelectContent>{requestSettings?.shippingMethods.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="new-request-priority">Prioridad</Label><Select value={newRequest.priority} onValueChange={(value: typeof newRequest.priority) => actions.setNewRequest(prev => ({...prev, priority: value}))}><SelectTrigger id="new-request-priority"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(selectors.priorityConfig).map(([key, {label}]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tipo de Compra</Label><RadioGroup value={newRequest.purchaseType} onValueChange={(value: 'single' | 'multiple') => actions.setNewRequest(prev => ({ ...prev, purchaseType: value }))} className="flex items-center gap-4 pt-2"><div className="flex items-center space-x-2"><RadioGroupItem value="single" id="r-single" /><Label htmlFor="r-single">Proveedor Único</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id="r-multiple" /><Label htmlFor="r-multiple">Múltiples Proveedores</Label></div></RadioGroup></div><div className="space-y-2 col-span-1 md:col-span-2"><Label htmlFor="new-request-notes">Notas Adicionales</Label><Textarea id="new-request-notes" placeholder="Justificación, detalles del proveedor, etc." value={newRequest.notes || ''} onChange={e => actions.setNewRequest(prev => ({ ...prev, notes: e.target.value }))} /></div></div></ScrollArea><DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Crear Solicitud</Button></DialogFooter></form>
                            </DialogContent>
                        </Dialog>
                     )}
                </div>
            </div>
            <Card>
                 <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input placeholder="Buscar por Nº solicitud, cliente, producto o pedido ERP..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="max-w-sm" />
                        <Select value={statusFilter} onValueChange={actions.setStatusFilter}><SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem>{Object.entries(selectors.statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select>
                         <Select value={classificationFilter} onValueChange={actions.setClassificationFilter}><SelectTrigger className="w-full md:w-[240px]"><SelectValue placeholder="Filtrar por clasificación..." /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Clasificaciones</SelectItem>{selectors.classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                         <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full md:w-[240px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateFilter?.from ? (dateFilter.to ? (`${format(dateFilter.from, "LLL dd, y")} - ${format(dateFilter.to, "LLL dd, y")}`) : (format(dateFilter.from, "LLL dd, y"))) : (<span>Filtrar por fecha</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateFilter} onSelect={actions.setDateFilter} /></PopoverContent></Popover>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline"><FileDown className="mr-2 h-4 w-4"/>Exportar PDF</Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => actions.handleExportPDF('portrait')}>Exportar Vertical</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => actions.handleExportPDF('landscape')}>Exportar Horizontal</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" onClick={() => { actions.setSearchTerm(''); actions.setStatusFilter('all'); actions.setClassificationFilter('all'); actions.setDateFilter(undefined); actions.setShowOnlyMyRequests(false); }}><FilterX className="mr-2 h-4 w-4" />Limpiar</Button>
                    </div>
                     <div className="flex flex-wrap items-center gap-4">
                        {viewingArchived && (<div className="flex items-center gap-2"><Label htmlFor="page-size">Registros por página:</Label><Select value={String(pageSize)} onValueChange={(value) => actions.setPageSize(Number(value))}><SelectTrigger id="page-size" className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem></SelectContent></Select></div>)}
                         <div className="flex items-center space-x-2">
                            <Checkbox id="show-only-my-requests" checked={showOnlyMyRequests} onCheckedChange={(checked) => actions.setShowOnlyMyRequests(checked as boolean)} />
                            <Label htmlFor="show-only-my-requests" className="font-normal">Mostrar solo mis solicitudes</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="space-y-4">
                {isLoading ? (<div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>) : selectors.filteredRequests.length > 0 ? (selectors.filteredRequests.map(renderRequestCard)) : (<div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24"><div className="flex flex-col items-center gap-2 text-center"><h3 className="text-2xl font-bold tracking-tight">No se encontraron solicitudes.</h3><p className="text-sm text-muted-foreground">Intenta ajustar los filtros de búsqueda o crea una nueva solicitud.</p></div></div>)}
            </div>
             {viewingArchived && totalArchived > pageSize && (<div className="flex items-center justify-center space-x-2 py-4"><Button variant="outline" size="sm" onClick={() => actions.setArchivedPage(p => p - 1)} disabled={archivedPage === 0}><ChevronLeft className="mr-2 h-4 w-4" />Anterior</Button><span className="text-sm text-muted-foreground">Página {archivedPage + 1} de {Math.ceil(totalArchived / pageSize)}</span><Button variant="outline" size="sm" onClick={() => actions.setArchivedPage(p => p + 1)} disabled={(archivedPage + 1) * pageSize >= totalArchived}>Siguiente<ChevronRight className="ml-2 h-4 w-4" /></Button></div>)}
            <Dialog open={isEditRequestDialogOpen} onOpenChange={actions.setEditRequestDialogOpen}><DialogContent className="sm:max-w-3xl"><form onSubmit={actions.handleEditRequest}><DialogHeader><DialogTitle>Editar Solicitud - {requestToEdit?.consecutive}</DialogTitle><DialogDescription>Modifique los detalles de la solicitud.</DialogDescription></DialogHeader><ScrollArea className="h-[60vh] md:h-auto"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4"><div className="space-y-2"><Label>Cliente</Label><Input value={requestToEdit?.clientName} disabled /></div><div className="space-y-2"><Label>Artículo / Servicio</Label><Input value={`[${requestToEdit?.itemId}] ${requestToEdit?.itemDescription}`} disabled /></div><div className="space-y-2"><Label htmlFor="edit-request-quantity">Cantidad</Label><Input id="edit-request-quantity" type="number" value={requestToEdit?.quantity || ''} onChange={e => { if (requestToEdit) actions.setRequestToEdit({ ...requestToEdit, quantity: Number(e.target.value) }); }} required /></div><div className="space-y-2"><Label htmlFor="edit-request-required-date">Fecha Requerida</Label><Input id="edit-request-required-date" type="date" value={requestToEdit?.requiredDate ? format(parseISO(requestToEdit.requiredDate), 'yyyy-MM-dd') : ''} onChange={e => { if (requestToEdit) actions.setRequestToEdit({ ...requestToEdit, requiredDate: e.target.value }); }} required /></div><div className="space-y-2"><Label htmlFor="edit-request-priority">Prioridad</Label><Select value={requestToEdit?.priority} onValueChange={(value: typeof newRequest.priority) => { if (requestToEdit) actions.setRequestToEdit({ ...requestToEdit, priority: value }); }}><SelectTrigger id="edit-request-priority"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(selectors.priorityConfig).map(([key, {label}]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tipo de Compra</Label><RadioGroup value={requestToEdit?.purchaseType} onValueChange={(value: 'single' | 'multiple') => { if (requestToEdit) actions.setRequestToEdit({ ...requestToEdit, purchaseType: value }); }} className="flex items-center gap-4 pt-2"><div className="flex items-center space-x-2"><RadioGroupItem value="single" id="r-edit-single" /><Label htmlFor="r-edit-single">Proveedor Único</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id="r-edit-multiple" /><Label htmlFor="r-edit-multiple">Múltiples Proveedores</Label></div></RadioGroup></div><div className="space-y-2 col-span-1 md:col-span-2"><Label htmlFor="edit-request-notes">Notas</Label><Textarea id="edit-request-notes" value={requestToEdit?.notes || ''} onChange={e => { if (requestToEdit) actions.setRequestToEdit({ ...requestToEdit, notes: e.target.value }); }} /></div></div></ScrollArea><DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Guardar Cambios</Button></DialogFooter></form></DialogContent></Dialog>
            <Dialog open={isStatusDialogOpen} onOpenChange={actions.setStatusDialogOpen}><DialogContent><DialogHeader><DialogTitle>Actualizar Estado de la Solicitud</DialogTitle><DialogDescription>Estás a punto de cambiar el estado de la solicitud {requestToUpdate?.consecutive} a &quot;{newStatus ? selectors.statusConfig[newStatus].label : ''}&quot;.</DialogDescription></DialogHeader><div className="space-y-4 py-4">{newStatus === 'received' && (<div className="space-y-2"><Label htmlFor="status-delivered-quantity">Cantidad Recibida</Label><Input id="status-delivered-quantity" type="number" value={deliveredQuantity} onChange={(e) => actions.setDeliveredQuantity(e.target.value)} placeholder={`Cantidad solicitada: ${requestToUpdate?.quantity.toLocaleString()}`} /> <p className="text-xs text-muted-foreground">Introduce la cantidad final que se recibió del proveedor.</p></div>)} {newStatus === 'ordered' && (<div className="space-y-2"><Label htmlFor="status-arrival-date">Fecha Estimada de Llegada</Label><Input id="status-arrival-date" type="date" value={arrivalDate} onChange={(e) => actions.setArrivalDate(e.target.value)} /><p className="text-xs text-muted-foreground">Opcional: Fecha en que se espera recibir el producto.</p></div>)}<div className="space-y-2"><Label htmlFor="status-notes">Notas (Opcional)</Label><Textarea id="status-notes" value={statusUpdateNotes} onChange={(e) => actions.setStatusUpdateNotes(e.target.value)} placeholder="Ej: Aprobado por Gerencia, Orden de compra #1234" /></div></div><DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={() => actions.handleStatusUpdate()} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Actualizar Estado</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={isReopenDialogOpen} onOpenChange={(isOpen) => { actions.setReopenDialogOpen(isOpen); if (!isOpen) { actions.setReopenStep(0); actions.setReopenConfirmationText(''); }}}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Reabrir Solicitud Finalizada</DialogTitle><DialogDescription>Estás a punto de reabrir la solicitud {requestToUpdate?.consecutive}. Esta acción es irreversible y moverá la solicitud de nuevo a &quot;Pendiente&quot;.</DialogDescription></DialogHeader><div className="py-4 space-y-4"><div className="flex items-center space-x-2"><Checkbox id="reopen-confirm-checkbox" onCheckedChange={(checked) => actions.setReopenStep(checked ? 1 : 0)} /><Label htmlFor="reopen-confirm-checkbox" className="font-medium text-destructive">Entiendo que esta acción no se puede deshacer.</Label></div>{reopenStep > 0 && (<div className="space-y-2"><Label htmlFor="reopen-confirmation-text">Para confirmar, escribe &quot;REABRIR&quot; en el campo de abajo:</Label><Input id="reopen-confirmation-text" value={reopenConfirmationText} onChange={(e) => { actions.setReopenConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'REABRIR') {actions.setReopenStep(2);} else {actions.setReopenStep(1);}}} className="border-destructive focus-visible:ring-destructive" /></div>)}</div><DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={actions.handleReopenRequest} disabled={reopenStep !== 2 || reopenConfirmationText !== 'REABRIR' || isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Reabrir Solicitud</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={isHistoryDialogOpen} onOpenChange={actions.setHistoryDialogOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Historial de Cambios - Solicitud {historyRequest?.consecutive}</DialogTitle><DialogDescription>Registro de todos los cambios de estado para esta solicitud.</DialogDescription></DialogHeader><div className="py-4">{isHistoryLoading ? (<div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>) : history.length > 0 ? (<div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Fecha y Hora</TableHead><TableHead>Estado</TableHead><TableHead>Usuario</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader><TableBody>{history.map(entry => (<TableRow key={entry.id}><TableCell>{format(parseISO(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell><TableCell><Badge style={{backgroundColor: selectors.statusConfig[entry.status]?.color}} className="text-white">{selectors.statusConfig[entry.status]?.label || entry.status}</Badge></TableCell><TableCell>{entry.updatedBy}</TableCell><TableCell>{entry.notes || '-'}</TableCell></TableRow>))}</TableBody></Table></div>) : (<p className="text-center text-muted-foreground py-8">No hay historial de cambios para esta solicitud.</p>)}</div></DialogContent></Dialog>
            <Dialog open={isErpItemsModalOpen} onOpenChange={actions.setErpItemsModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Artículos del Pedido ERP: {erpOrderNumber}</DialogTitle>
                        <DialogDescription>Cliente: {selectedErpOrderHeader?.CLIENTE_NOMBRE}</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center space-x-2 my-4">
                        <Checkbox id="show-only-shortage" checked={showOnlyShortageItems} onCheckedChange={(checked) => actions.setShowOnlyShortageItems(checked as boolean)} />
                        <Label htmlFor="show-only-shortage" className="font-normal">Mostrar solo artículos con faltante</Label>
                    </div>
                    <ScrollArea className="max-h-[60vh]">
                        <Table>
                            <TableHeader><TableRow><TableHead className="w-10"><Checkbox onCheckedChange={(checked) => actions.handleErpLineChange(-1, 'selected', !!checked)}/></TableHead><TableHead>Artículo</TableHead><TableHead>Cant. Pedida</TableHead><TableHead>Inv. Actual</TableHead><TableHead>Cant. a Solicitar</TableHead><TableHead>Precio Venta</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {selectors.visibleErpOrderLines.map((line, index) => (
                                    <TableRow key={line.PEDIDO_LINEA} className={cn(!line.selected && 'text-muted-foreground', line.CANTIDAD_PEDIDA > (line.stock?.totalStock || 0) ? 'bg-red-50 hover:bg-red-100/60 dark:bg-red-900/20' : 'bg-green-50 hover:bg-green-100/60 dark:bg-green-900/20')}>
                                        <TableCell><Checkbox checked={line.selected} onCheckedChange={(checked) => actions.handleErpLineChange(index, 'selected', !!checked)} /></TableCell>
                                        <TableCell><p className="font-medium">{line.product.description}</p><p className="text-xs text-muted-foreground">{line.ARTICULO}</p></TableCell>
                                        <TableCell>{line.CANTIDAD_PEDIDA}</TableCell>
                                        <TableCell>{line.stock?.totalStock || 0}</TableCell>
                                        <TableCell><Input value={line.displayQuantity} onChange={e => actions.handleErpLineChange(index, 'displayQuantity', e.target.value)} className="w-24" /></TableCell>
                                        <TableCell><Input value={line.displayPrice} onChange={e => actions.handleErpLineChange(index, 'displayPrice', e.target.value)} className="w-28" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleCreateRequestsFromErp} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Crear Solicitudes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {(isSubmitting || isLoading) && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Procesando...</span>
                </div>
            )}
        </main>
    );
}

