/**
 * @fileoverview Custom hook `useRequests` for managing the state and logic of the Purchase Request page.
 * This hook encapsulates all state and actions for the module, keeping the UI component clean.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { 
    getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, 
    updatePurchaseRequestStatus, getRequestHistory, getRequestSettings, 
    updatePendingAction 
} from '@/modules/requests/lib/actions';
import type { 
    PurchaseRequest, PurchaseRequestStatus, PurchaseRequestPriority, 
    PurchaseRequestHistoryEntry, RequestSettings, Company, DateRange, 
    AdministrativeActionPayload 
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
    purchaseOrder: '',
    route: '',
    shippingMethod: '',
    inventory: 0,
    priority: 'medium',
    purchaseType: 'single',
    arrivalDate: '',
    pendingAction: 'none',
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


export const useRequests = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['requests:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, customers: authCustomers, products: authProducts, stockLevels: authStockLevels, companyData: authCompanyData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNewRequestDialogOpen, setNewRequestDialogOpen] = useState(false);
    const [isEditRequestDialogOpen, setEditRequestDialogOpen] = useState(false);
    const [activeRequests, setActiveRequests] = useState<PurchaseRequest[]>([]);
    const [archivedRequests, setArchivedRequests] = useState<PurchaseRequest[]>([]);
    const [viewingArchived, setViewingArchived] = useState(false);
    const [archivedPage, setArchivedPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalArchived, setTotalArchived] = useState(0);
    
    const [requestSettings, setRequestSettings] = useState<RequestSettings | null>(null);
    const [companyData, setCompanyData] = useState<Company | null>(authCompanyData);
    
    const [newRequest, setNewRequest] = useState(emptyRequest);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [classificationFilter, setClassificationFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined);
    const [debouncedSearchTerm] = useDebounce(searchTerm, companyData?.searchDebounceTime ?? 500);

    const [clientSearchTerm, setClientSearchTerm] = useState("");
    const [isClientSearchOpen, setClientSearchOpen] = useState(false);
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [isItemSearchOpen, setItemSearchOpen] = useState(false);
    const [debouncedClientSearch] = useDebounce(clientSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedItemSearch] = useDebounce(itemSearchTerm, companyData?.searchDebounceTime ?? 500);
    
    const [isStatusDialogOpen, setStatusDialogOpen] = useState(false);
    const [requestToUpdate, setRequestToUpdate] = useState<PurchaseRequest | null>(null);
    const [newStatus, setNewStatus] = useState<PurchaseRequestStatus | null>(null);
    const [statusUpdateNotes, setStatusUpdateNotes] = useState("");
    const [deliveredQuantity, setDeliveredQuantity] = useState<number | string>("");
    
    const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
    const [historyRequest, setHistoryRequest] = useState<PurchaseRequest | null>(null);
    const [history, setHistory] = useState<PurchaseRequestHistoryEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [isReopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [reopenStep, setReopenStep] = useState(0);
    const [reopenConfirmationText, setReopenConfirmationText] = useState('');
    const [arrivalDate, setArrivalDate] = useState('');
    
    const [isActionDialogOpen, setActionDialogOpen] = useState(false);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setNewRequest(prev => ({ ...prev, requiredDate: today }));
    }, []);


    const loadInitialData = useCallback(async (page = 0) => {
        let isMounted = true;
        setIsLoading(true);
        try {
             const [settingsData, requestsData] = await Promise.all([
                getRequestSettings(),
                getPurchaseRequests({
                    page: viewingArchived ? page : undefined,
                    pageSize: viewingArchived ? pageSize : undefined,
                })
            ]);
            
            if (!isMounted) return;

            setRequestSettings(settingsData);
            
            const useWarehouse = settingsData.useWarehouseReception;
            const activeFilter = (o: PurchaseRequest) => useWarehouse ? o.status !== 'received-in-warehouse' && o.status !== 'canceled' : o.status !== 'received' && o.status !== 'canceled';
            
            const allRequests = requestsData.requests;
            
            setActiveRequests(allRequests.filter(activeFilter));
            setArchivedRequests(allRequests.filter(req => !activeFilter(req)));
            setTotalArchived(requestsData.totalArchivedCount);

        } catch (error) {
             if (isMounted) {
                logError("Failed to load purchase requests data", { error: (error as Error).message });
                toast({ title: "Error", description: "No se pudieron cargar las solicitudes de compra.", variant: "destructive" });
            }
        } finally {
            if (isMounted) {
                setIsLoading(false);
            }
        }
         return () => { isMounted = false; };
    }, [toast, viewingArchived, pageSize]);
    
    useEffect(() => {
        setTitle("Solicitud de Compra");
        if (isAuthorized) {
            loadInitialData(archivedPage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);

     useEffect(() => {
        if (!isAuthorized || isLoading) return;
        let isMounted = true;
        const reload = async () => {
            await loadInitialData(archivedPage);
        };
        if(isMounted) {
            reload();
        }
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archivedPage, pageSize, viewingArchived, isAuthorized]);

    useEffect(() => {
        setCompanyData(authCompanyData);
    }, [authCompanyData]);

    const handleCreateRequest = async () => {
        if (!newRequest.clientId || !newRequest.itemId || !newRequest.quantity || !newRequest.requiredDate || !currentUser) return;
        
        const requestWithFormattedDate = {
            ...newRequest,
            requiredDate: new Date(newRequest.requiredDate).toISOString().split('T')[0]
        };

        setIsSubmitting(true);
        try {
            const createdRequest = await savePurchaseRequest(requestWithFormattedDate, currentUser.name);
            toast({ title: "Solicitud Creada" });
            setNewRequestDialogOpen(false);
            setNewRequest(emptyRequest);
            setActiveRequests(prev => [createdRequest, ...prev]);
        } catch (error: any) {
            logError("Failed to create request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestToEdit || !currentUser) return;
        setIsSubmitting(true);
        try {
            const updated = await updatePurchaseRequest({ requestId: requestToEdit.id, updatedBy: currentUser.name, ...requestToEdit });
            setActiveRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            setArchivedRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast({ title: "Solicitud Actualizada" });
            setEditRequestDialogOpen(false);
        } catch (error: any) {
            logError("Failed to edit request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openStatusDialog = (request: PurchaseRequest, status: PurchaseRequestStatus) => {
        setRequestToUpdate(request);
        setNewStatus(status);
        setStatusUpdateNotes(".");
        setDeliveredQuantity(status === 'received' ? request.quantity : "");
        setArrivalDate(''); 
        setStatusDialogOpen(true);
    };

    const openAdminActionDialog = async (request: PurchaseRequest, action: 'unapproval-request' | 'cancellation-request') => {
        if (!currentUser) return;
        setIsSubmitting(true);
        try {
            const payload: AdministrativeActionPayload = {
                entityId: request.id,
                action,
                notes: `Solicitud de ${action === 'unapproval-request' ? 'desaprobación' : 'cancelación'} iniciada.`,
                updatedBy: currentUser.name,
            };
            const updated = await updatePendingAction(payload);
            setActiveRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            setArchivedRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast({ title: "Solicitud Enviada", description: `Tu solicitud de ${action === 'unapproval-request' ? 'desaprobación' : 'cancelación'} ha sido enviada para revisión.` });
        } catch (error: any) {
            logError(`Failed to request ${action}`, { error: error.message });
            toast({ title: "Error al Solicitar", description: `No se pudo enviar la solicitud. ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdminAction = async (approve: boolean) => {
        if (!requestToUpdate || !currentUser || !requestToUpdate.pendingAction || requestToUpdate.pendingAction === 'none') return;
        setIsSubmitting(true);

        try {
            if (approve) {
                const targetStatus = requestToUpdate.pendingAction === 'unapproval-request' ? 'pending' : 'canceled';
                await handleStatusUpdate(targetStatus);
            } else {
                 const updated = await updatePendingAction({
                    entityId: requestToUpdate.id,
                    action: 'none',
                    notes: statusUpdateNotes,
                    updatedBy: currentUser.name,
                });
                toast({ title: 'Solicitud Rechazada' });
                setActiveRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
            }
            setActionDialogOpen(false);
        } catch (error: any) {
            logError("Failed to handle admin action", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleStatusUpdate = async (statusOverride?: PurchaseRequestStatus) => {
        const finalStatus = statusOverride || newStatus;
        if (!requestToUpdate || !finalStatus || !currentUser) return;
        setIsSubmitting(true);
        try {
            await updatePurchaseRequestStatus({ 
                requestId: requestToUpdate.id, 
                status: finalStatus, 
                notes: statusUpdateNotes, 
                updatedBy: currentUser.name, 
                reopen: false, 
                deliveredQuantity: finalStatus === 'received' ? Number(deliveredQuantity) : undefined,
                arrivalDate: finalStatus === 'ordered' ? arrivalDate : undefined
            });
            toast({ title: "Estado Actualizado" });
            setStatusDialogOpen(false);
            setActionDialogOpen(false);
            await loadInitialData(viewingArchived ? archivedPage : 0);
        } catch (error: any) {
            logError("Failed to update status", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
            await loadInitialData(viewingArchived ? archivedPage : 0);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleOpenHistory = async (request: PurchaseRequest) => {
        setHistoryRequest(request);
        setHistoryDialogOpen(true);
        setIsHistoryLoading(true);
        try {
            setHistory(await getRequestHistory(request.id));
        } catch (error: any) {
            logError("Failed to get history", {error: error.message});
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsHistoryLoading(false);
        }
    };
    
    const handleReopenRequest = async () => {
        if (!requestToUpdate || !currentUser || reopenStep !== 2 || reopenConfirmationText !== 'REABRIR') return;
        setIsSubmitting(true);
        try {
            await updatePurchaseRequestStatus({ requestId: requestToUpdate.id, status: 'pending', notes: 'Solicitud reabierta.', updatedBy: currentUser.name, reopen: true });
            toast({ title: "Solicitud Reabierta" });
            setReopenDialogOpen(false);
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to reopen request", { error: error.message });
            toast({ title: "Error", variant: "destructive" });
            await loadInitialData();
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSelectItem = (value: string) => {
        setItemSearchOpen(false);
        const product = authProducts.find(p => p.id === value);
        if (product) {
            const stock = authStockLevels.find(s => s.itemId === product.id)?.totalStock ?? 0;
            const dataToUpdate = { itemId: product.id, itemDescription: product.description || '', inventory: stock };
            if (requestToEdit) setRequestToEdit(p => p ? { ...p, ...dataToUpdate } : null);
            else setNewRequest(p => ({ ...p, ...dataToUpdate }));
            setItemSearchTerm(`[${product.id}] - ${product.description}`);
        }
    };

    const handleSelectClient = (value: string) => {
        setClientSearchOpen(false);
        const client = authCustomers.find(c => c.id === value);
        if (client) {
            const dataToUpdate = { clientId: client.id, clientName: client.name, clientTaxId: client.taxId };
            if (requestToEdit) setRequestToEdit(p => p ? { ...p, ...dataToUpdate } : null);
            else setNewRequest(p => ({ ...p, ...dataToUpdate }));
            setClientSearchTerm(`[${client.id}] ${client.name} (${client.taxId})`);
        }
    };

    const handleExportPDF = async (orientation: 'portrait' | 'landscape' = 'portrait') => {
        if (!companyData || !requestSettings) return;
        
        let logoDataUrl: string | null = null;
        if (companyData.logoUrl) {
            try {
                const response = await fetch(companyData.logoUrl);
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
    
        const doc = generateDocument({
            docTitle: `Solicitudes de Compra (${viewingArchived ? 'Archivadas' : 'Activas'})`,
            docId: '',
            companyData: companyData,
            logoDataUrl: logoDataUrl,
            meta: [{ label: 'Generado', value: format(new Date(), 'dd/MM/yyyy HH:mm') }],
            blocks: [],
            table: {
                columns: (requestSettings.pdfExportColumns || []).map(id => allPossibleColumns.find(c => c.id === id)?.header || id),
                rows: selectors.filteredRequests.map(request => {
                    return (requestSettings.pdfExportColumns || []).map(id => {
                         switch (id) {
                            case 'consecutive': return request.consecutive;
                            case 'itemDescription': return `[${request.itemId}] ${request.itemDescription}`;
                            case 'clientName': return request.clientName;
                            case 'quantity': return request.quantity.toLocaleString('es-CR');
                            case 'requiredDate': return format(parseISO(request.requiredDate), 'dd/MM/yy');
                            case 'status': return statusConfig[request.status]?.label || request.status;
                            case 'requestedBy': return request.requestedBy;
                            case 'purchaseOrder': return request.purchaseOrder || 'N/A';
                            case 'manualSupplier': return request.manualSupplier || 'N/A';
                            default: return '';
                        }
                    });
                }),
                columnStyles: (requestSettings.pdfExportColumns || []).reduce((acc, id, index) => {
                    const col = allPossibleColumns.find(c => c.id === id);
                    if (col?.width) {
                        acc[index] = { cellWidth: col.width };
                    }
                    if (id === 'quantity') {
                        acc[index] = { ...acc[index], halign: 'right' };
                    }
                    return acc;
                }, {} as { [key: number]: any })
            },
            totals: [],
            topLegend: requestSettings.pdfTopLegend,
            paperSize: requestSettings.pdfPaperSize,
            orientation: orientation,
        });
        
        doc.save(`solicitudes_compra_${new Date().getTime()}.pdf`);
    };

    const handleExportSingleRequestPDF = async (request: PurchaseRequest) => {
        if (!companyData || !requestSettings) return;

        let logoDataUrl: string | null = null;
        if (companyData.logoUrl) {
            try {
                const response = await fetch(companyData.logoUrl);
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

        const doc = generateDocument({
            docTitle: 'Solicitud de Compra',
            docId: request.consecutive,
            companyData,
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
        });

        doc.save(`sc_${request.consecutive}.pdf`);
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
            let requestsToFilter = viewingArchived ? archivedRequests : activeRequests;
            
            const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(Boolean);
            return requestsToFilter.filter(request => {
                const product = authProducts.find(p => p.id === request.itemId);
                const targetText = `${request.consecutive} ${request.clientName} ${request.itemDescription} ${request.purchaseOrder || ''}`.toLowerCase();
                const searchMatch = debouncedSearchTerm ? searchTerms.every(term => targetText.includes(term)) : true;
                
                const statusMatch = statusFilter === 'all' || request.status === statusFilter;
                const classificationMatch = classificationFilter === 'all' || (product && product.classification === classificationFilter);
                const dateMatch = !dateFilter || !dateFilter.from || (new Date(request.requiredDate) >= dateFilter.from && new Date(request.requiredDate) <= (dateFilter.to || dateFilter.from));
                
                return searchMatch && statusMatch && classificationMatch && dateMatch;
            });
        }, [viewingArchived, activeRequests, archivedRequests, debouncedSearchTerm, statusFilter, classificationFilter, authProducts, dateFilter]),
        stockLevels: authStockLevels
    };

    const actions = {
        setNewRequestDialogOpen, setEditRequestDialogOpen, setViewingArchived, setArchivedPage,
        setPageSize, setNewRequest, setRequestToEdit, setSearchTerm, setStatusFilter,
        setClassificationFilter, setDateFilter, setClientSearchTerm, setClientSearchOpen,
        setItemSearchTerm, setItemSearchOpen, setStatusDialogOpen, setNewStatus,
        setStatusUpdateNotes, setDeliveredQuantity, setHistoryDialogOpen,
        setReopenDialogOpen, setReopenStep, setReopenConfirmationText, loadInitialData,
        handleCreateRequest, handleEditRequest, openStatusDialog, handleStatusUpdate,
        handleOpenHistory, handleReopenRequest, handleSelectClient, handleSelectItem,
        setRequestToUpdate, handleExportPDF, handleExportSingleRequestPDF,
        setArrivalDate, openAdminActionDialog, handleAdminAction, setActionDialogOpen
    };

    return {
        state: {
            isLoading, isSubmitting, isNewRequestDialogOpen, isEditRequestDialogOpen, activeRequests,
            archivedRequests, viewingArchived, archivedPage, pageSize, totalArchived,
            requestSettings, newRequest, requestToEdit, searchTerm, statusFilter,
            classificationFilter, dateFilter, clientSearchTerm, isClientSearchOpen,
            itemSearchTerm, isItemSearchOpen, isStatusDialogOpen, requestToUpdate, newStatus,
            statusUpdateNotes, deliveredQuantity, isHistoryDialogOpen, historyRequest,
            history, isHistoryLoading, isReopenDialogOpen, reopenStep, reopenConfirmationText,
            companyData, arrivalDate, isActionDialogOpen,
        },
        actions,
        selectors,
        isLoading,
        isAuthorized
    };
};
