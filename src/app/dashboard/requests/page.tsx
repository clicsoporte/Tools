'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlusCircle, FilePlus, Loader2, Check, MoreVertical, History, RefreshCcw, AlertTriangle, Undo2, PackageCheck, Truck, XCircle, Home, Pencil, FilterX, CalendarIcon, Users, User as UserIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getAllCustomers, getAllProducts, getAllStock } from '@/modules/core/lib/db-client';
import { getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, updatePurchaseRequestStatus, getRequestHistory, getRequestSettings } from '@/modules/requests/lib/db-client';
import type { Customer, Product, PurchaseRequest, PurchaseRequestStatus, PurchaseRequestPriority, PurchaseRequestHistoryEntry, User, RequestSettings, StockInfo, Company } from '@/modules/core/types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { useDebounce } from 'use-debounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


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

const statusConfig: { [key in PurchaseRequestStatus]: { label: string; color: string } } = {
    pending: { label: "Pendiente", color: "bg-yellow-500" },
    approved: { label: "Aprobada", color: "bg-green-500" },
    ordered: { label: "Ordenada", color: "bg-blue-500" },
    received: { label: "Recibida", color: "bg-teal-500" },
    'received-in-warehouse': { label: "Recibido en Bodega", color: "bg-gray-700" },
    canceled: { label: "Cancelada", color: "bg-red-700" },
};

const priorityConfig: { [key in PurchaseRequestPriority]: { label: string; className: string } } = {
    low: { label: "Baja", className: "text-gray-500" },
    medium: { label: "Media", className: "text-blue-500" },
    high: { label: "Alta", className: "text-yellow-600" },
    urgent: { label: "Urgente", className: "text-red-600" },
};

const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requiredDate = parseISO(dateStr);
    requiredDate.setHours(0, 0, 0, 0);
    const days = differenceInDays(requiredDate, today);

    let color = 'text-green-600';
    if (days <= 0) color = 'text-red-600';
    else if (days <= 3) color = 'text-orange-500';

    return {
        days,
        color,
        label: days === 0 ? 'Para Hoy' : days < 0 ? `Atrasado ${Math.abs(days)}d` : `Faltan ${days}d`,
    };
};

export default function PurchaseRequestPage() {
    const { isAuthorized, hasPermission } = useAuthorization(['requests:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, companyData } = useAuth();

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
    
    const [clients, setClients] = useState<Customer[]>([]);
    const [items, setItems] = useState<Product[]>([]);
    const [stockLevels, setStockLevels] = useState<StockInfo[]>([]);
    const [requestSettings, setRequestSettings] = useState<RequestSettings | null>(null);
    
    const [newRequest, setNewRequest] = useState(emptyRequest);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);

    // State for filtering
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

    useEffect(() => {
        setTitle("Solicitud de Compra");
    }, [setTitle]);

    const loadInitialData = useCallback(async (page = 0) => {
        setIsLoading(true);
        try {
             const [
                requestsData,
                clientsData,
                itemsData,
                stockData,
                settingsData
            ] = await Promise.all([
                getPurchaseRequests({
                    page: viewingArchived ? page : undefined,
                    pageSize: viewingArchived ? pageSize : undefined,
                    filters: {
                        searchTerm: debouncedSearchTerm,
                        status: statusFilter,
                        classification: classificationFilter,
                        dateRange: dateFilter,
                    }
                }),
                getAllCustomers(),
                getAllProducts(),
                getAllStock(),
                getRequestSettings()
            ]);

            setClients(clientsData);
            setItems(itemsData);
            setStockLevels(stockData);
            setRequestSettings(settingsData);
            
            const useWarehouse = settingsData.useWarehouseReception;
            const activeFilter = (o: PurchaseRequest) => useWarehouse
                ? o.status !== 'received-in-warehouse' && o.status !== 'canceled'
                : o.status !== 'received' && o.status !== 'canceled';
            
            setActiveRequests(requestsData.requests.filter(activeFilter));
            setArchivedRequests(requestsData.requests.filter(req => !activeFilter(req)));
            setTotalArchived(requestsData.totalArchivedCount);

        } catch (error) {
            logError("Failed to load purchase requests data", { error });
            toast({ title: "Error", description: "No se pudieron cargar las solicitudes de compra.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, viewingArchived, pageSize, debouncedSearchTerm, statusFilter, classificationFilter, dateFilter]);
    
    useEffect(() => {
        if (isAuthorized) {
            loadInitialData(archivedPage);
        }
    }, [isAuthorized, loadInitialData, archivedPage, debouncedSearchTerm, statusFilter, classificationFilter, dateFilter, pageSize]);
    
    const clientOptions = useMemo(() => {
        if (debouncedClientSearch.length < 2) return [];
        const searchLower = debouncedClientSearch.toLowerCase();
        return clients
            .filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower))
            .map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
    }, [clients, debouncedClientSearch]);
    
    const itemOptions = useMemo(() => {
        if (debouncedItemSearch.length < 2) return [];
        const searchLower = debouncedItemSearch.toLowerCase();
        return items
            .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
            .map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
    }, [items, debouncedItemSearch]);

    const handleCreateRequest = async () => {
        if (!newRequest.clientId || !newRequest.itemId || !newRequest.quantity || !newRequest.requiredDate) {
            toast({ title: "Campos requeridos", description: "Cliente, artículo, cantidad y fecha requerida son obligatorios.", variant: "destructive" });
            return;
        }
        
        if (!currentUser) {
            toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await savePurchaseRequest(newRequest, currentUser.name);
            toast({ title: "Solicitud Creada", description: `La solicitud para ${newRequest.clientName} ha sido creada.` });
            await logInfo("Purchase request created", { item: newRequest.itemDescription });
            setNewRequestDialogOpen(false);
            setNewRequest(emptyRequest);
            setItemSearchTerm("");
            setClientSearchTerm("");
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to create purchase request", { error: error.message });
            toast({ title: "Error al Crear", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestToEdit || !currentUser) return;
        
        if (!requestToEdit.clientId || !requestToEdit.itemId || !requestToEdit.quantity || !requestToEdit.requiredDate) {
            toast({ title: "Campos requeridos", description: "Cliente, artículo, cantidad y fecha requerida son obligatorios.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const updatedRequest = await updatePurchaseRequest({
                requestId: requestToEdit.id,
                updatedBy: currentUser.name,
                ...requestToEdit,
            });
            setActiveRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
            setArchivedRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));
            toast({ title: "Solicitud Actualizada", description: `La solicitud ${requestToEdit.consecutive} ha sido guardada.` });
            await logInfo("Purchase request updated", { request: requestToEdit.consecutive });
            setEditRequestDialogOpen(false);
            setRequestToEdit(null);
        } catch (error: any) {
            logError("Failed to edit purchase request", { error: error.message });
            toast({ title: "Error al Editar", description: error.message, variant: "destructive" });
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

        let finalDeliveredQuantity: number | undefined = undefined;

        if (newStatus === 'received') {
            const qty = parseFloat(String(deliveredQuantity));
            if (isNaN(qty) || qty < 0) {
                toast({ title: "Cantidad inválida", description: "Por favor, introduce un número válido para la cantidad recibida.", variant: "destructive" });
                return;
            }
            finalDeliveredQuantity = qty;
        }
        
        setIsSubmitting(true);
        try {
            await updatePurchaseRequestStatus({
                requestId: requestToUpdate.id,
                status: newStatus,
                notes: statusUpdateNotes,
                updatedBy: currentUser.name,
                reopen: false,
                deliveredQuantity: finalDeliveredQuantity,
            });
            
            toast({ title: "Estado Actualizado", description: `La solicitud ${requestToUpdate.consecutive} ahora está ${statusConfig[newStatus].label}.` });
            await logInfo("Purchase request status updated", { request: requestToUpdate.consecutive, newStatus: newStatus });
            setStatusDialogOpen(false);
            await loadInitialData(viewingArchived ? archivedPage : 0);
        } catch (error: any) {
            logError("Failed to update request status", { error: error.message });
            toast({ title: "Error al Actualizar", description: error.message, variant: "destructive" });
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
            const historyData = await getRequestHistory(request.id);
            setHistory(historyData);
        } catch (error: any) {
            logError("Failed to get request history", { error: error.message });
            toast({ title: "Error", description: "No se pudo cargar el historial de la solicitud.", variant: "destructive" });
        } finally {
            setIsHistoryLoading(false);
        }
    };
    
    const handleReopenRequest = async () => {
        if (!requestToUpdate || !currentUser || reopenStep !== 2 || reopenConfirmationText !== 'REABRIR') return;

        setIsSubmitting(true);
        try {
            await updatePurchaseRequestStatus({
                requestId: requestToUpdate.id,
                status: 'pending',
                notes: 'Solicitud reabierta por el administrador.',
                updatedBy: currentUser.name,
                reopen: true
            });
            
            toast({ title: "Solicitud Reabierta", description: `La solicitud ${requestToUpdate.consecutive} ha sido movida a pendientes.` });
            await logInfo("Purchase request reopened", { request: requestToUpdate.consecutive });
            setReopenDialogOpen(false);
            setReopenStep(0);
            setReopenConfirmationText('');
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to reopen request", { error: error.message });
            toast({ title: "Error al Reabrir", description: error.message, variant: "destructive" });
            await loadInitialData();
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSelectItem = (value: string) => {
        setItemSearchOpen(false);
        const product = items.find(p => p.id === value);
        if (product) {
            const fullDescription = `[${product.id}] - ${product.description}`;
            if (requestToEdit) {
                setRequestToEdit(prev => prev ? { ...prev, itemId: product.id, itemDescription: product.description || '' } : null);
            } else {
                setNewRequest(prev => ({ ...prev, itemId: product.id, itemDescription: product.description || '' }));
            }
            setItemSearchTerm(fullDescription);
        } else {
            setItemSearchTerm('');
        }
    };

    const handleSelectClient = (value: string) => {
        setClientSearchOpen(false);
        const client = clients.find(c => c.id === value);
        if (client) {
            const fullDescription = `${client.id} - ${client.name}`;
            if (requestToEdit) {
                setRequestToEdit(prev => prev ? { ...prev, clientId: client.id, clientName: client.name } : null);
            } else {
                setNewRequest(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
            }
            setClientSearchTerm(fullDescription);
        } else {
            setClientSearchTerm('');
        }
    };
    
    const classifications = useMemo(() => {
        const classSet = new Set(items.map(p => p.classification).filter(Boolean));
        return Array.from(classSet);
    }, [items]);

    const filteredRequests = useMemo(() => {
        let requestsToFilter = viewingArchived ? archivedRequests : activeRequests;
        
        if (!viewingArchived) {
            requestsToFilter = requestsToFilter.filter(request => {
                const product = items.find(p => p.id === request.itemId);
                const searchMatch = debouncedSearchTerm 
                    ? request.consecutive.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                      request.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                      request.itemDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                    : true;
                
                const statusMatch = statusFilter === 'all' || request.status === statusFilter;
                
                const classificationMatch = classificationFilter === 'all' || (product && product.classification === classificationFilter);

                const dateMatch = !dateFilter || !dateFilter.from || (
                    new Date(request.requiredDate) >= dateFilter.from &&
                    new Date(request.requiredDate) <= (dateFilter.to || dateFilter.from)
                );

                return searchMatch && statusMatch && classificationMatch && dateMatch;
            });
        }
        return requestsToFilter;
    }, [viewingArchived, activeRequests, archivedRequests, debouncedSearchTerm, statusFilter, classificationFilter, items, dateFilter]);


    const renderRequestCard = (request: PurchaseRequest) => {
        const finalState = requestSettings?.useWarehouseReception ? 'received-in-warehouse' : 'received';
        const canBeReopened = hasPermission('requests:reopen') && (request.status === finalState || request.status === 'canceled');
        const canApprove = hasPermission('requests:status:approve') && request.status === 'pending';
        const canOrder = hasPermission('requests:status:ordered') && request.status === 'approved';
        const canReceive = hasPermission('requests:status:received') && request.status === 'ordered';
        const canReceiveInWarehouse = hasPermission('requests:status:received') && request.status === 'received' && requestSettings?.useWarehouseReception;
        const canCancel = hasPermission('requests:status:cancel') && request.status !== 'received' && request.status !== 'canceled' && request.status !== 'received-in-warehouse';
        
        const canEditPending = hasPermission('requests:edit:pending') && request.status === 'pending';
        const canEditApproved = hasPermission('requests:edit:approved') && ['approved', 'ordered'].includes(request.status);
        const canEdit = canEditPending || canEditApproved;
        const daysRemaining = getDaysRemaining(request.requiredDate);
        
        return (
            <Card key={request.id} className="w-full">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <CardTitle className="text-lg">{`[${request.itemId}] ${request.itemDescription}`}</CardTitle>
                            <CardDescription>Cliente: {request.clientName} - Solicitud: {request.consecutive}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            {request.reopened && <Badge variant="destructive"><RefreshCcw className="mr-1 h-3 w-3" /> Reabierta</Badge>}
                             <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(request)}><History className="h-4 w-4" /></Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-1">
                                    <div className="grid grid-cols-1">
                                        {canEdit && <Button variant="ghost" className="justify-start" onClick={() => { setRequestToEdit(request); setEditRequestDialogOpen(true); }}><Pencil className="mr-2"/> Editar Solicitud</Button>}
                                        {canBeReopened && <Button variant="ghost" className="justify-start text-orange-600" onClick={() => { setRequestToUpdate(request); setReopenDialogOpen(true); }}><Undo2 className="mr-2"/> Reabrir</Button>}
                                        {canApprove && <Button variant="ghost" className="justify-start text-green-600" onClick={() => openStatusDialog(request, 'approved')}><Check className="mr-2"/> Aprobar</Button>}
                                        {canOrder && <Button variant="ghost" className="justify-start text-blue-600" onClick={() => openStatusDialog(request, 'ordered')}><Truck className="mr-2"/> Marcar como Ordenada</Button>}
                                        {canReceive && <Button variant="ghost" className="justify-start text-indigo-600" onClick={() => openStatusDialog(request, 'received')}><PackageCheck className="mr-2"/> Marcar como Recibida</Button>}
                                        {canReceiveInWarehouse && <Button variant="ghost" className="justify-start text-gray-700" onClick={() => openStatusDialog(request, 'received-in-warehouse')}><Home className="mr-2"/> Recibir en Bodega</Button>}
                                        {canCancel && <Button variant="ghost" className="justify-start text-red-600" onClick={() => openStatusDialog(request, 'canceled')}><XCircle className="mr-2"/> Cancelar</Button>}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6 text-sm">
                        
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Estado Actual</p>
                            <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-full", statusConfig[request.status].color)}></span>
                                <span className="font-medium">{statusConfig[request.status].label}</span>
                            </div>
                        </div>

                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Prioridad</p>
                            <span className={cn("font-medium", priorityConfig[request.priority]?.className)}>{priorityConfig[request.priority]?.label || request.priority}</span>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha Requerida</p>
                            <div className="flex items-center gap-2">
                                <span>{format(parseISO(request.requiredDate), 'dd/MM/yyyy')}</span>
                                <span className={cn('text-xs font-semibold', daysRemaining.color)}>
                                    ({daysRemaining.label})
                                </span>
                            </div>
                        </div>

                        {request.receivedDate && 
                             <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Fecha Recibida</p>
                                <p>{format(parseISO(request.receivedDate), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                        }

                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Cant. Solicitada</p>
                            <p className="font-bold text-lg">{request.quantity.toLocaleString()}</p>
                        </div>
                         {request.deliveredQuantity !== null && request.deliveredQuantity !== undefined && (
                            <>
                                 <div className="space-y-1">
                                    <p className="font-semibold text-muted-foreground">Cant. Recibida</p>
                                    <p className="font-bold text-lg text-green-600">{request.deliveredQuantity.toLocaleString()}</p>
                                </div>
                                 <div className="space-y-1">
                                    <p className="font-semibold text-muted-foreground">Diferencia</p>
                                    <p className={cn(
                                        "font-bold text-lg",
                                        (request.deliveredQuantity - request.quantity) > 0 && "text-blue-600",
                                        (request.deliveredQuantity - request.quantity) < 0 && "text-destructive"
                                    )}>
                                        {(request.deliveredQuantity - request.quantity).toLocaleString()}
                                    </p>
                                </div>
                            </>
                         )}
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Precio Venta (s/IVA)</p>
                            <p>{request.unitSalePrice ? `₡${request.unitSalePrice.toLocaleString()}` : 'N/A'}</p>
                        </div>
                        {request.purchaseOrder &&
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Nº OC Cliente</p>
                                <p>{request.purchaseOrder}</p>
                            </div>
                        }
                        {request.manualSupplier &&
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Proveedor</p>
                                <p>{request.manualSupplier}</p>
                            </div>
                        }
                        {request.erpOrderNumber &&
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Nº Pedido ERP</p>
                                <p>{request.erpOrderNumber}</p>
                            </div>
                        }
                        {request.route &&
                             <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Ruta de Entrega</p>
                                <p>{request.route}</p>
                            </div>
                        }
                         {request.shippingMethod &&
                             <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Método de Envío</p>
                                <p>{request.shippingMethod}</p>
                            </div>
                        }
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Tipo de Compra</p>
                             <div className="flex items-center gap-2">
                                {request.purchaseType === 'multiple' ? <Users className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                                <span>{request.purchaseType === 'multiple' ? 'Múltiples Proveedores' : 'Proveedor Único'}</span>
                            </div>
                        </div>
                    </div>
                     {request.notes && (
                        <div className="mt-4 text-xs bg-muted p-2 rounded-md">
                            <p className="font-semibold">Notas de la Solicitud:</p>
                            <p className="text-muted-foreground">"{request.notes}"</p>
                        </div>
                     )}
                     {request.lastStatusUpdateNotes && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded-md">
                            <p className="font-semibold">Última nota de estado:</p>
                            <p className="text-muted-foreground">"{request.lastStatusUpdateNotes}" - <span className="italic">{request.lastStatusUpdateBy}</span></p>
                        </div>
                     )}
                </CardContent>
                <CardFooter className="p-4 pt-0 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
                    <span>Solicitado por: {request.requestedBy} el {format(parseISO(request.requestDate), 'dd/MM/yyyy')}</span>
                    {request.approvedBy && <span>Aprobado por: {request.approvedBy}</span>}
                </CardFooter>
            </Card>
        );
    }
    
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

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-lg font-semibold md:text-2xl">Solicitudes de Compra</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                     <Button variant={viewingArchived ? "outline" : "secondary"} onClick={() => setViewingArchived(false)}>Activas</Button>
                     <Button variant={viewingArchived ? "secondary" : "outline"} onClick={() => setViewingArchived(true)}>Archivadas</Button>
                     {hasPermission('requests:create') && (
                        <Dialog open={isNewRequestDialogOpen} onOpenChange={setNewRequestDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><FilePlus className="mr-2"/> Nueva Solicitud</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <form onSubmit={(e) => { e.preventDefault(); handleCreateRequest(); }}>
                                    <DialogHeader>
                                        <DialogTitle>Crear Nueva Solicitud de Compra</DialogTitle>
                                        <DialogDescription>Complete los detalles para crear una nueva solicitud.</DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="h-[60vh] md:h-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="client-search">Cliente</Label>
                                            <SearchInput
                                                options={clientOptions}
                                                onSelect={(value) => handleSelectClient(value)}
                                                value={clientSearchTerm}
                                                onValueChange={(val) => { if(!val) handleSelectClient(''); setClientSearchTerm(val); }}
                                                placeholder="Buscar cliente..."
                                                open={isClientSearchOpen}
                                                onOpenChange={setClientSearchOpen}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="item-search">Artículo / Servicio</Label>
                                            <SearchInput
                                                options={itemOptions}
                                                onSelect={(value) => handleSelectItem(value)}
                                                value={itemSearchTerm}
                                                onValueChange={(val) => { if(!val) handleSelectItem(''); setItemSearchTerm(val); }}
                                                placeholder="Buscar artículo..."
                                                open={isItemSearchOpen}
                                                onOpenChange={setItemSearchOpen}
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-po">Nº Orden de Compra Cliente</Label>
                                            <Input 
                                                id="new-request-po"
                                                value={newRequest.purchaseOrder || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, purchaseOrder: e.target.value }))} 
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-quantity">Cantidad</Label>
                                            <Input 
                                                id="new-request-quantity" 
                                                type="number" 
                                                placeholder="0.00" 
                                                value={newRequest.quantity || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, quantity: Number(e.target.value) }))} 
                                                required
                                            />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-request-unit-sale-price">Precio de Venta Unitario (sin IVA)</Label>
                                            <Input 
                                                id="new-request-unit-sale-price" 
                                                type="number" 
                                                placeholder="0.00" 
                                                value={newRequest.unitSalePrice || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, unitSalePrice: Number(e.target.value) }))} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-required-date">Fecha Requerida</Label>
                                            <Input 
                                                id="new-request-required-date" 
                                                type="date" 
                                                value={newRequest.requiredDate} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, requiredDate: e.target.value }))} 
                                                required
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-supplier">Proveedor (Manual)</Label>
                                            <Input 
                                                id="new-request-supplier"
                                                value={newRequest.manualSupplier || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, manualSupplier: e.target.value }))} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-erp">Número de Pedido ERP</Label>
                                            <Input 
                                                id="new-request-erp"
                                                value={newRequest.erpOrderNumber || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, erpOrderNumber: e.target.value }))} 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-inventory-manual">Inventario Actual (Manual)</Label>
                                            <Input 
                                                id="new-request-inventory-manual" 
                                                type="number" 
                                                placeholder="0.00" 
                                                value={newRequest.inventory || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, inventory: Number(e.target.value) }))} 
                                            />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-request-inventory-erp">Inventario Actual (ERP)</Label>
                                            <Input 
                                                id="new-request-inventory-erp"
                                                value={(stockLevels.find(s => s.itemId === newRequest.itemId)?.totalStock ?? 0).toLocaleString()}
                                                disabled
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="new-request-route">Ruta</Label>
                                            <Select value={newRequest.route} onValueChange={(value) => setNewRequest(prev => ({...prev, route: value}))}>
                                                <SelectTrigger id="new-request-route">
                                                    <SelectValue placeholder="Seleccione una ruta" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {requestSettings?.routes.map(route => (
                                                        <SelectItem key={route} value={route}>{route}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-request-shipping-method">Método de Envío</Label>
                                            <Select value={newRequest.shippingMethod} onValueChange={(value) => setNewRequest(prev => ({...prev, shippingMethod: value}))}>
                                                <SelectTrigger id="new-request-shipping-method">
                                                    <SelectValue placeholder="Seleccione un método" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {requestSettings?.shippingMethods.map(method => (
                                                        <SelectItem key={method} value={method}>{method}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-request-priority">Prioridad</Label>
                                            <Select value={newRequest.priority} onValueChange={(value: PurchaseRequestPriority) => setNewRequest(prev => ({...prev, priority: value}))}>
                                                <SelectTrigger id="new-request-priority"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(priorityConfig).map(([key, {label}]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tipo de Compra</Label>
                                            <RadioGroup
                                                value={newRequest.purchaseType}
                                                onValueChange={(value: 'single' | 'multiple') => setNewRequest(prev => ({ ...prev, purchaseType: value }))}
                                                className="flex items-center gap-4 pt-2"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="single" id="r-single" />
                                                    <Label htmlFor="r-single">Proveedor Único</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="multiple" id="r-multiple" />
                                                    <Label htmlFor="r-multiple">Múltiples Proveedores</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                       
                                        <div className="space-y-2 col-span-1 md:col-span-2">
                                            <Label htmlFor="new-request-notes">Notas Adicionales</Label>
                                            <Textarea 
                                                id="new-request-notes" 
                                                placeholder="Justificación, detalles del proveedor, etc." 
                                                value={newRequest.notes || ''} 
                                                onChange={e => setNewRequest(prev => ({ ...prev, notes: e.target.value }))} 
                                            />
                                        </div>
                                    </div>
                                    </ScrollArea>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="ghost">Cancelar</Button>
                                        </DialogClose>
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                                            Crear Solicitud
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                     )}
                </div>
            </div>

            <Card>
                 <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="Buscar por Nº solicitud, cliente o producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="Filtrar por estado..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Estados</SelectItem>
                                {Object.entries(statusConfig).map(([key, { label }]) => (
                                     <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                            <SelectTrigger className="w-full md:w-[240px]">
                                <SelectValue placeholder="Filtrar por clasificación..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Clasificaciones</SelectItem>
                                {classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full md:w-[240px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateFilter?.from ? (
                                        dateFilter.to ? (
                                            `${format(dateFilter.from, "LLL dd, y")} - ${format(dateFilter.to, "LLL dd, y")}`
                                        ) : (
                                            format(dateFilter.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Filtrar por fecha</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="range" selected={dateFilter} onSelect={setDateFilter} />
                            </PopoverContent>
                        </Popover>
                        <Button variant="ghost" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setClassificationFilter('all'); setDateFilter(undefined); }}>
                            <FilterX className="mr-2 h-4 w-4" />
                            Limpiar
                        </Button>
                    </div>
                     {viewingArchived && (
                        <div className="flex items-center gap-2">
                            <Label htmlFor="page-size">Registros por página:</Label>
                            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                                <SelectTrigger id="page-size" className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="200">200</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                {isLoading ? (
                     <div className="space-y-4">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : filteredRequests.length > 0 ? (
                    filteredRequests.map(renderRequestCard)
                ) : (
                     <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <h3 className="text-2xl font-bold tracking-tight">
                                No se encontraron solicitudes.
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                 Intenta ajustar los filtros de búsqueda o crea una nueva solicitud.
                            </p>
                        </div>
                    </div>
                )}
            </div>

             {viewingArchived && totalArchived > pageSize && (
                 <div className="flex items-center justify-center space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setArchivedPage(p => p - 1)}
                        disabled={archivedPage === 0}
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Página {archivedPage + 1} de {Math.ceil(totalArchived / pageSize)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setArchivedPage(p => p + 1)}
                        disabled={(archivedPage + 1) * pageSize >= totalArchived}
                    >
                        Siguiente
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Edit Request Dialog */}
            <Dialog open={isEditRequestDialogOpen} onOpenChange={setEditRequestDialogOpen}>
                 <DialogContent className="sm:max-w-3xl">
                    <form onSubmit={handleEditRequest}>
                        <DialogHeader>
                            <DialogTitle>Editar Solicitud - {requestToEdit?.consecutive}</DialogTitle>
                            <DialogDescription>Modifique los detalles de la solicitud.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] md:h-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                             <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Input value={requestToEdit?.clientName} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Artículo / Servicio</Label>
                                <Input value={`[${requestToEdit?.itemId}] ${requestToEdit?.itemDescription}`} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-request-quantity">Cantidad</Label>
                                <Input id="edit-request-quantity" type="number" value={requestToEdit?.quantity || ''} onChange={e => setRequestToEdit(prev => prev ? { ...prev, quantity: Number(e.target.value) } : null)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-request-required-date">Fecha Requerida</Label>
                                <Input id="edit-request-required-date" type="date" value={requestToEdit?.requiredDate || ''} onChange={e => setRequestToEdit(prev => prev ? { ...prev, requiredDate: e.target.value } : null)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-request-priority">Prioridad</Label>
                                <Select value={requestToEdit?.priority} onValueChange={(value: PurchaseRequestPriority) => setRequestToEdit(prev => prev ? {...prev, priority: value} : null)}>
                                    <SelectTrigger id="edit-request-priority"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(priorityConfig).map(([key, {label}]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo de Compra</Label>
                                <RadioGroup
                                    value={requestToEdit?.purchaseType}
                                    onValueChange={(value: 'single' | 'multiple') => setRequestToEdit(prev => prev ? { ...prev, purchaseType: value } : null)}
                                    className="flex items-center gap-4 pt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="single" id="r-edit-single" />
                                        <Label htmlFor="r-edit-single">Proveedor Único</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="multiple" id="r-edit-multiple" />
                                        <Label htmlFor="r-edit-multiple">Múltiples Proveedores</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <Label htmlFor="edit-request-notes">Notas</Label>
                                <Textarea id="edit-request-notes" value={requestToEdit?.notes || ''} onChange={e => setRequestToEdit(prev => prev ? { ...prev, notes: e.target.value } : null)} />
                            </div>
                        </div>
                        </ScrollArea>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog for updating status */}
            <Dialog open={isStatusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Actualizar Estado de la Solicitud</DialogTitle>
                        <DialogDescription>
                            Estás a punto de cambiar el estado de la solicitud {requestToUpdate?.consecutive} a "{newStatus ? statusConfig[newStatus].label : ''}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {newStatus === 'received' && (
                             <div className="space-y-2">
                                <Label htmlFor="status-delivered-quantity">Cantidad Recibida</Label>
                                <Input 
                                    id="status-delivered-quantity"
                                    type="number"
                                    value={deliveredQuantity}
                                    onChange={(e) => setDeliveredQuantity(e.target.value)}
                                    placeholder={`Cantidad solicitada: ${requestToUpdate?.quantity.toLocaleString()}`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Introduce la cantidad final que se recibió del proveedor.
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="status-notes">
                                Notas (Opcional)
                            </Label>
                            <Textarea 
                                id="status-notes"
                                value={statusUpdateNotes}
                                onChange={(e) => setStatusUpdateNotes(e.target.value)}
                                placeholder="Ej: Aprobado por Gerencia, Orden de compra #1234"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleStatusUpdate} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                            Actualizar Estado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Reopen Request Dialog */}
            <Dialog open={isReopenDialogOpen} onOpenChange={(isOpen) => {
                setReopenDialogOpen(isOpen);
                if (!isOpen) {
                    setReopenStep(0);
                    setReopenConfirmationText('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                         <DialogTitle className="flex items-center gap-2">
                             <AlertTriangle className="text-destructive" /> 
                             Reabrir Solicitud Finalizada
                         </DialogTitle>
                         <DialogDescription>
                           Estás a punto de reabrir la solicitud {requestToUpdate?.consecutive}. Esta acción es irreversible y moverá la solicitud de nuevo a "Pendiente".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="reopen-confirm-checkbox" 
                                onCheckedChange={(checked) => setReopenStep(checked ? 1 : 0)} 
                            />
                            <Label htmlFor="reopen-confirm-checkbox" className="font-medium text-destructive">
                                Entiendo que esta acción no se puede deshacer.
                            </Label>
                        </div>
                         {reopenStep > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="reopen-confirmation-text">Para confirmar, escribe "REABRIR" en el campo de abajo:</Label>
                                <Input
                                    id="reopen-confirmation-text"
                                    value={reopenConfirmationText}
                                    onChange={(e) => {
                                        setReopenConfirmationText(e.target.value.toUpperCase());
                                        if (e.target.value.toUpperCase() === 'REABRIR') {
                                            setReopenStep(2);
                                        } else {
                                            setReopenStep(1);
                                        }
                                    }}
                                    className="border-destructive focus-visible:ring-destructive"
                                />
                            </div>
                        )}
                    </div>
                     <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost">Cancelar</Button>
                        </DialogClose>
                        <Button 
                            onClick={handleReopenRequest} 
                            disabled={reopenStep !== 2 || reopenConfirmationText !== 'REABRIR' || isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                            Reabrir Solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog for viewing history */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Historial de Cambios - Solicitud {historyRequest?.consecutive}</DialogTitle>
                        <DialogDescription>
                            Registro de todos los cambios de estado para esta solicitud.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isHistoryLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : history.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha y Hora</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Notas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell>{format(parseISO(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell>
                                                <TableCell>
                                                    <Badge style={{backgroundColor: statusConfig[entry.status]?.color}} className="text-white">
                                                        {statusConfig[entry.status]?.label || entry.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{entry.updatedBy}</TableCell>
                                                <TableCell>{entry.notes || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No hay historial de cambios para esta solicitud.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    );
}
