

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getAllCustomers, getAllProducts, getAllStock, getCompanySettings } from '@/modules/core/lib/db';
import { getProductionOrders, saveProductionOrder, updateProductionOrder, updateProductionOrderStatus, getOrderHistory, getPlannerSettings, updateProductionOrderDetails, rejectCancellationRequest, addNoteToOrder } from '@/modules/planner/lib/db-client';
import type { Customer, Product, ProductionOrder, ProductionOrderStatus, ProductionOrderPriority, ProductionOrderHistoryEntry, User, PlannerSettings, StockInfo, Company, CustomStatus, DateRange, NotePayload, RejectCancellationPayload } from '@/modules/core/types';
import { isToday, differenceInCalendarDays, parseISO, format } from 'date-fns';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

const emptyOrder: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'requestedBy' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'machineId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate'> = {
    deliveryDate: '',
    customerId: '',
    customerName: '',
    productId: '',
    productDescription: '',
    quantity: 0,
    priority: 'medium',
    notes: '',
    inventory: 0,
    purchaseOrder: '',
};

export const usePlanner = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['planner:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, companyData: authCompanyData, customers, products, stockLevels: initialStockLevels } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNewOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
    const [isEditOrderDialogOpen, setEditOrderDialogOpen] = useState(false);
    const [activeOrders, setActiveOrders] = useState<ProductionOrder[]>([]);
    const [archivedOrders, setArchivedOrders] = useState<ProductionOrder[]>([]);
    const [viewingArchived, setViewingArchived] = useState(false);
    const [archivedPage, setArchivedPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalArchived, setTotalArchived] = useState(0);
    const [plannerSettings, setPlannerSettings] = useState<PlannerSettings | null>(null);
    
    const [stockLevels, setStockLevels] = useState<StockInfo[]>(initialStockLevels || []);
    
    const [newOrder, setNewOrder] = useState(emptyOrder);
    const [orderToEdit, setOrderToEdit] = useState<ProductionOrder | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [classificationFilter, setClassificationFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined);
    const [debouncedSearchTerm] = useDebounce(searchTerm, authCompanyData?.searchDebounceTime ?? 500);

    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [isProductSearchOpen, setProductSearchOpen] = useState(false);
    const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, authCompanyData?.searchDebounceTime ?? 500);
    const [debouncedProductSearch] = useDebounce(productSearchTerm, authCompanyData?.searchDebounceTime ?? 500);
    
    const [isStatusDialogOpen, setStatusDialogOpen] = useState(false);
    const [orderToUpdate, setOrderToUpdate] = useState<ProductionOrder | null>(null);
    const [newStatus, setNewStatus] = useState<ProductionOrderStatus | null>(null);
    const [statusUpdateNotes, setStatusUpdateNotes] = useState("");
    const [deliveredQuantity, setDeliveredQuantity] = useState<number | string>("");
    const [erpPackageNumber, setErpPackageNumber] = useState("");
    const [erpTicketNumber, setErpTicketNumber] = useState("");
    
    const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
    const [historyOrder, setHistoryOrder] = useState<ProductionOrder | null>(null);
    const [history, setHistory] = useState<ProductionOrderHistoryEntry[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [isReopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [reopenStep, setReopenStep] = useState(0);
    const [reopenConfirmationText, setReopenConfirmationText] = useState('');
    
    const [dynamicStatusConfig, setDynamicStatusConfig] = useState<{[key: string]: {label: string, color: string}}>({});
    
    const [isAddNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
    const [notePayload, setNotePayload] = useState<{ orderId: number; notes: string } | null>(null);

    const loadInitialData = useCallback(async (page = 0) => {
        setIsLoading(true);
        try {
             const [ settingsData, ordersData ] = await Promise.all([
                getPlannerSettings(),
                getProductionOrders({
                    page: viewingArchived ? page : undefined,
                    pageSize: viewingArchived ? pageSize : undefined,
                })
            ]);

            setPlannerSettings(settingsData);
            setStockLevels(initialStockLevels);

            if (settingsData?.customStatuses) {
                const newConfig = { ...statusConfig };
                settingsData.customStatuses.forEach(cs => {
                    if (cs.isActive && cs.label) {
                        newConfig[cs.id as ProductionOrderStatus] = { label: cs.label, color: cs.color };
                    }
                });
                setDynamicStatusConfig(newConfig as any);
            }
            
            const finalStatus = settingsData?.useWarehouseReception ? 'received-in-warehouse' : 'completed';
            const activeFilter = (o: ProductionOrder) => o.status !== finalStatus && o.status !== 'canceled';

            const allOrders = [...ordersData.activeOrders, ...ordersData.archivedOrders];
            setActiveOrders(allOrders.filter(activeFilter));
            setArchivedOrders(allOrders.filter(o => !activeFilter(o)));
            setTotalArchived(ordersData.totalArchivedCount);

        } catch (error) {
            logError("Failed to load planner data", { error });
            toast({ title: "Error", description: "No se pudieron cargar los datos del planificador.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, viewingArchived, pageSize, initialStockLevels]);
    
    useEffect(() => {
        setTitle("Planificador OP");
        if (isAuthorized) {
            loadInitialData(archivedPage);
        }
    }, [setTitle, isAuthorized, loadInitialData, archivedPage, viewingArchived]);

    const handleCreateOrder = async () => {
        if (!newOrder.customerId || !newOrder.productId || !newOrder.quantity || !newOrder.deliveryDate || !currentUser) return;
        setIsSubmitting(true);
        try {
            await saveProductionOrder(newOrder, currentUser.name);
            toast({ title: "Orden Creada" });
            setNewOrderDialogOpen(false);
            setNewOrder(emptyOrder);
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to create order", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderToEdit || !currentUser) return;
        setIsSubmitting(true);
        try {
            const updated = await updateProductionOrder({ orderId: orderToEdit.id, updatedBy: currentUser.name, ...orderToEdit });
            setActiveOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setArchivedOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            toast({ title: "Orden Actualizada" });
            setEditOrderDialogOpen(false);
        } catch (error: any) {
            logError("Failed to edit order", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const openStatusDialog = (order: ProductionOrder, status: ProductionOrderStatus) => {
        if (plannerSettings?.requireMachineForStart && status === 'in-progress' && !order.machineId) {
            toast({ title: "Asignación no realizada", description: "Debe asignar una máquina/proceso.", variant: "destructive" });
            return;
        }
        setOrderToUpdate(order);
        setNewStatus(status);
        setStatusUpdateNotes(status === 'cancellation-request' ? "" : ".");
        setDeliveredQuantity(status === 'completed' ? order.quantity : "");
        setErpPackageNumber("");
        setErpTicketNumber("");
        setStatusDialogOpen(true);
    };
    
    const handleStatusUpdate = async () => {
        if (!orderToUpdate || !newStatus || !currentUser) return;
        setIsSubmitting(true);
        try {
            await updateProductionOrderStatus({ orderId: orderToUpdate.id, status: newStatus, notes: statusUpdateNotes, updatedBy: currentUser.name, deliveredQuantity: newStatus === 'completed' ? Number(deliveredQuantity) : undefined, erpPackageNumber: newStatus === 'received-in-warehouse' ? erpPackageNumber : undefined, erpTicketNumber: newStatus === 'received-in-warehouse' ? erpTicketNumber : undefined, reopen: false });
            toast({ title: "Estado Actualizado" });
            setStatusDialogOpen(false);
            await loadInitialData(archivedPage);
        } catch (error: any) {
            logError("Failed to update status", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDetailUpdate = async (orderId: number, details: { priority?: ProductionOrderPriority; machineId?: string | null; scheduledDateRange?: DateRange }) => {
        if (!currentUser) return;
        const updated = await updateProductionOrderDetails({ orderId, ...details, updatedBy: currentUser.name });
        setActiveOrders(prev => prev.map(o => o.id === orderId ? updated : o));
        setArchivedOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    };

    const handleOpenHistory = async (order: ProductionOrder) => {
        setHistoryOrder(order);
        setHistoryDialogOpen(true);
        setIsHistoryLoading(true);
        try {
            setHistory(await getOrderHistory(order.id));
        } catch (error: any) {
            logError("Failed to get history", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsHistoryLoading(false);
        }
    };
    
    const handleReopenOrder = async () => {
        if (!orderToUpdate || !currentUser || reopenStep !== 2 || reopenConfirmationText !== 'REABRIR') return;
        setIsSubmitting(true);
        try {
            await updateProductionOrderStatus({ orderId: orderToUpdate.id, status: 'pending', notes: 'Orden reabierta.', updatedBy: currentUser.name, reopen: true });
            toast({ title: "Orden Reabierta" });
            setReopenDialogOpen(false);
            await loadInitialData();
        } catch (error: any) {
            logError("Failed to reopen order", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectCancellation = async (order: ProductionOrder) => {
        if (!currentUser) return;
        setIsSubmitting(true);
        try {
            await rejectCancellationRequest({ entityId: order.id, notes: 'Solicitud de cancelación rechazada.', updatedBy: currentUser.name });
            await loadInitialData();
            toast({ title: 'Solicitud Rechazada' });
        } catch (error: any) {
             logError("Failed to reject cancellation", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleSelectProduct = (value: string) => {
        setProductSearchOpen(false);
        const product = products.find(p => p.id === value);
        if (product) {
            const stock = stockLevels.find(s => s.itemId === product.id)?.totalStock ?? 0;
            if (orderToEdit) setOrderToEdit(p => p ? { ...p, productId: product.id, productDescription: product.description, inventory: stock } : null);
            else setNewOrder(p => ({ ...p, productId: product.id, productDescription: product.description, inventory: stock }));
            setProductSearchTerm(`[${product.id}] - ${product.description}`);
        }
    };

    const handleSelectCustomer = (value: string) => {
        setCustomerSearchOpen(false);
        const customer = customers.find(c => c.id === value);
        if (customer) {
            if (orderToEdit) setOrderToEdit(p => p ? { ...p, customerId: customer.id, customerName: customer.name } : null);
            else setNewOrder(p => ({ ...p, customerId: customer.id, customerName: customer.name }));
            setCustomerSearchTerm(`${customer.id} - ${customer.name}`);
        }
    };

    const handleProductInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && customerOptions.length > 0) { e.preventDefault(); handleSelectProduct(productOptions[0].value); }
    };
    const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && productOptions.length > 0) { e.preventDefault(); handleSelectCustomer(customerOptions[0].value); }
    };

    const openAddNoteDialog = (order: ProductionOrder) => {
        setNotePayload({ orderId: order.id, notes: '' });
        setAddNoteDialogOpen(true);
    };

    const handleAddNote = async () => {
        if (!notePayload || !notePayload.notes.trim() || !currentUser) return;
        setIsSubmitting(true);
        try {
            await addNoteToOrder({ ...notePayload, updatedBy: currentUser.name });
            toast({ title: "Nota Añadida" });
            setAddNoteDialogOpen(false);
        } catch(error: any) {
            logError("Failed to add note", { error });
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const statusConfig = {
        pending: { label: "Pendiente", color: "bg-yellow-500" },
        approved: { label: "Aprobada", color: "bg-green-500" },
        'in-progress': { label: "En Progreso", color: "bg-blue-500" },
        'on-hold': { label: "En Espera", color: "bg-gray-500" },
        'cancellation-request': { label: "Sol. Cancelación", color: "bg-orange-500" },
        completed: { label: "Completada", color: "bg-teal-500" },
        'received-in-warehouse': { label: "En Bodega", color: "bg-gray-700" },
        canceled: { label: "Cancelada", color: "bg-red-700" },
        ...(dynamicStatusConfig || {}),
    };

    const customerOptions = useMemo(() => {
        if (debouncedCustomerSearch.length < 2) return [];
        const searchLower = debouncedCustomerSearch.toLowerCase();
        return customers.filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower)).map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
    }, [customers, debouncedCustomerSearch]);
    
    const productOptions = useMemo(() => {
        if (debouncedProductSearch.length < 2) return [];
        const searchLower = debouncedProductSearch.toLowerCase();
        return products.filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower)).map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
    }, [products, debouncedProductSearch]);
    
    const classifications = useMemo(() => Array.from(new Set(products.map(p => p.classification).filter(Boolean))), [products]);

    const filteredOrders = useMemo(() => {
        let ordersToFilter = viewingArchived ? archivedOrders : activeOrders;

        // Apply filters only if not viewing archived and a filter is set
        if (!viewingArchived) {
             ordersToFilter = ordersToFilter.filter(order => {
                const product = products.find(p => p.id === order.productId);
                const searchMatch = debouncedSearchTerm ? 
                    order.consecutive.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    order.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    order.productDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    order.purchaseOrder?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                    : true;
                const statusMatch = statusFilter === 'all' || order.status === statusFilter;
                const classificationMatch = classificationFilter === 'all' || (product && product.classification === classificationFilter);
                const dateMatch = !dateFilter || !dateFilter.from || (new Date(order.deliveryDate) >= dateFilter.from && new Date(order.deliveryDate) <= (dateFilter.to || dateFilter.from));
                
                return searchMatch && statusMatch && classificationMatch && dateMatch;
            });
        }
        
        return ordersToFilter;

    }, [viewingArchived, activeOrders, archivedOrders, debouncedSearchTerm, statusFilter, classificationFilter, products, dateFilter]);

    const selectors = {
        hasPermission,
        priorityConfig: { low: { label: "Baja", className: "text-gray-500" }, medium: { label: "Media", className: "text-blue-500" }, high: { label: "Alta", className: "text-yellow-600" }, urgent: { label: "Urgente", className: "text-red-600" }},
        statusConfig,
        getDaysRemaining: (order: ProductionOrder) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (order.scheduledStartDate && order.scheduledEndDate) {
                const startDate = parseISO(order.scheduledStartDate); const endDate = parseISO(order.scheduledEndDate);
                const totalDuration = differenceInCalendarDays(endDate, startDate) + 1;
                const remainingDays = differenceInCalendarDays(endDate, today);
                if (remainingDays < 0) return { label: `Atrasado ${Math.abs(remainingDays)}d`, color: 'text-red-600' }
                const percentageRemaining = totalDuration > 0 ? (remainingDays / totalDuration) : 0;
                let color = 'text-green-600';
                if (percentageRemaining <= 0.25) color = 'text-red-600';
                else if (percentageRemaining <= 0.50) color = 'text-orange-500';
                return { label: remainingDays === 0 ? `Finaliza Hoy (${totalDuration}d)` : `Faltan ${remainingDays} de ${totalDuration}d`, color: color }
            }
            const deliveryDate = parseISO(order.deliveryDate); deliveryDate.setHours(0, 0, 0, 0);
            const days = differenceInCalendarDays(deliveryDate, today);
            let color = 'text-green-600'; if (days <= 2) color = 'text-orange-500'; if (days <= 0) color = 'text-red-600';
            return { label: days === 0 ? 'Para Hoy' : days < 0 ? `Atrasado ${Math.abs(days)}d` : `Faltan ${days}d`, color: color };
        },
        customerOptions,
        productOptions,
        classifications,
        filteredOrders,
        stockLevels,
    };

    return {
        state: {
            isLoading, isSubmitting, isNewOrderDialogOpen, isEditOrderDialogOpen, activeOrders,
            archivedOrders, viewingArchived, archivedPage, pageSize, totalArchived,
            plannerSettings, newOrder, orderToEdit, searchTerm, statusFilter,
            classificationFilter, dateFilter, customerSearchTerm, isCustomerSearchOpen,
            productSearchTerm, isProductSearchOpen, isStatusDialogOpen, orderToUpdate,
            newStatus, statusUpdateNotes, deliveredQuantity, erpPackageNumber, erpTicketNumber,
            isHistoryDialogOpen, historyOrder, history, isHistoryLoading, isReopenDialogOpen,
            reopenStep, reopenConfirmationText, isAddNoteDialogOpen, notePayload,
        },
        actions: {
            setNewOrderDialogOpen, setEditOrderDialogOpen, setViewingArchived, setArchivedPage,
            setPageSize, setNewOrder, setOrderToEdit, setSearchTerm, setStatusFilter,
            setClassificationFilter, setDateFilter, setCustomerSearchTerm, setCustomerSearchOpen,
            setProductSearchTerm, setProductSearchOpen, setStatusDialogOpen, setNewStatus,
            setStatusUpdateNotes, setDeliveredQuantity, setErpPackageNumber, setErpTicketNumber,
            setHistoryDialogOpen, setReopenDialogOpen, setReopenStep, setReopenConfirmationText,
            setAddNoteDialogOpen, setNotePayload, loadInitialData, handleCreateOrder, handleEditOrder,
            openStatusDialog, handleStatusUpdate, handleDetailUpdate, handleOpenHistory,
            handleReopenOrder, handleRejectCancellation, handleSelectProduct, handleSelectCustomer,
            handleProductInputKeyDown, handleCustomerInputKeyDown, openAddNoteDialog, handleAddNote,
        },
        refs: {},
        selectors,
        isAuthorized,
    };
};
