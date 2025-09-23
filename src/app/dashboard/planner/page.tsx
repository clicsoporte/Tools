

'use client';

import React from 'react';
import { usePlanner } from '@/modules/planner/hooks/usePlanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FilePlus, Loader2, FilterX, CalendarIcon, ChevronLeft, ChevronRight, RefreshCcw, MoreVertical, History, Undo2, Check, Truck, PackageCheck, XCircle, Pencil, AlertTriangle, User as UserIcon, MessageSquarePlus, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductionOrder, ProductionOrderPriority, NotePayload } from '@/modules/core/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


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
        const canEdit = (selectors.hasPermission('planner:edit:pending') && ['pending', 'on-hold'].includes(order.status)) || (selectors.hasPermission('planner:edit:approved') && ['approved', 'in-progress'].includes(order.status));
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
        
        const daysRemaining = selectors.getDaysRemaining(order.deliveryDate);
        const scheduledDaysRemaining = selectors.getScheduledDaysRemaining(order);
        
        return (
            <Card key={order.id} className="w-full flex flex-col">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <CardTitle className="text-lg">{`[${order.productId}] ${order.productDescription}`}</CardTitle>
                            <CardDescription>Cliente: {order.customerName} - Orden: {order.consecutive}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            {order.reopened && <Badge variant="destructive"><RefreshCcw className="mr-1 h-3 w-3" /> Reabierta</Badge>}
                             <Button variant="ghost" size="icon" onClick={() => actions.handleOpenHistory(order)}><History className="h-4 w-4" /></Button>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    <DropdownMenuSeparator/>
                                    {canEdit && <DropdownMenuItem onSelect={() => { actions.setOrderToEdit(order); actions.setEditOrderDialogOpen(true); }}><Pencil className="mr-2"/> Editar Orden</DropdownMenuItem>}
                                    <DropdownMenuItem onSelect={() => actions.openAddNoteDialog(order)}><MessageSquarePlus className="mr-2" /> Añadir Nota</DropdownMenuItem>
                                    <DropdownMenuSeparator/>
                                    {canReopen && <DropdownMenuItem onSelect={() => { actions.setOrderToUpdate(order); actions.setReopenDialogOpen(true); }} className="text-orange-600"><Undo2 className="mr-2"/> Reabrir</DropdownMenuItem>}
                                    {canApprove && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'approved')} className="text-green-600"><Check className="mr-2"/> Aprobar</DropdownMenuItem>}
                                    {canStart && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'in-progress')} className="text-blue-600"><Truck className="mr-2"/> Iniciar Progreso</DropdownMenuItem>}
                                    {canComplete && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'completed')} className="text-indigo-600"><PackageCheck className="mr-2"/> Marcar como Completada</DropdownMenuItem>}
                                    {canReceive && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'received-in-warehouse')} className="text-gray-700"><PackageCheck className="mr-2"/> Recibir en Bodega</DropdownMenuItem>}
                                    <DropdownMenuSeparator/>
                                    {canRequestCancel && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'cancellation-request')} className="text-red-600"><XCircle className="mr-2"/> Solicitar Cancelación</DropdownMenuItem>}
                                    {canApproveCancel && <DropdownMenuItem onSelect={() => actions.openStatusDialog(order, 'canceled')} className="text-red-600"><XCircle className="mr-2"/> Cancelar Orden</DropdownMenuItem>}
                                    {canRejectCancellation && <DropdownMenuItem onSelect={() => actions.handleRejectCancellation(order)}><AlertTriangle className="mr-2"/> Rechazar Cancelación</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-grow">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 text-sm">
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Estado Actual</p>
                            <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-full", selectors.statusConfig[order.status]?.color)}></span>
                                <span className="font-medium">{selectors.statusConfig[order.status]?.label || order.status}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Prioridad</p>
                             <Select value={order.priority} onValueChange={(value) => actions.handleDetailUpdate(order.id, { priority: value as ProductionOrderPriority })}>
                                <SelectTrigger className={cn("h-8 w-32 border-0 focus:ring-0", selectors.priorityConfig[order.priority]?.className)}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                     {Object.entries(selectors.priorityConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key} disabled={!selectors.hasPermission('planner:priority:update')}>{config.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                             <p className="font-semibold text-muted-foreground">{state.plannerSettings?.assignmentLabel || 'Máquina'}</p>
                            <Select value={order.machineId || 'none'} onValueChange={(value) => actions.handleDetailUpdate(order.id, { machineId: value })}>
                                <SelectTrigger className="h-8 w-40 border-0 focus:ring-0">
                                    <SelectValue placeholder="Sin Asignar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin Asignar</SelectItem>
                                    {state.plannerSettings?.machines.map(machine => (
                                        <SelectItem key={machine.id} value={machine.id} disabled={!selectors.hasPermission('planner:machine:assign')}>{machine.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha Prog.</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-8 w-48 justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{order.scheduledStartDate ? `${format(parseISO(order.scheduledStartDate), 'dd/MM/yy')} - ${order.scheduledEndDate ? format(parseISO(order.scheduledEndDate), 'dd/MM/yy') : ''}` : 'No programada'}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={{ from: order.scheduledStartDate ? parseISO(order.scheduledStartDate) : undefined, to: order.scheduledEndDate ? parseISO(order.scheduledEndDate) : undefined }} onSelect={(range) => actions.handleDetailUpdate(order.id, { scheduledDateRange: range })} /></PopoverContent>
                                </Popover>
                                <span className={cn('text-xs font-semibold', scheduledDaysRemaining.color)}>({scheduledDaysRemaining.label})</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha Requerida</p>
                            <div className="flex items-center gap-2">
                                <span>{format(parseISO(order.deliveryDate), 'dd/MM/yyyy')}</span>
                                <span className={cn('text-xs font-semibold', daysRemaining.color)}>({daysRemaining.label})</span>
                            </div>
                        </div>
                        <div className="space-y-1"><p className="font-semibold text-muted-foreground">Cant. Solicitada</p><p className="font-bold text-lg">{order.quantity.toLocaleString()}</p></div>
                        {order.purchaseOrder && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Nº OC Cliente</p><p>{order.purchaseOrder}</p></div>}
                        {order.erpPackageNumber && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Nº Bulto</p><p>{order.erpPackageNumber}</p></div>}
                        {order.erpTicketNumber && <div className="space-y-1"><p className="font-semibold text-muted-foreground">Nº Boleta</p><p>{order.erpTicketNumber}</p></div>}
                    </div>
                     {order.notes && (<div className="mt-4 text-xs bg-muted p-2 rounded-md"><p className="font-semibold">Notas de la Orden:</p><p className="text-muted-foreground">"{order.notes}"</p></div>)}
                     {order.lastStatusUpdateNotes && (<div className="mt-2 text-xs bg-muted p-2 rounded-md"><p className="font-semibold">Última nota de estado:</p><p className="text-muted-foreground">"{order.lastStatusUpdateNotes}" - <span className="italic">{order.lastStatusUpdateBy}</span></p></div>)}
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Órdenes de Producción</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                    <Button variant="outline" onClick={() => actions.loadInitialData()} disabled={state.isLoading}>
                        {state.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        Refrescar
                    </Button>
                     <div className="flex items-center gap-1">
                        <Button variant={state.viewingArchived ? "outline" : "secondary"} onClick={() => actions.setViewingArchived(false)}>Activas</Button>
                        <Button variant={state.viewingArchived ? "secondary" : "outline"} onClick={() => actions.setViewingArchived(true)}>Archivadas</Button>
                     </div>
                     {selectors.hasPermission('planner:create') && (
                        <Dialog open={state.isNewOrderDialogOpen} onOpenChange={actions.setNewOrderDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><FilePlus className="mr-2"/> Nueva Orden</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateOrder(); }}>
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
                                                    onSelect={actions.handleSelectCustomer}
                                                    value={state.customerSearchTerm}
                                                    onValueChange={actions.setCustomerSearchTerm}
                                                    placeholder="Buscar cliente..."
                                                    onKeyDown={actions.handleCustomerInputKeyDown}
                                                    open={state.isCustomerSearchOpen}
                                                    onOpenChange={actions.setCustomerSearchOpen}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="product-search">Producto</Label>
                                                <SearchInput
                                                    options={selectors.productOptions}
                                                    onSelect={actions.handleSelectProduct}
                                                    value={state.productSearchTerm}
                                                    onValueChange={actions.setProductSearchTerm}
                                                    placeholder="Buscar producto..."
                                                    onKeyDown={actions.handleProductInputKeyDown}
                                                    open={state.isProductSearchOpen}
                                                    onOpenChange={actions.setProductSearchOpen}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-purchase-order">Nº Orden de Compra (Opcional)</Label>
                                                <Input id="new-order-purchase-order" placeholder="Ej: OC-12345" value={state.newOrder.purchaseOrder || ''} onChange={(e) => actions.setNewOrder({ purchaseOrder: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-quantity">Cantidad Solicitada</Label>
                                                <Input id="new-order-quantity" type="number" placeholder="0.00" value={state.newOrder.quantity || ''} onChange={e => actions.setNewOrder({ quantity: Number(e.target.value) })} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory">Inventario Actual (Manual)</Label>
                                                <Input id="new-order-inventory" type="number" placeholder="0.00" value={state.newOrder.inventory || ''} onChange={e => actions.setNewOrder({ inventory: Number(e.target.value) })} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="new-order-inventory-erp">Inventario Actual (ERP)</Label>
                                                <Input id="new-order-inventory-erp" value={(selectors.stockLevels.find(s => s.itemId === state.newOrder.productId)?.totalStock ?? 0).toLocaleString()} disabled />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-delivery-date">Fecha de Entrega Requerida</Label>
                                                <Input id="new-order-delivery-date" type="date" value={state.newOrder.deliveryDate} onChange={e => actions.setNewOrder({ deliveryDate: e.target.value })} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-order-priority">Prioridad</Label>
                                                <Select value={state.newOrder.priority} onValueChange={(value: typeof state.newOrder.priority) => actions.setNewOrder({priority: value})}>
                                                    <SelectTrigger id="new-order-priority"><SelectValue placeholder="Seleccione una prioridad" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(selectors.priorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label htmlFor="new-order-notes">Notas Adicionales</Label>
                                                <Textarea id="new-order-notes" placeholder="Instrucciones especiales, detalles del pedido, etc." value={state.newOrder.notes || ''} onChange={e => actions.setNewOrder({ notes: e.target.value })} />
                                            </div>
                                        </div>
                                    </ScrollArea>
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                                        <Button type="submit" disabled={state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Crear Orden</Button>
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
                        <Input placeholder="Buscar por Nº orden, cliente o producto..." value={state.searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="max-w-sm" />
                        <Select value={state.statusFilter} onValueChange={actions.setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Estados</SelectItem>
                                {Object.entries(selectors.statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                         <Select value={state.classificationFilter} onValueChange={actions.setClassificationFilter}>
                            <SelectTrigger className="w-full md:w-[240px]"><SelectValue placeholder="Filtrar por clasificación..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Clasificaciones</SelectItem>
                                {selectors.classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full md:w-[240px] justify-start text-left font-normal", !state.dateFilter && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{state.dateFilter?.from ? (state.dateFilter.to ? (`${format(state.dateFilter.from, "LLL dd, y")} - ${format(state.dateFilter.to, "LLL dd, y")}`) : (format(state.dateFilter.from, "LLL dd, y"))) : (<span>Filtrar por fecha</span>)}</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={state.dateFilter} onSelect={actions.setDateFilter} /></PopoverContent>
                        </Popover>
                        <Button variant="outline" onClick={actions.handleExportPDF}><FileDown className="mr-2 h-4 w-4"/>Exportar PDF</Button>
                        <Button variant="ghost" onClick={() => { actions.setSearchTerm(''); actions.setStatusFilter('all'); actions.setClassificationFilter('all'); actions.setDateFilter(undefined); }}><FilterX className="mr-2 h-4 w-4" />Limpiar</Button>
                    </div>
                     {state.viewingArchived && (
                        <div className="flex items-center gap-2">
                            <Label htmlFor="page-size">Registros por página:</Label>
                            <Select value={String(state.pageSize)} onValueChange={(value) => actions.setPageSize(Number(value))}><SelectTrigger id="page-size" className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem></SelectContent></Select>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <div className="space-y-4 mt-6">
                {state.isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)
                ) : selectors.filteredOrders.length > 0 ? (
                    selectors.filteredOrders.map(renderOrderCard)
                ) : (
                    <div className="col-span-full flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <h3 className="text-2xl font-bold tracking-tight">No se encontraron órdenes.</h3>
                            <p className="text-sm text-muted-foreground">Intenta ajustar los filtros de búsqueda o crea una nueva orden.</p>
                        </div>
                    </div>
                )}
            </div>

             {state.viewingArchived && state.totalArchived > state.pageSize && (
                 <div className="flex items-center justify-center space-x-2 py-4">
                    <Button variant="outline" size="sm" onClick={() => actions.setArchivedPage(p => p - 1)} disabled={state.archivedPage === 0}><ChevronLeft className="mr-2 h-4 w-4" />Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {state.archivedPage + 1} de {Math.ceil(state.totalArchived / state.pageSize)}</span>
                    <Button variant="outline" size="sm" onClick={() => actions.setArchivedPage(p => p + 1)} disabled={(state.archivedPage + 1) * state.pageSize >= state.totalArchived}>Siguiente<ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
            )}
            
            {/* Dialogs */}
            <Dialog open={state.isEditOrderDialogOpen} onOpenChange={actions.setEditOrderDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <form onSubmit={actions.handleEditOrder}>
                        <DialogHeader>
                            <DialogTitle>Editar Orden de Producción - {state.orderToEdit?.consecutive}</DialogTitle>
                            <DialogDescription>Modifique los campos necesarios y guarde los cambios.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] md:h-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <Input value={state.orderToEdit?.customerName || ''} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Producto</Label>
                                    <Input value={state.orderToEdit?.productDescription || ''} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-order-quantity">Cantidad</Label>
                                    <Input id="edit-order-quantity" type="number" value={state.orderToEdit?.quantity || ''} onChange={e => actions.setOrderToEdit({ ...state.orderToEdit, quantity: Number(e.target.value) })} required />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="edit-order-delivery-date">Fecha de Entrega</Label>
                                    <Input id="edit-order-delivery-date" type="date" value={state.orderToEdit?.deliveryDate ? format(parseISO(state.orderToEdit.deliveryDate), 'yyyy-MM-dd') : ''} onChange={e => actions.setOrderToEdit({ ...state.orderToEdit, deliveryDate: e.target.value })} required />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="edit-order-purchase-order">Nº OC Cliente</Label>
                                    <Input id="edit-order-purchase-order" value={state.orderToEdit?.purchaseOrder || ''} onChange={e => actions.setOrderToEdit({ ...state.orderToEdit, purchaseOrder: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label htmlFor="edit-order-notes">Notas</Label>
                                    <Textarea id="edit-order-notes" value={state.orderToEdit?.notes || ''} onChange={e => actions.setOrderToEdit({ ...state.orderToEdit, notes: e.target.value })} />
                                </div>
                            </div>
                        </ScrollArea>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={state.isStatusDialogOpen} onOpenChange={actions.setStatusDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Actualizar Estado de la Orden</DialogTitle>
                        <DialogDescription>Estás a punto de cambiar el estado a "{state.newStatus ? selectors.statusConfig[state.newStatus]?.label : ''}".</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {state.newStatus === 'completed' && (
                            <div className="space-y-2">
                                <Label htmlFor="status-delivered-quantity">Cantidad Entregada</Label>
                                <Input id="status-delivered-quantity" type="number" value={state.deliveredQuantity} onChange={(e) => actions.setDeliveredQuantity(e.target.value)} placeholder={`Cantidad solicitada: ${state.orderToUpdate?.quantity.toLocaleString()}`} />
                            </div>
                        )}
                        {state.newStatus === 'received-in-warehouse' && (
                            <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="status-erp-package">Nº Bulto ERP</Label>
                                    <Input id="status-erp-package" value={state.erpPackageNumber} onChange={(e) => actions.setErpPackageNumber(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status-erp-ticket">Nº Boleta ERP</Label>
                                    <Input id="status-erp-ticket" value={state.erpTicketNumber} onChange={(e) => actions.setErpTicketNumber(e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="status-notes">Notas (Opcional)</Label>
                            <Textarea id="status-notes" value={state.statusUpdateNotes} onChange={e => actions.setStatusUpdateNotes(e.target.value)} placeholder="Ej: Aprobado por Gerencia..." />
                        </div>
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleStatusUpdate} disabled={state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Actualizar Estado</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Dialog open={state.isReopenDialogOpen} onOpenChange={(isOpen) => { actions.setReopenDialogOpen(isOpen); if (!isOpen) { actions.setReopenStep(0); actions.setReopenConfirmationText(''); }}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Reabrir Orden Finalizada</DialogTitle>
                        <DialogDescription>Estás a punto de reabrir la orden {state.orderToUpdate?.consecutive}. Esta acción es irreversible y moverá la orden de nuevo a "Pendiente".</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="reopen-confirm-checkbox" onCheckedChange={(checked) => actions.setReopenStep(checked ? 1 : 0)} />
                            <Label htmlFor="reopen-confirm-checkbox" className="font-medium text-destructive">Entiendo que esta acción no se puede deshacer.</Label>
                        </div>
                        {state.reopenStep > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="reopen-confirmation-text">Para confirmar, escribe "REABRIR" en el campo de abajo:</Label>
                                <Input id="reopen-confirmation-text" value={state.reopenConfirmationText} onChange={(e) => { actions.setReopenConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'REABRIR') {actions.setReopenStep(2);} else {actions.setReopenStep(1);}}} className="border-destructive focus-visible:ring-destructive" />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleReopenOrder} disabled={state.reopenStep !== 2 || state.reopenConfirmationText !== 'REABRIR' || state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Reabrir Orden</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={state.isHistoryDialogOpen} onOpenChange={actions.setHistoryDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Historial de Cambios - Orden {state.historyOrder?.consecutive}</DialogTitle>
                        <DialogDescription>Registro de todos los cambios de estado para esta orden.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {state.isHistoryLoading ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>
                        ) : state.history.length > 0 ? (
                            <ScrollArea className="h-96">
                                <Table><TableHeader><TableRow><TableHead>Fecha y Hora</TableHead><TableHead>Estado</TableHead><TableHead>Usuario</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {state.history.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell>{format(parseISO(entry.timestamp), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                                                <TableCell><Badge style={{ backgroundColor: selectors.statusConfig[entry.status]?.color }} className="text-white">{selectors.statusConfig[entry.status]?.label || entry.status}</Badge></TableCell>
                                                <TableCell>{entry.updatedBy}</TableCell>
                                                <TableCell>{entry.notes || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No hay historial de cambios para esta orden.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={state.isAddNoteDialogOpen} onOpenChange={actions.setAddNoteDialogOpen}>
                <DialogContent>
                     <DialogHeader>
                        <DialogTitle>Añadir Nota a la Orden {state.notePayload?.orderId}</DialogTitle>
                        <DialogDescription>Agrega una nota o actualización a la orden sin cambiar su estado actual.</DialogDescription>
                    </DialogHeader>
                     <div className="py-4 space-y-2">
                        <Label htmlFor="add-note-textarea">Nota</Label>
                        <Textarea id="add-note-textarea" value={state.notePayload?.notes || ''} onChange={e => actions.setNotePayload({ ...state.notePayload, notes: e.target.value } as NotePayload)} placeholder="Añade aquí una nota o actualización..." />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleAddNote} disabled={state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Añadir Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {(state.isSubmitting || state.isLoading) && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Procesando...</span>
                </div>
            )}
        </main>
    );
}
