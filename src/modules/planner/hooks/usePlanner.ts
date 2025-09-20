

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getProductionOrders, saveProductionOrder, updateProductionOrder, updateProductionOrderStatus, getOrderHistory, getPlannerSettings, updateProductionOrderDetails, rejectCancellationRequest, addNoteToOrder } from '@/modules/planner/lib/actions';
import type { Customer, Product, ProductionOrder, ProductionOrderStatus, ProductionOrderPriority, ProductionOrderHistoryEntry, User, PlannerSettings, StockInfo, Company, CustomStatus, DateRange, NotePayload, RejectCancellationPayload, UpdateProductionOrderPayload } from '../../core/types';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';
import { getDaysRemaining as getSimpleDaysRemaining } from '@/modules/core/lib/time-utils';

const emptyOrder: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'machineId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate' | 'requestedBy'> = {
    deliveryDate: new Date().toISOString().split('T')[0],
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

const baseStatusConfig: { [key: string]: { label: string, color: string } } = {
    pending: { label: "Pendiente", color: "bg-yellow-500" },
    approved: { label: "Aprobada", color: "bg-green-500" },
    'in-progress': { label: "En Progreso", color: "bg-blue-500" },
    'on-hold': { label: "En Espera", color: "bg-gray-500" },
    'cancellation-request': { label: "Sol. Cancelación", color: "bg-orange-500" },
    completed: { label: "Completada", color: "bg-teal-500" },
    'received-in-warehouse': { label: "En Bodega", color: "bg-gray-700" },
    canceled: { label: "Cancelada", color: "bg-red-700" },
};


export const usePlanner = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['planner:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, companyData: authCompanyData, customers, products, stockLevels: initialStockLevels } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        isNewOrderDialogOpen: false,
        isEditOrderDialogOpen: false,
        activeOrders: [] as ProductionOrder[],
        archivedOrders: [] as ProductionOrder[],
        viewingArchived: false,
        archivedPage: 0,
        pageSize: 50,
        totalArchived: 0,
        plannerSettings: null as PlannerSettings | null,
        stockLevels: initialStockLevels || [] as StockInfo[],
        newOrder: emptyOrder,
        orderToEdit: null as ProductionOrder | null,
        searchTerm: "",
        statusFilter: "all",
        classificationFilter: "all",
        dateFilter: undefined as DateRange | undefined,
        customerSearchTerm: "",
        isCustomerSearchOpen: false,
        productSearchTerm: "",
        isProductSearchOpen: false,
        isStatusDialogOpen: false,
        orderToUpdate: null as ProductionOrder | null,
        newStatus: null as ProductionOrderStatus | null,
        statusUpdateNotes: "",
        deliveredQuantity: "" as number | string,
        erpPackageNumber: "",
        erpTicketNumber: "",
        isHistoryDialogOpen: false,
        historyOrder: null as ProductionOrder | null,
        history: [] as ProductionOrderHistoryEntry[],
        isHistoryLoading: false,
        isReopenDialogOpen: false,
        reopenStep: 0,
        reopenConfirmationText: '',
        dynamicStatusConfig: baseStatusConfig,
        isAddNoteDialogOpen: false,
        notePayload: null as { orderId: number; notes: string } | null,
    });
    
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, authCompanyData?.searchDebounceTime ?? 500);
    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, authCompanyData?.searchDebounceTime ?? 500);
    const [debouncedProductSearch] = useDebounce(state.productSearchTerm, authCompanyData?.searchDebounceTime ?? 500);
    
    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };

    const loadInitialData = useCallback(async (page = 0) => {
        updateState({ isLoading: true });
        try {
            const [ settingsData, ordersData ] = await Promise.all([
                getPlannerSettings(),
                getProductionOrders({
                    page: state.viewingArchived ? page : undefined,
                    pageSize: state.viewingArchived ? state.pageSize : undefined,
                })
            ]);
            
            let newDynamicConfig = { ...baseStatusConfig };
            if (settingsData?.customStatuses) {
                settingsData.customStatuses.forEach(cs => {
                    if (cs.isActive && cs.label) {
                        newDynamicConfig[cs.id as ProductionOrderStatus] = { label: cs.label, color: cs.color };
                    }
                });
            }

            const finalStatus = settingsData?.useWarehouseReception ? 'received-in-warehouse' : 'completed';
            const activeFilter = (o: ProductionOrder) => o.status !== finalStatus && o.status !== 'canceled';

            const allOrders = [...ordersData.activeOrders, ...ordersData.archivedOrders];

            updateState({
                plannerSettings: settingsData,
                stockLevels: initialStockLevels,
                dynamicStatusConfig: newDynamicConfig,
                activeOrders: allOrders.filter(activeFilter),
                archivedOrders: allOrders.filter(o => !activeFilter(o)),
                totalArchived: ordersData.totalArchivedCount,
                isLoading: false,
            });

        } catch (error) {
            logError("Failed to load planner data", { error });
            toast({ title: "Error", description: "No se pudieron cargar los datos del planificador.", variant: "destructive" });
            updateState({ isLoading: false });
        }
    }, [toast, state.viewingArchived, state.pageSize, initialStockLevels]);
    
    useEffect(() => {
        setTitle("Planificador OP");
        if (isAuthorized) {
            loadInitialData(state.archivedPage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTitle, isAuthorized]);
    
    useEffect(() => {
        if (isAuthorized && !state.isLoading) { // Only run if not initial load
             loadInitialData(state.archivedPage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.archivedPage, state.pageSize, state.viewingArchived]);
    
    const actions = {
        setNewOrderDialogOpen: (isOpen: boolean) => updateState({ isNewOrderDialogOpen: isOpen }),
        setEditOrderDialogOpen: (isOpen: boolean) => updateState({ isEditOrderDialogOpen: isOpen }),
        setViewingArchived: (isArchived: boolean) => updateState({ viewingArchived: isArchived, archivedPage: 0 }),
        setArchivedPage: (pageUpdate: (page: number) => number) => updateState({ archivedPage: pageUpdate(state.archivedPage) }),
        setPageSize: (size: number) => updateState({ pageSize: size, archivedPage: 0 }),
        setNewOrder: (partialOrder: Partial<typeof emptyOrder>) => {
            updateState({ newOrder: { ...state.newOrder, ...partialOrder } });
        },
        setOrderToEdit: (partialOrder: Partial<ProductionOrder> | null) => {
            if (!partialOrder) {
                updateState({ orderToEdit: null });
                return;
            }
            setState(prevState => ({ ...prevState, orderToEdit: prevState.orderToEdit ? { ...prevState.orderToEdit, ...partialOrder } : null }));
        },
        setOrderToUpdate: (order: ProductionOrder | null) => updateState({ orderToUpdate: order }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setStatusFilter: (status: string) => updateState({ statusFilter: status }),
        setClassificationFilter: (filter: string) => updateState({ classificationFilter: filter }),
        setDateFilter: (range: DateRange | undefined) => updateState({ dateFilter: range }),
        setCustomerSearchTerm: (term: string) => updateState({ customerSearchTerm: term }),
        setCustomerSearchOpen: (isOpen: boolean) => updateState({ isCustomerSearchOpen: isOpen }),
        setProductSearchTerm: (term: string) => updateState({ productSearchTerm: term }),
        setProductSearchOpen: (isOpen: boolean) => updateState({ isProductSearchOpen: isOpen }),
        setStatusDialogOpen: (isOpen: boolean) => updateState({ isStatusDialogOpen: isOpen }),
        setNewStatus: (status: ProductionOrderStatus | null) => updateState({ newStatus: status }),
        setStatusUpdateNotes: (notes: string) => updateState({ statusUpdateNotes: notes }),
        setDeliveredQuantity: (qty: number | string) => updateState({ deliveredQuantity: qty }),
        setErpPackageNumber: (num: string) => updateState({ erpPackageNumber: num }),
        setErpTicketNumber: (num: string) => updateState({ erpTicketNumber: num }),
        setHistoryDialogOpen: (isOpen: boolean) => updateState({ isHistoryDialogOpen: isOpen }),
        setReopenDialogOpen: (isOpen: boolean) => updateState({ isReopenDialogOpen: isOpen }),
        setReopenStep: (step: number) => updateState({ reopenStep: step }),
        setReopenConfirmationText: (text: string) => updateState({ reopenConfirmationText: text }),
        setAddNoteDialogOpen: (isOpen: boolean) => updateState({ isAddNoteDialogOpen: isOpen }),
        setNotePayload: (payload: { orderId: number; notes: string } | null) => updateState({ notePayload: payload }),
        
        loadInitialData: () => loadInitialData(state.archivedPage),

        handleCreateOrder: async () => {
            if (!state.newOrder.customerId || !state.newOrder.productId || !state.newOrder.quantity || !state.newOrder.deliveryDate || !currentUser) return;
            updateState({ isSubmitting: true });
            try {
                const createdOrder = await saveProductionOrder(state.newOrder, currentUser.name);
                toast({ title: "Orden Creada" });
                setState(prevState => ({
                    ...prevState,
                    isNewOrderDialogOpen: false,
                    newOrder: emptyOrder,
                    customerSearchTerm: '',
                    productSearchTerm: '',
                    activeOrders: [...prevState.activeOrders, createdOrder]
                }));
            } catch (error: any) {
                logError("Failed to create order", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleEditOrder: async (e: React.FormEvent) => {
            e.preventDefault();
            if (!state.orderToEdit?.id || !currentUser) return;
            updateState({ isSubmitting: true });
            try {
                const payload: UpdateProductionOrderPayload = {
                    ...state.orderToEdit,
                    orderId: state.orderToEdit.id,
                    updatedBy: currentUser.name
                };
                const updated = await updateProductionOrder(payload);
                setState(prevState => ({
                    ...prevState,
                    activeOrders: prevState.activeOrders.map(o => o.id === updated.id ? updated : o),
                    isEditOrderDialogOpen: false
                }));
                toast({ title: "Orden Actualizada" });
            } catch (error: any) {
                logError("Failed to edit order", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        openStatusDialog: (order: ProductionOrder, status: ProductionOrderStatus) => {
            if (state.plannerSettings?.requireMachineForStart && status === 'in-progress' && !order.machineId) {
                toast({ title: "Asignación no realizada", description: "Debe asignar una máquina/proceso.", variant: "destructive" });
                return;
            }
            updateState({
                orderToUpdate: order,
                newStatus: status,
                statusUpdateNotes: status === 'cancellation-request' ? "" : ".",
                deliveredQuantity: status === 'completed' ? order.quantity : "",
                erpPackageNumber: "",
                erpTicketNumber: "",
                isStatusDialogOpen: true,
            });
        },

        handleStatusUpdate: async () => {
            if (!state.orderToUpdate || !state.newStatus || !currentUser) return;
            updateState({ isSubmitting: true });
            try {
                const updatedOrder = await updateProductionOrderStatus({ 
                    orderId: state.orderToUpdate.id, 
                    status: state.newStatus, 
                    notes: state.statusUpdateNotes, 
                    updatedBy: currentUser.name, 
                    deliveredQuantity: state.newStatus === 'completed' ? Number(state.deliveredQuantity) : undefined, 
                    erpPackageNumber: state.newStatus === 'received-in-warehouse' ? state.erpPackageNumber : undefined, 
                    erpTicketNumber: state.newStatus === 'received-in-warehouse' ? state.erpTicketNumber : undefined, 
                    reopen: false 
                });
                toast({ title: "Estado Actualizado" });
                updateState(prevState => {
                    const finalStatus = prevState.plannerSettings?.useWarehouseReception ? 'received-in-warehouse' : 'completed';
                    const isArchived = updatedOrder.status === finalStatus || updatedOrder.status === 'canceled';

                    return {
                        isStatusDialogOpen: false,
                        activeOrders: isArchived ? prevState.activeOrders.filter(o => o.id !== updatedOrder.id) : prevState.activeOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o),
                        archivedOrders: isArchived ? [...prevState.archivedOrders, updatedOrder] : prevState.archivedOrders.filter(o => o.id !== updatedOrder.id)
                    };
                });
            } catch (error: any) {
                logError("Failed to update status", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleDetailUpdate: async (orderId: number, details: { priority?: ProductionOrderPriority; machineId?: string | null; scheduledDateRange?: DateRange }) => {
            if (!currentUser) return;
            const finalDetails = {
                ...details,
                machineId: details.machineId === 'none' ? null : details.machineId
            };
            const updated = await updateProductionOrderDetails({ orderId, ...finalDetails, updatedBy: currentUser.name });
            updateState({ 
                activeOrders: state.activeOrders.map(o => o.id === orderId ? updated : o),
                archivedOrders: state.archivedOrders.map(o => o.id === orderId ? updated : o)
            });
        },
        
        handleOpenHistory: async (order: ProductionOrder) => {
            updateState({ historyOrder: order, isHistoryDialogOpen: true, isHistoryLoading: true });
            try {
                updateState({ history: await getOrderHistory(order.id) });
            } catch (error: any) {
                logError("Failed to get history", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isHistoryLoading: false });
            }
        },
        
        handleReopenOrder: async () => {
            if (!state.orderToUpdate || !currentUser || state.reopenStep !== 2 || state.reopenConfirmationText !== 'REABRIR') return;
            updateState({ isSubmitting: true });
            try {
                await updateProductionOrderStatus({ orderId: state.orderToUpdate.id, status: 'pending', notes: 'Orden reabierta.', updatedBy: currentUser.name, reopen: true });
                toast({ title: "Orden Reabierta" });
                updateState({ isReopenDialogOpen: false });
                await loadInitialData();
            } catch (error: any) {
                logError("Failed to reopen order", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleRejectCancellation: async (order: ProductionOrder) => {
            if (!currentUser) return;
            updateState({ isSubmitting: true });
            try {
                await rejectCancellationRequest({ entityId: order.id, notes: 'Solicitud de cancelación rechazada.', updatedBy: currentUser.name });
                await loadInitialData();
                toast({ title: 'Solicitud Rechazada' });
            } catch (error: any) {
                 logError("Failed to reject cancellation", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleSelectProduct: (value: string) => {
            updateState({ isProductSearchOpen: false });
            const product = products.find(p => p.id === value);
            if (product) {
                const stock = state.stockLevels.find(s => s.itemId === product.id)?.totalStock ?? 0;
                if (state.orderToEdit) actions.setOrderToEdit({ ...state.orderToEdit, productId: product.id, productDescription: product.description || '', inventory: stock });
                else actions.setNewOrder({ ...state.newOrder, productId: product.id, productDescription: product.description || '', inventory: stock });
                updateState({ productSearchTerm: `[${product.id}] - ${product.description}` });
            }
        },
    
        handleSelectCustomer: (value: string) => {
            updateState({ isCustomerSearchOpen: false });
            const customer = customers.find(c => c.id === value);
            if (customer) {
                if (state.orderToEdit) actions.setOrderToEdit({ ...state.orderToEdit, customerId: customer.id, customerName: customer.name });
                else actions.setNewOrder({ ...state.newOrder, customerId: customer.id, customerName: customer.name });
                updateState({ customerSearchTerm: `${customer.id} - ${customer.name}` });
            }
        },

        handleProductInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && selectors.productOptions.length > 0) { e.preventDefault(); actions.handleSelectProduct(selectors.productOptions[0].value); }
        },
        handleCustomerInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && selectors.customerOptions.length > 0) { e.preventDefault(); actions.handleSelectCustomer(selectors.customerOptions[0].value); }
        },
        
        openAddNoteDialog: (order: ProductionOrder) => {
            updateState({ notePayload: { orderId: order.id, notes: '' }, isAddNoteDialogOpen: true });
        },
    
        handleAddNote: async () => {
            if (!state.notePayload || !state.notePayload.notes.trim() || !currentUser) return;
            updateState({ isSubmitting: true });
            try {
                const updatedOrder = await addNoteToOrder({ ...state.notePayload, updatedBy: currentUser.name });
                toast({ title: "Nota Añadida" });
                updateState(prevState => ({
                    isAddNoteDialogOpen: false,
                    activeOrders: prevState.activeOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o),
                    archivedOrders: prevState.archivedOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
                }));
            } catch(error: any) {
                logError("Failed to add note", { error });
                toast({ title: "Error", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },
    };

    const selectors = {
        hasPermission,
        priorityConfig: { low: { label: "Baja", className: "text-gray-500" }, medium: { label: "Media", className: "text-blue-500" }, high: { label: "Alta", className: "text-yellow-600" }, urgent: { label: "Urgente", className: "text-red-600" }},
        statusConfig: state.dynamicStatusConfig,
        getDaysRemaining: (dateStr: string) => getSimpleDaysRemaining(dateStr),
        getScheduledDaysRemaining: (order: ProductionOrder) => {
            if (!order.scheduledStartDate || !order.scheduledEndDate) {
                return { label: 'Sin Programar', color: 'text-gray-500' };
            }
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const startDate = parseISO(order.scheduledStartDate);
                const endDate = parseISO(order.scheduledEndDate);
                
                const totalDuration = differenceInCalendarDays(endDate, startDate) + 1;
                const remainingDays = differenceInCalendarDays(endDate, today);

                if (remainingDays < 0) {
                    return { label: `Atrasado ${Math.abs(remainingDays)}d`, color: 'text-red-600' };
                }
                
                const percentageRemaining = totalDuration > 0 ? (remainingDays / totalDuration) : 0;
                let color = 'text-green-600';
                if (percentageRemaining <= 0.25) color = 'text-red-600';
                else if (percentageRemaining <= 0.50) color = 'text-orange-500';

                return { label: `Faltan ${remainingDays} de ${totalDuration}d`, color };
            } catch (error) {
                return { label: 'Fecha inv.', color: 'text-red-600' };
            }
        },
        customerOptions: useMemo(() => {
            if (debouncedCustomerSearch.length < 2) return [];
            const searchLower = debouncedCustomerSearch.toLowerCase();
            return customers.filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower)).map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
        }, [customers, debouncedCustomerSearch]),
        productOptions: useMemo(() => {
            if (debouncedProductSearch.length < 2) return [];
            const searchLower = debouncedProductSearch.toLowerCase();
            return products.filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower)).map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
        }, [products, debouncedProductSearch]),
        classifications: useMemo<string[]>(() => 
            Array.from(new Set(products.map(p => p.classification).filter(Boolean)))
        , [products]),
        filteredOrders: useMemo(() => {
            let ordersToFilter = state.viewingArchived ? state.archivedOrders : state.activeOrders;
            
            return ordersToFilter.filter(order => {
                const product = products.find(p => p.id === order.productId);
                const searchMatch = debouncedSearchTerm ? 
                    order.consecutive.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    order.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                    order.productDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    order.purchaseOrder?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                    : true;
                const statusMatch = state.statusFilter === 'all' || order.status === state.statusFilter;
                const classificationMatch = state.classificationFilter === 'all' || (product && product.classification === state.classificationFilter);
                const dateMatch = !state.dateFilter || !state.dateFilter.from || (new Date(order.deliveryDate) >= state.dateFilter.from && new Date(order.deliveryDate) <= (state.dateFilter.to || state.dateFilter.from));
                
                return searchMatch && statusMatch && classificationMatch && dateMatch;
            });
        }, [state.viewingArchived, state.activeOrders, state.archivedOrders, debouncedSearchTerm, state.statusFilter, state.classificationFilter, products, state.dateFilter]),
        stockLevels: state.stockLevels,
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
    };
};
