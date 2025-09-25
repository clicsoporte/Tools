

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, updatePurchaseRequestStatus, getRequestHistory, getRequestSettings, rejectCancellationRequest } from '@/modules/requests/lib/actions';
import type { Customer, Product, PurchaseRequest, PurchaseRequestStatus, PurchaseRequestPriority, PurchaseRequestHistoryEntry, User, RequestSettings, StockInfo, Company, DateRange, RejectCancellationPayload } from '../../core/types';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const emptyRequest: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus'> = {
    requiredDate: '',
    clientId: '',
    clientName: '',
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

    const loadInitialData = useCallback(async (page = 0) => {
        setIsLoading(true);
        try {
             const [settingsData, requestsData] = await Promise.all([
                getRequestSettings(),
                getPurchaseRequests({
                    page: viewingArchived ? page : undefined,
                    pageSize: viewingArchived ? pageSize : undefined,
                })
            ]);
            
            setRequestSettings(settingsData);
            
            const useWarehouse = settingsData.useWarehouseReception;
            const activeFilter = (o: PurchaseRequest) => useWarehouse ? o.status !== 'received-in-warehouse' && o.status !== 'canceled' : o.status !== 'received' && o.status !== 'canceled';
            
            const allRequests = requestsData.requests;
            
            setActiveRequests(allRequests.filter(activeFilter));
            setArchivedRequests(allRequests.filter(req => !activeFilter(req)));
            setTotalArchived(requestsData.totalArchivedCount);

        } catch (error) {
            logError("Failed to load purchase requests data", { error });
            toast({ title: "Error", description: "No se pudieron cargar las solicitudes de compra.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, viewingArchived, pageSize]);
    
    useEffect(() => {
        setTitle("Solicitud de Compra");
        if (isAuthorized) {
            loadInitialData(archivedPage);
        }
    }, [setTitle, isAuthorized, loadInitialData, archivedPage]);

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
            logError("Failed to create request", { error });
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
            logError("Failed to edit request", { error });
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
        setStatusDialogOpen(true);
    };
    
    const handleStatusUpdate = async () => {
        if (!requestToUpdate || !newStatus || !currentUser) return;
        setIsSubmitting(true);
        try {
            await updatePurchaseRequestStatus({ requestId: requestToUpdate.id, status: newStatus, notes: statusUpdateNotes, updatedBy: currentUser.name, reopen: false, deliveredQuantity: newStatus === 'received' ? Number(deliveredQuantity) : undefined });
            toast({ title: "Estado Actualizado" });
            setStatusDialogOpen(false);
            await loadInitialData(viewingArchived ? archivedPage : 0);
        } catch (error: any) {
            logError("Failed to update status", { error });
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
            logError("Failed to get history", { error });
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
            logError("Failed to reopen request", { error });
            toast({ title: "Error", variant: "destructive" });
            await loadInitialData();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectCancellation = async (request: PurchaseRequest) => {
        if (!currentUser) return;
        setIsSubmitting(true);
        try {
            await rejectCancellationRequest({ entityId: request.id, notes: 'Solicitud de cancelación rechazada.', updatedBy: currentUser.name });
            await loadInitialData();
            toast({ title: 'Solicitud Rechazada' });
        } catch (error: any) {
             logError("Failed to reject cancellation", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleSelectItem = (value: string) => {
        setItemSearchOpen(false);
        const product = authProducts.find(p => p.id === value);
        if (product) {
            if (requestToEdit) setRequestToEdit(p => p ? { ...p, itemId: product.id, itemDescription: product.description || '' } : null);
            else setNewRequest(p => ({ ...p, itemId: product.id, itemDescription: product.description || '' }));
            setItemSearchTerm(`[${product.id}] - ${product.description}`);
        }
    };

    const handleSelectClient = (value: string) => {
        setClientSearchOpen(false);
        const client = authCustomers.find(c => c.id === value);
        if (client) {
            if (requestToEdit) setRequestToEdit(p => p ? { ...p, clientId: client.id, clientName: client.name } : null);
            else setNewRequest(p => ({ ...p, clientId: client.id, clientName: client.name }));
            setClientSearchTerm(`${client.id} - ${client.name}`);
        }
    };

    const getDaysRemaining = (dateStr: string) => {
        if (!dateStr) return { label: 'Sin fecha', color: 'text-gray-500' };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const requiredDate = parseISO(dateStr); requiredDate.setHours(0, 0, 0, 0);
        const days = differenceInCalendarDays(requiredDate, today);
        let color = 'text-green-600'; if (days <= 2) color = 'text-orange-500'; if (days <= 0) color = 'text-red-600';
        return { label: days === 0 ? 'Para Hoy' : days < 0 ? `Atrasado ${Math.abs(days)}d` : `Faltan ${days}d`, color: color };
    };

    const handleExportPDF = () => {
        if (!companyData) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
    
        const addHeader = (docInstance: jsPDF) => {
            if (companyData.logoUrl) {
                try {
                    docInstance.addImage(companyData.logoUrl, 'PNG', margin, 15, 50, 15);
                } catch(e) { console.error("Error adding logo to PDF:", e); }
            }
            docInstance.setFontSize(18);
            docInstance.setFont('helvetica', 'bold');
            docInstance.text(`Lista de Solicitudes de Compra (${viewingArchived ? 'Archivadas' : 'Activas'})`, pageWidth / 2, 22, { align: 'center' });
            
            docInstance.setFontSize(10);
            docInstance.setFont('helvetica', 'normal');
            
            let startY = 35;
            docInstance.text(companyData.name, margin, startY);
            startY += 5;
            docInstance.text(companyData.taxId, margin, startY);

            docInstance.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 35, { align: 'right' });
        };
        

        const tableColumn = ["Solicitud", "Artículo", "Cliente", "Cant.", "Fecha Req.", "Estado"];
        const tableRows: (string | number)[][] = selectors.filteredRequests.map(request => [
            request.consecutive,
            `[${request.itemId}] ${request.itemDescription}`,
            request.clientName,
            request.quantity,
            format(parseISO(request.requiredDate), 'dd/MM/yy'),
            statusConfig[request.status]?.label || request.status
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            headStyles: { fillColor: [41, 128, 185], halign: 'left' },
            didDrawPage: (data) => {
                addHeader(doc);
            },
            didDrawCell: (data) => {
                if (data.section === 'head' && [3].includes(data.column.index)) {
                    (data.cell.styles as any).halign = 'right';
                }
            },
            columnStyles: {
                3: { halign: 'right' }
            },
        });

        doc.save(`solicitudes_compra_${new Date().getTime()}.pdf`);
    };

    const handleExportSingleRequestPDF = async (request: PurchaseRequest) => {
        if (!companyData) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = 35;
    
        if (companyData.logoUrl) {
            try {
                doc.addImage(companyData.logoUrl, 'PNG', margin, 15, 50, 15);
            } catch(e) { console.error("Error adding logo to PDF:", e) }
        }
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Solicitud de Compra', pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${request.consecutive}`, pageWidth - margin, 22, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 28, { align: 'right' });
        y += 15;
        
        const details = [
            { title: 'Cliente:', value: request.clientName },
            { title: 'Artículo:', value: `[${request.itemId}] ${request.itemDescription}` },
            { title: 'Cantidad Solicitada:', value: request.quantity.toLocaleString('es-CR') },
            { title: 'Fecha Solicitud:', value: format(parseISO(request.requestDate), 'dd/MM/yyyy') },
            { title: 'Fecha Requerida:', value: format(parseISO(request.requiredDate), 'dd/MM/yyyy') },
            { title: 'Estado:', value: statusConfig[request.status]?.label || request.status },
            { title: 'Prioridad:', value: priorityConfig[request.priority]?.label || request.priority },
            { title: 'Ruta:', value: request.route || 'N/A' },
            { title: 'Método Envío:', value: request.shippingMethod || 'N/A' },
            { title: 'Proveedor:', value: request.manualSupplier || 'N/A' },
            { title: 'Notas:', value: request.notes || 'N/A' },
            { title: 'Solicitado por:', value: request.requestedBy },
            { title: 'Aprobado por:', value: request.approvedBy || 'N/A' },
            { title: 'Última actualización:', value: `${request.lastStatusUpdateBy || 'N/A'} - ${request.lastStatusUpdateNotes || ''}` }
        ];
    
        autoTable(doc, {
            startY: y,
            body: details.map(d => [d.title, d.value]),
            theme: 'plain',
            styles: { cellPadding: 1, fontSize: 10 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40 },
                1: { cellWidth: 'auto' }
            },
            didParseCell: (data) => { (data.cell.styles as any).fillColor = '#ffffff'; }
        });
    
        y = (doc as any).lastAutoTable.finalY + 15;
    
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Historial de Cambios', margin, y);
        y += 8;
    
        const requestHistory = await getRequestHistory(request.id);
        if (requestHistory.length > 0) {
            const tableColumn = ["Fecha", "Estado", "Usuario", "Notas"];
            const tableRows = requestHistory.map(entry => [
                format(parseISO(entry.timestamp), 'dd/MM/yy HH:mm'),
                statusConfig[entry.status]?.label || entry.status,
                entry.updatedBy,
                entry.notes || ''
            ]);
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: y,
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            });
        } else {
            doc.setFontSize(10);
            doc.text('No hay historial de cambios para esta solicitud.', margin, y);
        }
    
        doc.save(`sc_${request.consecutive}.pdf`);
    }

    const selectors = {
        hasPermission,
        priorityConfig,
        statusConfig,
        getDaysRemaining,
        clientOptions: useMemo(() => {
            if (debouncedClientSearch.length < 2) return [];
            const searchLower = debouncedClientSearch.toLowerCase();
            return authCustomers.filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower)).map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
        }, [authCustomers, debouncedClientSearch]),
        itemOptions: useMemo(() => {
            if (debouncedItemSearch.length < 2) return [];
            const searchLower = debouncedItemSearch.toLowerCase();
            return authProducts.filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower)).map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
        }, [authProducts, debouncedItemSearch]),
        classifications: useMemo(() => Array.from(new Set(authProducts.map(p => p.classification).filter(Boolean))), [authProducts]),
        filteredRequests: useMemo(() => {
            let requestsToFilter = viewingArchived ? archivedRequests : activeRequests;
            
            return requestsToFilter.filter(request => {
                const product = authProducts.find(p => p.id === request.itemId);
                const searchMatch = debouncedSearchTerm ? 
                    request.consecutive.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    request.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    request.itemDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    request.purchaseOrder?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                    : true;
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
        setRequestToUpdate, handleRejectCancellation, handleExportPDF, handleExportSingleRequestPDF
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
            companyData,
        },
        actions,
        selectors,
        isLoading,
        isAuthorized
    };
};

