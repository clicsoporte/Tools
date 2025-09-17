// FINAL VALIDATION CHECK
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, FilePlus, Loader2, Check, MoreVertical, History, RefreshCcw, AlertTriangle, PackageCheck, Factory, ShieldAlert, XCircle, Undo2, Boxes, FileDown, Pencil, CalendarIcon, FilterX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getAllCustomers, getAllProducts, getAllStock, getStockSettings } from '@/modules/core/lib/db-client';
import { getProductionOrders, saveProductionOrder, updateProductionOrder, updateProductionOrderStatus, getOrderHistory, getPlannerSettings, updateProductionOrderDetails, rejectCancellationRequest } from '@/modules/planner/lib/db-client';
import type { Customer, Product, ProductionOrder, ProductionOrderStatus, ProductionOrderPriority, ProductionOrderHistoryEntry, User, PlannerSettings, StockInfo, Warehouse, StockSettings, Company, CustomStatus } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { SearchInput } from '@/components/ui/search-input';
import { useDebounce } from 'use-debounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DateRange } from 'react-day-picker';

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

const priorityConfig: { [key in ProductionOrderPriority]: { label: string; className: string } } = {
    low: { label: "Baja", className: "text-gray-500" },
    medium: { label: "Media", className: "text-blue-500" },
    high: { label: "Alta", className: "text-yellow-600" },
    urgent: { label: "Urgente", className: "text-red-600" },
};

const statusConfig: { [key in ProductionOrderStatus]?: { label: string; color: string } } = {
    pending: { label: "Pendiente", color: "bg-yellow-500" },
    approved: { label: "Aprobada", color: "bg-green-500" },
    'in-progress': { label: "En Progreso", color: "bg-blue-500" },
    'on-hold': { label: "En Espera", color: "bg-gray-500" },
    'cancellation-request': { label: "Solicitud de Cancelación", color: "bg-orange-600" },
    completed: { label: "Completada", color: "bg-teal-500" },
    'received-in-warehouse': { label: "Recibido en Bodega", color: "bg-gray-700" },
    canceled: { label: "Cancelada", color: "bg-red-700" },
};

export default function PlannerPage() {
    const { isAuthorized, hasPermission } = useAuthorization(['planner:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user: currentUser, companyData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isNewOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
    const [isEditOrderDialogOpen, setEditOrderDialogOpen] = useState(false);
    const [activeOrders, setActiveOrders] = useState<ProductionOrder[]>([]);
    const [archivedOrders, setArchivedOrders] = useState<ProductionOrder[]>([]);
    const [viewingArchived, setViewingArchived] = useState(false);
    const [archivedPage, setArchivedPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalArchived, setTotalArchived] = useState(0);
    const [plannerSettings, setPlannerSettings] = useState<PlannerSettings | null>(null);
    const [stockSettings, setStockSettings] = useState<StockSettings | null>(null);
    
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [stockLevels, setStockLevels] = useState<StockInfo[]>([]);
    
    const [newOrder, setNewOrder] = useState(emptyOrder);
    const [orderToEdit, setOrderToEdit] = useState<ProductionOrder | null>(null);

    // State for filtering
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [classificationFilter, setClassificationFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined);
    const [debouncedSearchTerm] = useDebounce(searchTerm, companyData?.searchDebounceTime ?? 500);

    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [isProductSearchOpen, setProductSearchOpen] = useState(false);
    const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedProductSearch] = useDebounce(productSearchTerm, companyData?.searchDebounceTime ?? 500);
    
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

    // Reopen dialog state
    const [isReopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [reopenStep, setReopenStep] = useState(0);
    const [reopenConfirmationText, setReopenConfirmationText] = useState('');

    const [isStockDetailOpen, setIsStockDetailOpen] = useState(false);
    const [stockDetailItem, setStockDetailItem] = useState<StockInfo | null>(null);

    // Dynamic status configuration
    const [dynamicStatusConfig, setDynamicStatusConfig] = useState<{[key: string]: {label: string, color: string}}>(statusConfig as any);

    useEffect(() => {
        if(plannerSettings?.customStatuses) {
            const newConfig = {...statusConfig};
            plannerSettings.customStatuses.forEach(cs => {
                if(cs.isActive && cs.label) {
                    newConfig[cs.id] = { label: cs.label, color: cs.color };
                }
            });
            setDynamicStatusConfig(newConfig as any);
        }
    }, [plannerSettings]);

    useEffect(() => {
        setTitle("Planificador OP");
    }, [setTitle]);

    const loadPlannerData = useCallback(async (page = 0) => {
        setIsLoading(true);
        try {
            const filters = {
                searchTerm: debouncedSearchTerm,
                status: statusFilter,
                classification: classificationFilter,
                dateRange: dateFilter,
                productIds: (classificationFilter !== 'all' && products.length > 0)
                    ? products.filter(p => p.classification === classificationFilter).map(p => p.id)
                    : undefined
            };

            const { activeOrders, archivedOrders, totalArchivedCount } = await getProductionOrders({
                page: viewingArchived ? page : undefined,
                pageSize: viewingArchived ? pageSize : undefined,
                filters: viewingArchived ? filters : undefined
            });

            if (!viewingArchived) {
                // If not viewing archived, we get all active orders and filter them on the client
                setActiveOrders(activeOrders);
            } else {
                // If viewing archived, the server has already filtered and paginated
                setArchivedOrders(archivedOrders);
            }
            
            setTotalArchived(totalArchivedCount);
            
            // Only fetch settings if they are not already loaded
            if (!plannerSettings) {
                const settings = await getPlannerSettings();
                setPlannerSettings(settings);
            }
            if (!stockSettings) {
                const stockSettingsData = await getStockSettings();
                setStockSettings(stockSettingsData);
            }

        } catch (error) {
            logError("Failed to load planner orders", { error });
            toast({ title: "Error", description: "No se pudieron cargar las órdenes de producción.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, viewingArchived, pageSize, plannerSettings, stockSettings, debouncedSearchTerm, statusFilter, classificationFilter, dateFilter, products]);
    
    useEffect(() => {
        if (isAuthorized) {
            loadPlannerData(archivedPage);
        }
    }, [isAuthorized, loadPlannerData, archivedPage, debouncedSearchTerm, statusFilter, classificationFilter, dateFilter]);
    
    useEffect(() => {
        if (isAuthorized === null) return;
        
        const loadSupportingData = async () => {
            setIsLoading(true);
            try {
                const [customersData, productsData, stockData] = await Promise.all([
                    getAllCustomers(),
                    getAllProducts(),
                    getAllStock(),
                ]);
                setCustomers(customersData);
                setProducts(productsData);
                setStockLevels(stockData);
            } catch (error) {
                logError("Failed to load planner initial data", { error });
                toast({ title: "Error", description: "No se pudieron cargar los datos de clientes y productos.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthorized) {
            loadSupportingData();
        }
    }, [isAuthorized, toast]);

    const customerOptions = useMemo(() => {
        if (debouncedCustomerSearch.length < 2) return [];
        const searchLower = debouncedCustomerSearch.toLowerCase();
        return customers
            .filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower))
            .map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
    }, [customers, debouncedCustomerSearch]);
    
    const productOptions = useMemo(() => {
        if (debouncedProductSearch.length < 2) return [];
        const searchLower = debouncedProductSearch.toLowerCase();
        return products
            .filter(p => p.id.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower))
            .map(p => ({ value: p.id, label: `[${p.id}] - ${p.description}` }));
    }, [products, debouncedProductSearch]);

    const handleCreateOrder = async () => {
        if (!newOrder.customerId || !newOrder.productId || !newOrder.quantity || !newOrder.deliveryDate) {
            toast({ title: "Campos requeridos", description: "Cliente, producto, cantidad y fecha de entrega son obligatorios.", variant: "destructive" });
            return;
        }
        
        if (!currentUser) {
            toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await saveProductionOrder(newOrder, currentUser.name);
            toast({ title: "Orden Creada", description: `La orden para ${newOrder.customerName} ha sido creada.` });
            await logInfo("Production order created", { product: newOrder.productDescription });
            setNewOrderDialogOpen(false);
            setNewOrder(emptyOrder);
            setProductSearchTerm("");
            setCustomerSearchTerm("");
            await loadPlannerData();
        } catch (error: any) {
            logError("Failed to create production order", { error: error.message });
            toast({ title: "Error al Crear", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderToEdit || !currentUser) return;
        
        if (!orderToEdit.customerId || !orderToEdit.productId || !orderToEdit.quantity || !orderToEdit.deliveryDate) {
            toast({ title: "Campos requeridos", description: "Cliente, producto, cantidad y fecha de entrega son obligatorios.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const updatedOrder = await updateProductionOrder({
                orderId: orderToEdit.id,
                updatedBy: currentUser.name,
                deliveryDate: orderToEdit.deliveryDate,
                customerId: orderToEdit.customerId,
                customerName: orderToEdit.customerName,
                productId: orderToEdit.productId,
                productDescription: orderToEdit.productDescription,
                quantity: orderToEdit.quantity,
                inventory: orderToEdit.inventory,
                notes: orderToEdit.notes,
                purchaseOrder: orderToEdit.purchaseOrder,
            });
            
            setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            setArchivedOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

            toast({ title: "Orden Actualizada", description: `La orden ${orderToEdit.consecutive} ha sido guardada.` });
            await logInfo("Production order updated", { order: orderToEdit.consecutive });
            setEditOrderDialogOpen(false);
            setOrderToEdit(null);
        } catch (error: any) {
            logError("Failed to edit production order", { error: error.message });
            toast({ title: "Error al Editar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const openStatusDialog = (order: ProductionOrder, status: ProductionOrderStatus) => {
        if (plannerSettings?.requireMachineForStart && status === 'in-progress' && !order.machineId) {
            toast({
                title: "Asignación no realizada",
                description: `Debe realizar una asignación (${plannerSettings.assignmentLabel}) a esta orden antes de poder iniciarla.`,
                variant: "destructive",
            });
            return;
        }

        setOrderToUpdate(order);
        setNewStatus(status);
        setStatusUpdateNotes(status === 'cancellation-request' ? "" : "."); // Clear notes for cancellation request
        setDeliveredQuantity(status === 'completed' ? order.quantity : "");
        setErpPackageNumber("");
        setErpTicketNumber("");
        setStatusDialogOpen(true);
    };
    
    const handleStatusUpdate = async () => {
        if (!orderToUpdate || !newStatus || !currentUser) return;

        let finalDeliveredQuantity: number | undefined = undefined;
        
        if (newStatus === 'cancellation-request' && !statusUpdateNotes.trim()) {
            toast({ title: "Motivo Requerido", description: "Debe indicar el motivo de la solicitud de cancelación en las notas.", variant: "destructive" });
            return;
        }

        if (newStatus === 'completed') {
            const qty = parseFloat(String(deliveredQuantity));
            if (isNaN(qty) || qty < 0) {
                toast({ title: "Cantidad inválida", description: "Por favor, introduce un número válido para la cantidad entregada.", variant: "destructive" });
                return;
            }
            finalDeliveredQuantity = qty;
        }

        if (newStatus === 'received-in-warehouse' && (!erpPackageNumber || !erpTicketNumber)) {
            toast({ title: "Datos Requeridos", description: "El Nº de Paquete y Nº de Boleta son requeridos para recibir en bodega.", variant: "destructive" });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const updatedOrder = await updateProductionOrderStatus({
                orderId: orderToUpdate.id,
                status: newStatus,
                notes: statusUpdateNotes,
                updatedBy: currentUser.name,
                deliveredQuantity: finalDeliveredQuantity,
                erpPackageNumber: newStatus === 'received-in-warehouse' ? erpPackageNumber : undefined,
                erpTicketNumber: newStatus === 'received-in-warehouse' ? erpTicketNumber : undefined,
                reopen: false,
            });
            
            setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            setArchivedOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

            toast({ title: "Estado Actualizado", description: `La orden ${orderToUpdate.consecutive} ahora está ${dynamicStatusConfig[newStatus]?.label}.` });
            await logInfo("Production order status updated", { order: orderToUpdate.consecutive, newStatus: newStatus });
            setStatusDialogOpen(false);
        } catch (error: any) {
            logError("Failed to update order status", { error: error.message });
            toast({ title: "Error al Actualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDetailUpdate = async (orderId: number, details: { priority?: ProductionOrderPriority; machineId?: string | null; scheduledDateRange?: DateRange }) => {
        if (!currentUser) return;
        
        const originalOrder = activeOrders.find(o => o.id === orderId) || archivedOrders.find(o => o.id === orderId);
        if (!originalOrder) return;
        
        const updatedOrder = await updateProductionOrderDetails({
            orderId,
            ...details,
            updatedBy: currentUser.name
        });

        const newActiveOrders = activeOrders.map(o => o.id === orderId ? updatedOrder : o);
        const newArchivedOrders = archivedOrders.map(o => o.id === orderId ? updatedOrder : o);
        setActiveOrders(newActiveOrders);
        setArchivedOrders(newArchivedOrders);
            
        await logInfo("Production order details updated", { orderId, details });
    }

    const handleOpenHistory = async (order: ProductionOrder) => {
        setHistoryOrder(order);
        setHistoryDialogOpen(true);
        setIsHistoryLoading(true);
        try {
            const historyData = await getOrderHistory(order.id);
            setHistory(historyData);
        } catch (error: any) {
            logError("Failed to get order history", { error: error.message });
            toast({ title: "Error", description: "No se pudo cargar el historial de la orden.", variant: "destructive" });
        } finally {
            setIsHistoryLoading(false);
        }
    };
    
    const handleReopenOrder = async () => {
        if (!orderToUpdate || !currentUser || reopenStep !== 2 || reopenConfirmationText !== 'REABRIR') return;

        setIsSubmitting(true);
        try {
            await updateProductionOrderStatus({
                orderId: orderToUpdate.id,
                status: 'pending',
                notes: 'Orden reabierta por el administrador.',
                updatedBy: currentUser.name,
                reopen: true,
            });
            
            toast({ title: "Orden Reabierta", description: `La orden ${orderToUpdate.consecutive} ha sido movida a pendientes.` });
            await logInfo("Production order reopened", { order: orderToUpdate.consecutive });
            setReopenDialogOpen(false);
            setReopenStep(0);
            setReopenConfirmationText('');
            await loadPlannerData();
        } catch (error: any) {
            logError("Failed to reopen order", { error: error.message });
            toast({ title: "Error al Reabrir", description: error.message, variant: "destructive" });
            await loadPlannerData(); // Fallback to full reload on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectCancellation = async (order: ProductionOrder) => {
        if (!currentUser) return;
        setIsSubmitting(true);
        try {
            await rejectCancellationRequest({
                orderId: order.id,
                notes: 'La solicitud de cancelación fue rechazada.',
                updatedBy: currentUser.name,
            });
            await loadPlannerData(); // Full reload to ensure consistency
            toast({ title: 'Solicitud Rechazada', description: `La orden ${order.consecutive} ha sido devuelta a su estado anterior.` });
            await logInfo('Cancellation request rejected', { orderId: order.id });
        } catch (error: any) {
             logError("Failed to reject cancellation request", { error: error.message });
            toast({ title: "Error al Rechazar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleSelectProduct = (value: string) => {
        setProductSearchOpen(false);
        const product = products.find(p => p.id === value);
        if (product) {
            const productWithStock = { ...product, inventory: stockLevels.find(s => s.itemId === product.id)?.totalStock ?? 0 };
            const fullDescription = `[${productWithStock.id}] - ${productWithStock.description}`;
            if (orderToEdit) {
                 setOrderToEdit(prev => prev ? { ...prev, productId: productWithStock.id, productDescription: productWithStock.description || '', inventory: productWithStock.inventory } : null);
            } else {
                 setNewOrder(prev => ({ ...prev, productId: productWithStock.id, productDescription: productWithStock.description || '', inventory: productWithStock.inventory }));
            }
            setProductSearchTerm(fullDescription);
        } else {
            setProductSearchTerm('');
        }
    };

    const handleSelectCustomer = (value: string) => {
        setCustomerSearchOpen(false);
        const customer = customers.find(c => c.id === value);
        if (customer) {
            const fullDescription = `${customer.id} - ${customer.name}`;
            if (orderToEdit) {
                setOrderToEdit(prev => prev ? { ...prev, customerId: customer.id, customerName: customer.name } : null);
            } else {
                setNewOrder(prev => ({ ...prev, customerId: customer.id, customerName: customer.name }));
            }
            setCustomerSearchTerm(fullDescription);
        } else {
            setCustomerSearchTerm('');
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        toast({ title: "Actualizando datos..." });
        await loadPlannerData();
        toast({ title: "Datos actualizados", description: "Se han cargado las órdenes más recientes." });
        setIsRefreshing(false);
    }

    const openStockDetail = (itemId: string) => {
        const stockInfo = stockLevels.find(s => s.itemId === itemId);
        if (stockInfo) {
            setStockDetailItem(stockInfo);
            setIsStockDetailOpen(true);
        } else {
            toast({ title: "Sin desglose", description: "No se encontró desglose de inventario para este artículo." });
        }
    }

    const handleExportListPDF = () => {
        if (!companyData) {
            toast({ title: "Error", description: "Datos de la empresa no cargados.", variant: "destructive" });
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape' });
        const addHeader = (doc: jsPDF) => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text("Lista de Órdenes de Producción Activas", pageWidth / 2, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(companyData.name, margin, 22);
            doc.text(`Fecha de Exportación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 22, { align: 'right' });
        };

        const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            doc.setFontSize(8);
            doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        };

        addHeader(doc);

        const tableColumn = ["Nº Orden", "Nº OC", "Cliente", "Producto", "Cant.", "F. Entrega", "Prioridad", "Estado", plannerSettings?.assignmentLabel || 'Máquina'];
        const tableRows: any[][] = [];

        filteredOrders.forEach(order => {
            const machineName = order.machineId ? plannerSettings?.machines.find(m => m.id === order.machineId)?.name || order.machineId : 'N/A';
            const orderData = [
                order.consecutive,
                order.purchaseOrder || 'N/A',
                order.customerName,
                `[${order.productId}] ${order.productDescription}`,
                order.quantity.toLocaleString(),
                format(parseISO(order.deliveryDate), 'dd/MM/yyyy'),
                priorityConfig[order.priority].label,
                dynamicStatusConfig[order.status]?.label,
                machineName,
            ];
            tableRows.push(orderData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
             didDrawPage: (data) => {
                 if (data.pageNumber > 1) addHeader(doc);
                 addFooter(doc, data.pageNumber, (doc as any).internal.getNumberOfPages());
            },
        });

        doc.save('ordenes_produccion_activas.pdf');
        logInfo("Active production order list exported to PDF");
    };

    const handleExportSingleOrderPDF = async (order: ProductionOrder) => {
        const doc = new jsPDF();
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Orden de Producción", pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(12);
        doc.text(order.consecutive, pageWidth - margin, 22, { align: 'right' });

        // Details
        let startY = 40;
        const addDetail = (label: string, value?: string | number | null) => {
            if (value || value === 0) { // Check for 0 as well
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`${label}:`, margin, startY);
                doc.setFont('helvetica', 'normal');
                doc.text(String(value), margin + 45, startY);
                startY += 7;
            }
        }
        
        addDetail("Cliente", order.customerName);
        addDetail("Producto", `[${order.productId}] ${order.productDescription}`);
        addDetail("Nº OC Cliente", order.purchaseOrder);
        addDetail("Cantidad Solicitada", order.quantity.toLocaleString());
        
        if (order.deliveredQuantity !== null && order.deliveredQuantity !== undefined) {
            addDetail("Cantidad Entregada", order.deliveredQuantity.toLocaleString());
            addDetail("Diferencia", (order.deliveredQuantity - order.quantity).toLocaleString());
        }

        addDetail("Fecha de Entrega", format(parseISO(order.deliveryDate), 'dd/MM/yyyy'));
        addDetail("Estado Actual", dynamicStatusConfig[order.status]?.label);
        addDetail("Prioridad", priorityConfig[order.priority].label);
        if (order.machineId) {
            const machine = plannerSettings?.machines.find(m => m.id === order.machineId);
            addDetail(plannerSettings?.assignmentLabel || "Máquina", machine?.name || order.machineId);
        }
        addDetail("Notas", order.notes);

        // History
        if (startY > 180) doc.addPage();
        startY += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Historial de Cambios", margin, startY);
        startY += 8;

        const historyData = await getOrderHistory(order.id);
        const tableColumn = ["Fecha", "Estado", "Usuario", "Notas"];
        const tableRows: any[][] = historyData.map(entry => [
            format(parseISO(entry.timestamp), 'dd/MM/yy HH:mm'),
            dynamicStatusConfig[entry.status]?.label || entry.status,
            entry.updatedBy,
            entry.notes || ""
        ]);
        
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: startY,
            theme: 'grid',
        });


        doc.save(`OP-${order.consecutive}.pdf`);
        logInfo(`Production order ${order.consecutive} exported to PDF`);
    };

    const handleProductInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && productOptions.length > 0) {
            e.preventDefault();
            handleSelectProduct(productOptions[0].value);
        }
    };
    const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && customerOptions.length > 0) {
            e.preventDefault();
            handleSelectCustomer(customerOptions[0].value);
        }
    };

    const classifications = useMemo(() => {
        const classSet = new Set(products.map(p => p.classification).filter(Boolean));
        return Array.from(classSet);
    }, [products]);

    const filteredOrders = useMemo(() => {
        if (viewingArchived) {
            // For archived, the server does the filtering, so we just return the data.
            return archivedOrders;
        }

        // For active, we filter on the client-side as we fetch all of them.
        return activeOrders.filter(order => {
            const product = products.find(p => p.id === order.productId);
            const searchMatch = debouncedSearchTerm 
                ? order.consecutive.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                  order.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                  order.productDescription.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            
            const statusMatch = statusFilter === 'all' || order.status === statusFilter;
            
            const classificationMatch = classificationFilter === 'all' || (product && product.classification === classificationFilter);

            const dateMatch = !dateFilter || !dateFilter.from || (
                new Date(order.deliveryDate) >= dateFilter.from &&
                new Date(order.deliveryDate) <= (dateFilter.to || dateFilter.from)
            );

            return searchMatch && statusMatch && classificationMatch && dateMatch;
        });
    }, [viewingArchived, activeOrders, archivedOrders, debouncedSearchTerm, statusFilter, classificationFilter, products, dateFilter]);

    const renderOrderCard = (order: ProductionOrder) => {
        const canBeReopened = hasPermission('planner:reopen') && (
            (plannerSettings?.useWarehouseReception && (order.status === 'received-in-warehouse' || order.status === 'canceled')) ||
            (!plannerSettings?.useWarehouseReception && (order.status === 'completed' || order.status === 'canceled'))
        );
        const canApprove = hasPermission('planner:status:approve') && order.status === 'pending';
        const canStart = hasPermission('planner:status:in-progress') && (order.status === 'approved' || order.status === 'on-hold' || order.status.startsWith('custom-'));
        const canHold = hasPermission('planner:status:on-hold') && ['in-progress', 'approved'].includes(order.status);
        const canComplete = hasPermission('planner:status:completed') && order.status === 'in-progress';
        const canReceive = hasPermission('planner:receive') && order.status === 'completed' && plannerSettings?.useWarehouseReception;
        const canUpdateDetails = hasPermission('planner:priority:update') || hasPermission('planner:machine:assign');
        const canAssignMachine = hasPermission('planner:machine:assign') && !['pending', 'completed', 'received-in-warehouse', 'canceled'].includes(order.status);
        
        const canEditPending = hasPermission('planner:edit:pending') && order.status === 'pending';
        const canEditApproved = hasPermission('planner:edit:approved') && !['pending', 'completed', 'received-in-warehouse', 'canceled'].includes(order.status);
        const canEdit = canEditPending || canEditApproved;
        
        const canCancelDirectly = hasPermission('planner:status:cancel-approved');
        const canRequestCancel = hasPermission('planner:status:cancel') && !canCancelDirectly;
        
        const showCancelFlow = !['pending', 'completed', 'received-in-warehouse', 'canceled', 'cancellation-request'].includes(order.status);

        const defaultWarehouseId = stockSettings?.warehouses.find(w => w.isDefault)?.id;
        const stockInfo = stockLevels.find(s => s.itemId === order.productId);
        const defaultStock = defaultWarehouseId && stockInfo ? stockInfo.stockByWarehouse[defaultWarehouseId] ?? 0 : stockInfo?.totalStock ?? 0;
        const defaultWarehouseName = defaultWarehouseId ? stockSettings?.warehouses.find(w => w.id === defaultWarehouseId)?.name : 'Total';

        const customStatusActions = plannerSettings?.customStatuses
            .filter(cs => cs.isActive && cs.label)
            .map(cs => (
                <Button key={cs.id} variant="ghost" className="justify-start" style={{color: cs.color}} onClick={() => openStatusDialog(order, cs.id)}>{cs.label}</Button>
            ));
            
        return (
            <Card key={order.id} className="w-full">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <CardTitle className="text-lg">{order.consecutive} - [{order.productId}] {order.productDescription}</CardTitle>
                            <CardDescription>{order.customerName}{order.purchaseOrder && ` (OC: ${order.purchaseOrder})`}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            {order.reopened && <Badge variant="destructive"><RefreshCcw className="mr-1 h-3 w-3" /> Reabierta</Badge>}
                             <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(order)}><History className="h-4 w-4" /></Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-1">
                                    <div className="grid grid-cols-1">
                                        <Button variant="ghost" className="justify-start" onClick={() => handleExportSingleOrderPDF(order)}><FileDown className="mr-2"/> Exportar a PDF</Button>
                                        
                                        {canEdit && <Button variant="ghost" className="justify-start" onClick={() => { setOrderToEdit(order); setEditOrderDialogOpen(true); }}><Pencil className="mr-2"/> Editar Orden</Button>}
                                        
                                        <Separator className="my-1"/>
                                        
                                        {canApprove && <Button variant="ghost" className="justify-start text-green-600" onClick={() => openStatusDialog(order, 'approved')}><Check className="mr-2"/> Aprobar</Button>}
                                        {canStart && <Button variant="ghost" className="justify-start" onClick={() => openStatusDialog(order, 'in-progress')}>Iniciar</Button>}
                                        {canHold && <Button variant="ghost" className="justify-start" onClick={() => openStatusDialog(order, 'on-hold')}>Poner en Espera</Button>}
                                        {customStatusActions}
                                        {canComplete && <Button variant="ghost" className="justify-start" onClick={() => openStatusDialog(order, 'completed')}>Completar</Button>}
                                        {canReceive && <Button variant="ghost" className="justify-start text-indigo-600" onClick={() => openStatusDialog(order, 'received-in-warehouse')}><PackageCheck className="mr-2"/> Recibir en Bodega</Button>}
                                        
                                        <Separator className="my-1"/>
                                        
                                        {canBeReopened && <Button variant="ghost" className="justify-start text-orange-600" onClick={() => { setOrderToUpdate(order); setReopenDialogOpen(true); }}><RefreshCcw className="mr-2"/> Reabrir</Button>}
                                        
                                        {order.status === 'pending' && hasPermission('planner:status:cancel') && 
                                            <Button variant="ghost" className="justify-start text-red-600" onClick={() => openStatusDialog(order, 'canceled')}>Cancelar</Button>
                                        }

                                        {showCancelFlow && canCancelDirectly &&
                                            <Button variant="ghost" className="justify-start text-red-600" onClick={() => openStatusDialog(order, 'canceled')}>Cancelar Orden Aprobada</Button>
                                        }
                                        
                                        {order.status === 'cancellation-request' && canCancelDirectly &&
                                            <>
                                                <Button variant="ghost" className="justify-start text-red-600" onClick={() => openStatusDialog(order, 'canceled')}>Confirmar Cancelación</Button>
                                                <Button variant="ghost" className="justify-start" onClick={() => handleRejectCancellation(order)}><Undo2 className="mr-2"/> Rechazar Solicitud</Button>
                                            </>
                                        }

                                        {showCancelFlow && canRequestCancel &&
                                             <Button variant="ghost" className="justify-start text-orange-600" onClick={() => openStatusDialog(order, 'cancellation-request')}>
                                                <ShieldAlert className="mr-2"/>
                                                Solicitar Cancelación
                                            </Button>
                                        }
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b pb-4">
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Inventario ERP ({defaultWarehouseName})</p>
                                <div className="flex items-center gap-1">
                                    <p className="font-bold text-lg">{defaultStock.toLocaleString() ?? 'N/A'}</p>
                                    {stockInfo && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openStockDetail(order.productId)}><Boxes className="h-4 w-4"/></Button>}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Cant. Solicitada</p>
                                <p className="font-bold text-lg">{order.quantity.toLocaleString()}</p>
                            </div>
                            {order.deliveredQuantity !== null && order.deliveredQuantity !== undefined && (
                                <>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-muted-foreground">Cant. Entregada</p>
                                        <p className="font-bold text-lg text-green-600">{order.deliveredQuantity.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-muted-foreground">Diferencia</p>
                                        <p className={cn(
                                            "font-bold text-lg",
                                            (order.deliveredQuantity - order.quantity) > 0 && "text-blue-600",
                                            (order.deliveredQuantity - order.quantity) < 0 && "text-destructive"
                                        )}>
                                            {(order.deliveredQuantity - order.quantity).toLocaleString()}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 text-sm pt-4">
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Estado Actual</p>
                                <div className="flex items-center gap-2">
                                    <span className={cn("h-3 w-3 rounded-full", dynamicStatusConfig[order.status]?.color)}></span>
                                    <span className="font-medium">{dynamicStatusConfig[order.status]?.label}</span>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Fecha de Entrega</p>
                                <p>{format(parseISO(order.deliveryDate), 'dd/MM/yyyy')}</p>
                            </div>

                            <div className="space-y-1">
                                <Label>Fecha Programada</Label>
                                {order.scheduledStartDate ? (
                                    <p className="font-medium text-orange-600">
                                        {format(parseISO(order.scheduledStartDate), 'dd/MM/yy')} - {order.scheduledEndDate ? format(parseISO(order.scheduledEndDate), 'dd/MM/yy') : ''}
                                    </p>
                                ) : (
                                    <p className="text-muted-foreground">No programada</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>Prioridad</Label>
                                <Select
                                    value={order.priority}
                                    onValueChange={(value: ProductionOrderPriority) => handleDetailUpdate(order.id, { priority: value })}
                                    disabled={!canUpdateDetails}
                                >
                                    <SelectTrigger className={cn("h-8", priorityConfig[order.priority].className)}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(priorityConfig).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>{plannerSettings?.assignmentLabel || 'Máquina Asignada'}</Label>
                                <Select
                                    value={order.machineId || ''}
                                    onValueChange={(value) => handleDetailUpdate(order.id, { machineId: value === 'desasignar' ? null : value })}
                                    disabled={!canAssignMachine}
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Sin asignar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {order.machineId && (
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start text-red-600 hover:text-red-700 h-8 px-2"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleDetailUpdate(order.id, { machineId: null })
                                                }}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Desasignar
                                            </Button>
                                        )}
                                        {plannerSettings?.machines.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className="h-8 w-full"
                                            disabled={!canAssignMachine}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            Programar Fecha
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="range"
                                            selected={{
                                                from: order.scheduledStartDate ? parseISO(order.scheduledStartDate) : undefined,
                                                to: order.scheduledEndDate ? parseISO(order.scheduledEndDate) : undefined,
                                            }}
                                            onSelect={(range) => handleDetailUpdate(order.id, { scheduledDateRange: range })}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {order.erpPackageNumber && (
                                <div className="space-y-1">
                                    <p className="font-semibold">Nº Paquete ERP</p>
                                    <p>{order.erpPackageNumber}</p>
                                </div>
                            )}
                            {order.erpTicketNumber && (
                                <div className="space-y-1">
                                    <p className="font-semibold">Nº Boleta ERP</p>
                                    <p>{order.erpTicketNumber}</p>
                                </div>
                            )}
                        </div>
                    </div>
                     {order.notes && (
                        <div className="mt-4 text-xs bg-muted p-2 rounded-md">
                            <p className="font-semibold">Notas de la orden:</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">"{order.notes}"</p>
                        </div>
                     )}
                     {order.lastStatusUpdateNotes && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded-md">
                            <p className="font-semibold">Última nota de estado:</p>
                            <p className="text-muted-foreground">"{order.lastStatusUpdateNotes}" - <span className="italic">{order.lastStatusUpdateBy}</span></p>
                        </div>
                     )}
                </CardContent>
                <CardFooter className="p-4 pt-0 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
                    <span>Solicitado por: {order.requestedBy} el {format(parseISO(order.requestDate), 'dd/MM/yyyy')}</span>
                    {order.approvedBy && <span>Aprobado por: {order.approvedBy}</span>}
                </CardFooter>
            </Card>
        );
    };
    
    if (isAuthorized === null || (isAuthorized && isLoading)) {
        return (
            <main className="flex-1 p-4 md:p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Planificador OP</h1>
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
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Órdenes de Producción</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                     <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Refrescar Datos
                     </Button>
                     <Button variant="outline" onClick={handleExportListPDF} disabled={filteredOrders.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exportar Lista a PDF
                     </Button>
                     <div className="flex items-center gap-1">
                        <Button variant={viewingArchived ? "outline" : "secondary"} onClick={() => setViewingArchived(false)}>Activas</Button>
                        <Button variant={viewingArchived ? "secondary" : "outline"} onClick={() => setViewingArchived(true)}>Archivadas</Button>
                     </div>
                     {hasPermission('planner:create') && (
                        <Dialog open={isNewOrderDialogOpen} onOpenChange={setNewOrderDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><FilePlus className="mr-2"/> Nueva Orden</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <form onSubmit={(e) => { e.preventDefault(); handleCreateOrder(); }}>
                                    <DialogHeader>
                                        <DialogTitle>Crear Nueva Orden de Producción</DialogTitle>
                                        <DialogDescription>Complete los detalles para enviar una nueva orden a producción.</DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="h-[60vh] md:h-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                            
                                            <div className="space-y-2">
                                                <Label htmlFor="customer-search">Cliente</Label>
                                                <SearchInput
                                                    options={customerOptions}
                                                    onSelect={(value) => handleSelectCustomer(value)}
                                                    value={customerSearchTerm}
                                                    onValueChange={(val) => { if(!val) handleSelectCustomer(''); setCustomerSearchTerm(val); }}
                                                    placeholder="Buscar cliente..."
                                                    onKeyDown={handleCustomerInputKeyDown}
                                                    open={isCustomerSearchOpen}
                                                    onOpenChange={setCustomerSearchOpen}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="product-search">Producto</Label>
                                                <SearchInput
                                                    options={productOptions}
                                                    onSelect={(value) => handleSelectProduct(value)}
                                                    value={productSearchTerm}
                                                    onValueChange={(val) => { if(!val) handleSelectProduct(''); setProductSearchTerm(val); }}
                                                    placeholder="Buscar producto..."
                                                    onKeyDown={handleProductInputKeyDown}
                                                    open={isProductSearchOpen}
                                                    onOpenChange={setProductSearchOpen}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-purchase-order">Nº Orden de Compra (Opcional)</Label>
                                                <Input 
                                                    id="new-order-purchase-order" 
                                                    placeholder="Ej: OC-12345" 
                                                    value={newOrder.purchaseOrder || ''} 
                                                    onChange={(e) => setNewOrder(prev => ({ ...prev, purchaseOrder: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-quantity">Cantidad Solicitada</Label>
                                                <Input 
                                                    id="new-order-quantity" 
                                                    type="number" 
                                                    placeholder="0.00" 
                                                    value={newOrder.quantity || ''} 
                                                    onChange={e => setNewOrder(prev => ({ ...prev, quantity: Number(e.target.value) }))} 
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory">Inventario Actual (Manual)</Label>
                                                <Input 
                                                    id="new-order-inventory" 
                                                    type="number" 
                                                    placeholder="0.00" 
                                                    value={newOrder.inventory || ''} 
                                                    onChange={e => setNewOrder(prev => ({ ...prev, inventory: Number(e.target.value) }))} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory-erp">Inventario Actual (ERP)</Label>
                                                <Input 
                                                    id="new-order-inventory-erp"
                                                    value={(stockLevels.find(s => s.itemId === newOrder.productId)?.totalStock ?? 0).toLocaleString()}
                                                    disabled
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-delivery-date">Fecha de Entrega Requerida</Label>
                                                <Input 
                                                    id="new-order-delivery-date" 
                                                    type="date" 
                                                    value={newOrder.deliveryDate} 
                                                    onChange={e => setNewOrder(prev => ({ ...prev, deliveryDate: e.target.value }))} 
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-priority">Prioridad</Label>
                                                <Select value={newOrder.priority} onValueChange={(value: ProductionOrderPriority) => setNewOrder(prev => ({...prev, priority: value}))}>
                                                    <SelectTrigger id="new-order-priority">
                                                        <SelectValue placeholder="Seleccione una prioridad" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(priorityConfig).map(([key, config]) => (
                                                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label htmlFor="new-order-notes">Notas Adicionales</Label>
                                                <Textarea 
                                                    id="new-order-notes" 
                                                    placeholder="Instrucciones especiales, detalles del pedido, etc." 
                                                    value={newOrder.notes || ''} 
                                                    onChange={e => setNewOrder(prev => ({ ...prev, notes: e.target.value }))} 
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
                                            Crear Orden
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
                            placeholder="Buscar por Nº orden, cliente o producto..."
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
                                {Object.entries(dynamicStatusConfig).map(([key, { label }]) => (
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
                {filteredOrders.length > 0 ? (
                    filteredOrders.map(renderOrderCard)
                ) : (
                     <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <h3 className="text-2xl font-bold tracking-tight">
                                No se encontraron órdenes.
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Intenta ajustar los filtros de búsqueda o crea una nueva orden.
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
            
            {/* EDIT ORDER DIALOG */}
            <Dialog open={isEditOrderDialogOpen} onOpenChange={setEditOrderDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <form onSubmit={handleEditOrder}>
                        <DialogHeader>
                            <DialogTitle>Editar Orden de Producción - {orderToEdit?.consecutive}</DialogTitle>
                            <DialogDescription>Modifique los detalles de la orden de producción.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] md:h-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <Input value={orderToEdit?.customerName} disabled />
                                </div>

                                <div className="space-y-2">
                                    <Label>Producto</Label>
                                    <Input value={`[${orderToEdit?.productId}] ${orderToEdit?.productDescription}`} disabled />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-purchase-order">Nº Orden de Compra (Opcional)</Label>
                                    <Input 
                                        id="edit-order-purchase-order" 
                                        placeholder="Ej: OC-12345" 
                                        value={orderToEdit?.purchaseOrder || ''} 
                                        onChange={(e) => setOrderToEdit(prev => prev ? { ...prev, purchaseOrder: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-quantity">Cantidad Solicitada</Label>
                                    <Input 
                                        id="edit-order-quantity" 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={orderToEdit?.quantity || ''} 
                                        onChange={e => setOrderToEdit(prev => prev ? { ...prev, quantity: Number(e.target.value) } : null)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-inventory">Inventario Actual (Manual)</Label>
                                    <Input 
                                        id="edit-order-inventory" 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={orderToEdit?.inventory || ''} 
                                        onChange={e => setOrderToEdit(prev => prev ? { ...prev, inventory: Number(e.target.value) } : null)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-inventory-erp">Inventario Actual (ERP)</Label>
                                    <Input 
                                        id="edit-order-inventory-erp"
                                        value={(stockLevels.find(s => s.itemId === orderToEdit?.productId)?.totalStock ?? 0).toLocaleString()}
                                        disabled
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-delivery-date">Fecha de Entrega Requerida</Label>
                                    <Input 
                                        id="edit-order-delivery-date" 
                                        type="date" 
                                        value={orderToEdit?.deliveryDate || ''} 
                                        onChange={e => setOrderToEdit(prev => prev ? { ...prev, deliveryDate: e.target.value } : null)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label htmlFor="edit-order-notes">Notas Adicionales</Label>
                                    <Textarea 
                                        id="edit-order-notes" 
                                        placeholder="Instrucciones especiales, detalles del pedido, etc." 
                                        value={orderToEdit?.notes || ''} 
                                        onChange={e => setOrderToEdit(prev => prev ? { ...prev, notes: e.target.value } : null)}
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
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog for updating status */}
            <Dialog open={isStatusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Actualizar Estado de la Orden</DialogTitle>
                        <DialogDescription>
                            Estás a punto de cambiar el estado de la orden {orderToUpdate?.consecutive} a "{newStatus ? dynamicStatusConfig[newStatus]?.label : ''}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {newStatus === 'completed' && (
                             <div className="space-y-2">
                                <Label htmlFor="status-delivered-quantity">Cantidad Entregada</Label>
                                <Input 
                                    id="status-delivered-quantity"
                                    type="number"
                                    value={deliveredQuantity}
                                    onChange={(e) => setDeliveredQuantity(e.target.value)}
                                    placeholder={`Cantidad solicitada: ${orderToUpdate?.quantity.toLocaleString()}`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Introduce la cantidad final que se entregó al cliente.
                                </p>
                            </div>
                        )}
                         {newStatus === 'received-in-warehouse' && (
                             <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="status-erp-package-number">Nº de Paquete ERP</Label>
                                    <Input 
                                        id="status-erp-package-number" 
                                        value={erpPackageNumber} 
                                        onChange={(e) => setErpPackageNumber(e.target.value)} 
                                    />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="status-erp-ticket-number">Nº de Boleta ERP</Label>
                                    <Input 
                                        id="status-erp-ticket-number" 
                                        value={erpTicketNumber} 
                                        onChange={(e) => setErpTicketNumber(e.target.value)} 
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="status-notes">
                                {newStatus === 'cancellation-request' ? 'Motivo de la Solicitud (Requerido)' : 'Notas (Opcional)'}
                            </Label>
                            <Textarea 
                                id="status-notes"
                                value={statusUpdateNotes}
                                onChange={(e) => setStatusUpdateNotes(e.target.value)}
                                placeholder={newStatus === 'cancellation-request' ? "Ej: Cliente ya no necesita el producto..." : "Ej: Faltó materia prima..."}
                                required={newStatus === 'cancellation-request'}
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
            
            {/* Reopen Order Dialog */}
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
                             Reabrir Orden Finalizada
                         </DialogTitle>
                         <DialogDescription>
                           Estás a punto de reabrir la orden {orderToUpdate?.consecutive}. Esta acción es irreversible y moverá la orden de nuevo a "Pendiente".
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
                            onClick={handleReopenOrder} 
                            disabled={reopenStep !== 2 || reopenConfirmationText !== 'REABRIR' || isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                            Reabrir Orden
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog for viewing history */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Historial de Cambios - Orden {historyOrder?.consecutive}</DialogTitle>
                        <DialogDescription>
                            Registro de todos los cambios de estado para esta orden.
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
                                                    <Badge style={{backgroundColor: dynamicStatusConfig[entry.status]?.color}} className="text-white">
                                                        {dynamicStatusConfig[entry.status]?.label || entry.status}
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
                            <p className="text-center text-muted-foreground py-8">No hay historial de cambios para esta orden.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

             {/* Dialog for viewing stock details */}
            <Dialog open={isStockDetailOpen} onOpenChange={setIsStockDetailOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Desglose de Inventario - {stockDetailItem?.itemId}</DialogTitle>
                        <DialogDescription>
                            Existencias del artículo en las diferentes bodegas visibles.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bodega</TableHead>
                                    <TableHead className="text-right">Cantidad Disponible</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stockDetailItem && stockSettings && Object.entries(stockDetailItem.stockByWarehouse)
                                    .map(([warehouseId, stock]) => {
                                        const warehouse = stockSettings.warehouses.find(w => w.id === warehouseId);
                                        return warehouse?.isVisible ? (
                                            <TableRow key={warehouseId}>
                                                <TableCell>{warehouse.name} ({warehouseId})</TableCell>
                                                <TableCell className="text-right font-medium">{stock.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ) : null;
                                    })
                                }
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    );
}
