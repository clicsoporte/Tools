
'use client';

import React from 'react';
import { usePlanner } from '@/modules/planner/hooks/usePlanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FilePlus, Loader2, FilterX, CalendarIcon, ChevronLeft, ChevronRight, RefreshCcw, MoreVertical, History, Undo2, Check, Truck, PackageCheck, XCircle, Pencil, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductionOrder } from '@/modules/core/types';
import { Badge } from '@/components/ui/badge';

/**
 * @fileoverview This is the main UI component for the Production Planner page.
 * It is responsible for rendering the layout, filters, and order cards.
 * All business logic, state management, and data fetching are handled by the `usePlanner` hook.
 */
export default function PlannerPage() {
    const {
        state,
        actions,
        selectors,
        isAuthorized,
    } = usePlanner();

    const {
        isSubmitting, isNewOrderDialogOpen, viewingArchived,
        archivedPage, pageSize, totalArchived, newOrder,
        searchTerm, statusFilter, classificationFilter, dateFilter,
        customerSearchTerm, isCustomerSearchOpen, productSearchTerm, isProductSearchOpen,
        isStatusDialogOpen, orderToUpdate, newStatus, statusUpdateNotes, deliveredQuantity,
        erpPackageNumber, erpTicketNumber, isHistoryDialogOpen, historyOrder, history,
        isHistoryLoading, isReopenDialogOpen, reopenStep, reopenConfirmationText,
        isAddNoteDialogOpen, notePayload
    } = state;

    const {
        setNewOrderDialogOpen, setEditOrderDialogOpen, setViewingArchived,
        setArchivedPage, setPageSize, setNewOrder, setSearchTerm,
        setStatusFilter, setClassificationFilter, setDateFilter, setCustomerSearchTerm,
        setCustomerSearchOpen, setProductSearchTerm, setProductSearchOpen, setStatusDialogOpen,
        setNewStatus, setStatusUpdateNotes, setDeliveredQuantity, setErpPackageNumber,
        setErpTicketNumber, setHistoryDialogOpen, setReopenDialogOpen, setReopenStep,
        setReopenConfirmationText, setAddNoteDialogOpen, setNotePayload,
        loadInitialData, handleCreateOrder, handleSelectProduct, handleSelectCustomer,
        handleProductInputKeyDown, handleCustomerInputKeyDown, handleAddNote,
    } = actions;

    const { priorityConfig } = selectors;

    if (isAuthorized === null || (isAuthorized && state.isLoading)) {
        return (
            <main className="flex-1 p-4 md:p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Órdenes de Producción</h1>
                    <Button disabled><Loader2 className="mr-2 animate-spin" /> Cargando...</Button>
                </div>
                 <div className="space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </main>
        )
    }

    const renderOrderCard = (order: ProductionOrder) => {
        const canEdit = selectors.hasPermission('planner:edit:pending') && ['pending', 'on-hold'].includes(order.status) || selectors.hasPermission('planner:edit:approved') && ['approved', 'in-progress'].includes(order.status);
        const canApprove = selectors.hasPermission('planner:status:approve') && order.status === 'pending';
        const canStart = selectors.hasPermission('planner:status:in-progress') && order.status === 'approved';
        const canHold = selectors.hasPermission('planner:status:on-hold') && order.status === 'in-progress';
        const canResume = selectors.hasPermission('planner:status:in-progress') && order.status === 'on-hold';
        const canComplete = selectors.hasPermission('planner:status:completed') && order.status === 'in-progress';
        const canRequestCancel = selectors.hasPermission('planner:status:cancel') && order.status === 'pending';
        const canApproveCancel = selectors.hasPermission('planner:status:cancel-approved') && ['approved', 'in-progress', 'on-hold'].includes(order.status);
        const canReceive = selectors.hasPermission('planner:receive') && order.status === 'completed';
        const finalState = state.plannerSettings?.useWarehouseReception ? 'received-in-warehouse' : 'completed';
        const canReopen = selectors.hasPermission('planner:reopen') && (order.status === finalState || order.status === 'canceled');
        const canRejectCancellation = order.status === 'cancellation-request' && (selectors.hasPermission('planner:status:cancel-approved') || selectors.hasPermission('planner:status:cancel'));
        
        const daysRemaining = selectors.getDaysRemaining(order);
        
        return (
            <Card key={order.id} className="w-full">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <CardTitle className="text-lg">{`[${order.productId}] ${order.productDescription}`}</CardTitle>
                            <CardDescription>Cliente: {order.customerName} - Orden: {order.consecutive}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            {order.reopened && <Badge variant="destructive"><RefreshCcw className="mr-1 h-3 w-3" /> Reabierta</Badge>}
                             <Button variant="ghost" size="icon" onClick={() => actions.handleOpenHistory(order)}><History className="h-4 w-4" /></Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-1">
                                    <div className="grid grid-cols-1">
                                        {canEdit && <Button variant="ghost" className="justify-start" onClick={() => { actions.setOrderToEdit(order); setEditOrderDialogOpen(true); }}><Pencil className="mr-2"/> Editar Orden</Button>}
                                        {canReopen && <Button variant="ghost" className="justify-start text-orange-600" onClick={() => { setOrderToUpdate(order); setReopenDialogOpen(true); }}><Undo2 className="mr-2"/> Reabrir</Button>}
                                        {canApprove && <Button variant="ghost" className="justify-start text-green-600" onClick={() => actions.openStatusDialog(order, 'approved')}><Check className="mr-2"/> Aprobar</Button>}
                                        {canStart && <Button variant="ghost" className="justify-start text-blue-600" onClick={() => actions.openStatusDialog(order, 'in-progress')}><Truck className="mr-2"/> Iniciar Progreso</Button>}
                                        {canComplete && <Button variant="ghost" className="justify-start text-indigo-600" onClick={() => actions.openStatusDialog(order, 'completed')}><PackageCheck className="mr-2"/> Marcar como Completada</Button>}
                                        {canReceive && <Button variant="ghost" className="justify-start text-gray-700" onClick={() => actions.openStatusDialog(order, 'received-in-warehouse')}><PackageCheck className="mr-2"/> Recibir en Bodega</Button>}
                                        {canRequestCancel && <Button variant="ghost" className="justify-start text-red-600" onClick={() => actions.openStatusDialog(order, 'cancellation-request')}><XCircle className="mr-2"/> Solicitar Cancelación</Button>}
                                        {canApproveCancel && <Button variant="ghost" className="justify-start text-red-600" onClick={() => actions.openStatusDialog(order, 'canceled')}><XCircle className="mr-2"/> Cancelar Orden</Button>}
                                        {canRejectCancellation && <Button variant="ghost" className="justify-start" onClick={() => actions.handleRejectCancellation(order)}><AlertTriangle className="mr-2"/> Rechazar Cancelación</Button>}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    {/* ... content for the order card */}
                </CardContent>
                <CardFooter className="p-4 pt-0 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
                    <span>Solicitado por: {order.requestedBy} el {format(parseISO(order.requestDate), 'dd/MM/yyyy')}</span>
                    {order.approvedBy && <span>Aprobado por: {order.approvedBy}</span>}
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Órdenes de Producción</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                    <Button variant="outline" onClick={() => loadInitialData(0)} disabled={state.isLoading}>
                        {state.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Refrescar
                    </Button>
                     <div className="flex items-center gap-1">
                        <Button variant={viewingArchived ? "outline" : "secondary"} onClick={() => setViewingArchived(false)}>Activas</Button>
                        <Button variant={viewingArchived ? "secondary" : "outline"} onClick={() => setViewingArchived(true)}>Archivadas</Button>
                     </div>
                     {selectors.hasPermission('planner:create') && (
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
                                                    options={selectors.customerOptions}
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
                                                    options={selectors.productOptions}
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
                                                <Input id="new-order-purchase-order" placeholder="Ej: OC-12345" value={newOrder.purchaseOrder || ''} onChange={(e) => setNewOrder(prev => ({ ...prev, purchaseOrder: e.target.value }))} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-quantity">Cantidad Solicitada</Label>
                                                <Input id="new-order-quantity" type="number" placeholder="0.00" value={newOrder.quantity || ''} onChange={e => setNewOrder(prev => ({ ...prev, quantity: Number(e.target.value) }))} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory">Inventario Actual (Manual)</Label>
                                                <Input id="new-order-inventory" type="number" placeholder="0.00" value={newOrder.inventory || ''} onChange={e => setNewOrder(prev => ({ ...prev, inventory: Number(e.target.value) }))} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory-erp">Inventario Actual (ERP)</Label>
                                                <Input id="new-order-inventory-erp" value={(selectors.stockLevels.find(s => s.itemId === newOrder.productId)?.totalStock ?? 0).toLocaleString()} disabled />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-delivery-date">Fecha de Entrega Requerida</Label>
                                                <Input id="new-order-delivery-date" type="date" value={newOrder.deliveryDate} onChange={e => setNewOrder(prev => ({ ...prev, deliveryDate: e.target.value }))} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-priority">Prioridad</Label>
                                                <Select value={newOrder.priority} onValueChange={(value: typeof newOrder.priority) => setNewOrder(prev => ({...prev, priority: value}))}>
                                                    <SelectTrigger id="new-order-priority"><SelectValue placeholder="Seleccione una prioridad" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(priorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label htmlFor="new-order-notes">Notas Adicionales</Label>
                                                <Textarea id="new-order-notes" placeholder="Instrucciones especiales, detalles del pedido, etc." value={newOrder.notes || ''} onChange={e => setNewOrder(prev => ({ ...prev, notes: e.target.value }))} />
                                            </div>
                                        </div>
                                    </ScrollArea>
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Crear Orden</Button>
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
                        <Input placeholder="Buscar por Nº orden, cliente o producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Estados</SelectItem>
                                {Object.entries(selectors.statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                         <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                            <SelectTrigger className="w-full md:w-[240px]"><SelectValue placeholder="Filtrar por clasificación..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Clasificaciones</SelectItem>
                                {selectors.classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full md:w-[240px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateFilter?.from ? (dateFilter.to ? (`${format(dateFilter.from, "LLL dd, y")} - ${format(dateFilter.to, "LLL dd, y")}`) : (format(dateFilter.from, "LLL dd, y"))) : (<span>Filtrar por fecha</span>)}</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateFilter} onSelect={setDateFilter} /></PopoverContent></Popover>
                        <Button variant="ghost" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setClassificationFilter('all'); setDateFilter(undefined); }}><FilterX className="mr-2 h-4 w-4" />Limpiar</Button>
                    </div>
                     {viewingArchived && (
                        <div className="flex items-center gap-2">
                            <Label htmlFor="page-size">Registros por página:</Label>
                            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger id="page-size" className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem></SelectContent></Select>
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="space-y-4">
                {state.isLoading ? (
                    <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
                ) : selectors.filteredOrders.length > 0 ? (
                    selectors.filteredOrders.map(renderOrderCard)
                ) : (<div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24"><div className="flex flex-col items-center gap-2 text-center"><h3 className="text-2xl font-bold tracking-tight">No se encontraron órdenes.</h3><p className="text-sm text-muted-foreground">Intenta ajustar los filtros de búsqueda o crea una nueva orden.</p></div></div>)}
            </div>
             {viewingArchived && totalArchived > pageSize && (
                 <div className="flex items-center justify-center space-x-2 py-4">
                    <Button variant="outline" size="sm" onClick={() => setArchivedPage(p => p - 1)} disabled={archivedPage === 0}><ChevronLeft className="mr-2 h-4 w-4" />Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {archivedPage + 1} de {Math.ceil(totalArchived / pageSize)}</span>
                    <Button variant="outline" size="sm" onClick={() => setArchivedPage(p => p + 1)} disabled={(archivedPage + 1) * pageSize >= totalArchived}>Siguiente<ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
            )}
        </main>
    );
}
