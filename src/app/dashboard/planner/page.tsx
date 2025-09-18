
'use client';

import React from 'react';
import { usePlanner } from '@/modules/planner/hooks/usePlanner';
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
import { FilePlus, Loader2, Check, MoreVertical, History, RefreshCcw, AlertTriangle, PackageCheck, Factory, ShieldAlert, XCircle, Undo2, Boxes, FileDown, Pencil, CalendarIcon, FilterX, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchInput } from '@/components/ui/search-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function PlannerPage() {
    const {
        state,
        actions,
        refs,
        selectors,
        isAuthorized,
        isLoading
    } = usePlanner();

    const {
        isSubmitting, isNewOrderDialogOpen, activeOrders, archivedOrders, viewingArchived,
        archivedPage, pageSize, totalArchived, plannerSettings, newOrder, orderToEdit,
        searchTerm, statusFilter, classificationFilter, dateFilter,
        customerSearchTerm, isCustomerSearchOpen, productSearchTerm, isProductSearchOpen,
        isStatusDialogOpen, orderToUpdate, newStatus, statusUpdateNotes, deliveredQuantity,
        erpPackageNumber, erpTicketNumber, isHistoryDialogOpen, historyOrder, history,
        isHistoryLoading, isReopenDialogOpen, reopenStep, reopenConfirmationText,
        isAddNoteDialogOpen, notePayload
    } = state;

    const {
        setNewOrderDialogOpen, setEditOrderDialogOpen, setViewingArchived,
        setArchivedPage, setPageSize, setNewOrder, setOrderToEdit, setSearchTerm,
        setStatusFilter, setClassificationFilter, setDateFilter, setCustomerSearchTerm,
        setCustomerSearchOpen, setProductSearchTerm, setProductSearchOpen, setStatusDialogOpen,
        setNewStatus, setStatusUpdateNotes, setDeliveredQuantity, setErpPackageNumber,
        setErpTicketNumber, setHistoryDialogOpen, setReopenDialogOpen, setReopenStep,
        setReopenConfirmationText, setAddNoteDialogOpen, setNotePayload,
        loadInitialData, handleCreateOrder, handleEditOrder, openStatusDialog,
        handleStatusUpdate, handleDetailUpdate, handleOpenHistory, handleReopenOrder,
        handleRejectCancellation, handleSelectProduct, handleSelectCustomer,
        handleProductInputKeyDown, handleCustomerInputKeyDown, openAddNoteDialog, handleAddNote,
    } = actions;

    const {
        hasPermission, priorityConfig, statusConfig, getDaysRemaining
    } = selectors;

    if (isAuthorized === null || (isAuthorized && isLoading)) {
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
    
     const renderOrderCard = (order: typeof activeOrders[0]) => {
        const settings = plannerSettings;
        if (!settings) return null;

        const finalStatus = settings.useWarehouseReception ? 'received-in-warehouse' : 'completed';
        const canBeReopened = hasPermission('planner:reopen') && (order.status === finalStatus || order.status === 'canceled');
        const canApprove = hasPermission('planner:status:approve') && order.status === 'pending';
        const canStart = hasPermission('planner:status:in-progress') && ['approved', 'on-hold'].includes(order.status);
        const canHold = hasPermission('planner:status:on-hold') && order.status === 'in-progress';
        const canComplete = hasPermission('planner:status:completed') && order.status === 'in-progress';
        const canReceiveInWarehouse = hasPermission('planner:receive') && order.status === 'completed' && settings.useWarehouseReception;
        const canRequestCancel = order.status !== 'cancellation-request' && order.status !== 'completed' && order.status !== 'received-in-warehouse' && order.status !== 'canceled';
        const canApproveCancel = hasPermission('planner:status:cancel-approved') && order.status === 'cancellation-request';
        const canRejectCancel = hasPermission('planner:status:cancel-approved') && order.status === 'cancellation-request';

        const canEditPending = hasPermission('planner:edit:pending') && order.status === 'pending';
        const canEditApproved = hasPermission('planner:edit:approved') && ['approved', 'in-progress', 'on-hold'].includes(order.status);
        const canEdit = canEditPending || canEditApproved;

        const startsToday = order.scheduledStartDate && isToday(parseISO(order.scheduledStartDate));
        const endsToday = order.scheduledEndDate && isToday(parseISO(order.scheduledEndDate));
        const daysRemainingInfo = getDaysRemaining(order);

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
                             <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(order)}><History className="h-4 w-4" /></Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-1">
                                    <div className="grid grid-cols-1">
                                        <Button variant="ghost" className="justify-start" onClick={() => openAddNoteDialog(order)}><Pencil className="mr-2"/> Añadir Nota</Button>
                                        {canEdit && <Button variant="ghost" className="justify-start" onClick={() => { setOrderToEdit(order); setEditOrderDialogOpen(true); }}><Pencil className="mr-2"/> Editar Orden</Button>}
                                        {canBeReopened && <Button variant="ghost" className="justify-start text-orange-600" onClick={() => { setOrderToUpdate(order); setReopenDialogOpen(true); }}><Undo2 className="mr-2"/> Reabrir</Button>}
                                        <Separator className="my-1"/>
                                        {canApprove && <Button variant="ghost" className="justify-start text-green-600" onClick={() => openStatusDialog(order, 'approved')}><Check className="mr-2"/> Aprobar</Button>}
                                        {canStart && <Button variant="ghost" className="justify-start text-blue-600" onClick={() => openStatusDialog(order, 'in-progress')}><Factory className="mr-2"/> Iniciar Producción</Button>}
                                        {canHold && <Button variant="ghost" className="justify-start" onClick={() => openStatusDialog(order, 'on-hold')}>En Espera</Button>}
                                        {canComplete && <Button variant="ghost" className="justify-start text-teal-600" onClick={() => openStatusDialog(order, 'completed')}><Check className="mr-2"/> Completar</Button>}
                                        {canReceiveInWarehouse && <Button variant="ghost" className="justify-start text-gray-700" onClick={() => openStatusDialog(order, 'received-in-warehouse')}><Boxes className="mr-2"/> Recibir en Bodega</Button>}
                                        <Separator className="my-1"/>
                                        {canRequestCancel && <Button variant="ghost" className="justify-start text-orange-600" onClick={() => openStatusDialog(order, 'cancellation-request')}><ShieldAlert className="mr-2"/> Sol. Cancelación</Button>}
                                        {canApproveCancel && <Button variant="ghost" className="justify-start text-red-600" onClick={() => openStatusDialog(order, 'canceled')}><XCircle className="mr-2"/> Aprobar Cancelación</Button>}
                                        {canRejectCancel && <Button variant="ghost" className="justify-start" onClick={() => handleRejectCancellation(order)}>Rechazar Cancelación</Button>}
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
                                <span className={cn("h-3 w-3 rounded-full", statusConfig[order.status]?.color)}></span>
                                <span className="font-medium">{statusConfig[order.status]?.label}</span>
                            </div>
                        </div>

                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Prioridad</p>
                            <span className={cn("font-medium", priorityConfig[order.priority]?.className)}>{priorityConfig[order.priority]?.label || order.priority}</span>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha de Entrega</p>
                             <div className="flex items-center gap-2">
                                <span>{format(parseISO(order.deliveryDate), 'dd/MM/yyyy')}</span>
                            </div>
                        </div>
                        
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Fecha Programada</p>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-auto px-2 py-1 text-xs">
                                        <span className={cn('text-xs font-semibold mr-2', daysRemainingInfo.color)}>
                                            ({daysRemainingInfo.label})
                                        </span>
                                        {(order.scheduledStartDate && order.scheduledEndDate) ? 
                                        `${format(parseISO(order.scheduledStartDate), 'dd/MM/yy')} - ${format(parseISO(order.scheduledEndDate), 'dd/MM/yy')}`
                                        : "Sin programar"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="range"
                                        defaultMonth={order.scheduledStartDate ? parseISO(order.scheduledStartDate) : new Date()}
                                        selected={{ from: order.scheduledStartDate ? parseISO(order.scheduledStartDate) : undefined, to: order.scheduledEndDate ? parseISO(order.scheduledEndDate) : undefined }}
                                        onSelect={(range) => handleDetailUpdate(order.id, { scheduledDateRange: range })}
                                    />
                                </PopoverContent>
                            </Popover>
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
                            </>
                         )}
                         <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">{plannerSettings?.assignmentLabel || "Asignación"}</p>
                             <Select value={order.machineId || "none"} onValueChange={(value) => handleDetailUpdate(order.id, { machineId: value === "none" ? null : value })}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Sin asignar"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin asignar</SelectItem>
                                    {plannerSettings?.machines.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {order.purchaseOrder &&
                            <div className="space-y-1">
                                <p className="font-semibold text-muted-foreground">Nº OC Cliente</p>
                                <p>{order.purchaseOrder}</p>
                            </div>
                        }
                    </div>
                     <div className="flex flex-wrap items-center gap-2 mt-4">
                        {startsToday && <Badge variant="outline" className="border-green-600 text-green-700">▶️ Inicia Hoy</Badge>}
                        {endsToday && <Badge variant="destructive">🏁 Finaliza Hoy</Badge>}
                     </div>
                     {order.notes && (
                        <div className="mt-4 text-xs bg-muted p-2 rounded-md">
                            <p className="font-semibold">Notas de la Orden:</p>
                            <p className="text-muted-foreground">"{order.notes}"</p>
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

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Órdenes de Producción</h1>
                 <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                     <Button variant="outline" onClick={() => loadInitialData(0)} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Refrescar
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
                                {Object.entries(statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
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
                {isLoading ? (
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
            <Dialog open={isAddNoteDialogOpen} onOpenChange={setAddNoteDialogOpen}>
                <DialogContent><DialogHeader><DialogTitle>Añadir Nota a la Orden</DialogTitle><DialogDescription>La nota se añadirá al historial de la orden sin cambiar su estado actual.</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label htmlFor="note-content">Nota</Label><Textarea id="note-content" value={notePayload?.notes || ''} onChange={(e) => setNotePayload(prev => prev ? { ...prev, notes: e.target.value } : null)} placeholder="Escribe tu nota aquí..." rows={4} /></div><DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={handleAddNote} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : null}Guardar Nota</Button></DialogFooter></DialogContent>
            </Dialog>
            <Dialog open={isStatusDialogOpen} onOpenChange={setStatusDialogOpen}>
                <DialogContent><DialogHeader><DialogTitle>Actualizar Estado de la Orden</DialogTitle><DialogDescription>Estás a punto de cambiar el estado de la orden {orderToUpdate?.consecutive} a "{newStatus ? statusConfig[newStatus]?.label : ''}".</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        {newStatus === 'completed' && (<div className="space-y-2"><Label htmlFor="status-delivered-quantity">Cantidad Entregada</Label><Input id="status-delivered-quantity" type="number" value={deliveredQuantity} onChange={(e) => setDeliveredQuantity(e.target.value)} placeholder={`Cantidad solicitada: ${orderToUpdate?.quantity.toLocaleString()}`} /><p className="text-xs text-muted-foreground">Introduce la cantidad final que se entregó al cliente.</p></div>)}
                         {newStatus === 'received-in-warehouse' && (<div className="space-y-4"><div className="space-y-2"><Label htmlFor="status-erp-package-number">Nº de Paquete ERP</Label><Input id="status-erp-package-number" value={erpPackageNumber} onChange={(e) => setErpPackageNumber(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="status-erp-ticket-number">Nº de Boleta ERP</Label><Input id="status-erp-ticket-number" value={erpTicketNumber} onChange={(e) => setErpTicketNumber(e.target.value)} /></div></div>)}
                        <div className="space-y-2"><Label htmlFor="status-notes">{newStatus === 'cancellation-request' ? 'Motivo de la Solicitud (Requerido)' : 'Notas (Opcional)'}</Label><Textarea id="status-notes" value={statusUpdateNotes} onChange={(e) => setStatusUpdateNotes(e.target.value)} placeholder={newStatus === 'cancellation-request' ? "Ej: Cliente ya no necesita el producto..." : "Ej: Faltó materia prima..."} required={newStatus === 'cancellation-request'} /></div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={handleStatusUpdate} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Actualizar Estado</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isReopenDialogOpen} onOpenChange={(isOpen) => { setReopenDialogOpen(isOpen); if (!isOpen) { setReopenStep(0); setReopenConfirmationText(''); }}}>
                <DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Reabrir Orden Finalizada</DialogTitle><DialogDescription>Estás a punto de reabrir la orden {orderToUpdate?.consecutive}. Esta acción es irreversible y moverá la orden de nuevo a "Pendiente".</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4"><div className="flex items-center space-x-2"><Checkbox id="reopen-confirm-checkbox" onCheckedChange={(checked) => setReopenStep(checked ? 1 : 0)} /><Label htmlFor="reopen-confirm-checkbox" className="font-medium text-destructive">Entiendo que esta acción no se puede deshacer.</Label></div>
                         {reopenStep > 0 && (<div className="space-y-2"><Label htmlFor="reopen-confirmation-text">Para confirmar, escribe "REABRIR" en el campo de abajo:</Label><Input id="reopen-confirmation-text" value={reopenConfirmationText} onChange={(e) => { setReopenConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'REABRIR') {setReopenStep(2);} else {setReopenStep(1);}}} className="border-destructive focus-visible:ring-destructive" /></div>)}
                    </div>
                     <DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={handleReopenOrder} disabled={reopenStep !== 2 || reopenConfirmationText !== 'REABRIR' || isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Reabrir Orden</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isHistoryDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Historial de Cambios - Orden {historyOrder?.consecutive}</DialogTitle><DialogDescription>Registro de todos los cambios de estado para esta orden.</DialogDescription></DialogHeader>
                    <div className="py-4">
                        {isHistoryLoading ? (<div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>) : history.length > 0 ? (<div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Fecha y Hora</TableHead><TableHead>Estado</TableHead><TableHead>Usuario</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader><TableBody>
                            {history.map(entry => (<TableRow key={entry.id}><TableCell>{format(parseISO(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell><TableCell><Badge style={{backgroundColor: statusConfig[entry.status as keyof typeof statusConfig]?.color}} className="text-white">{statusConfig[entry.status as keyof typeof statusConfig]?.label || entry.status}</Badge></TableCell><TableCell>{entry.updatedBy}</TableCell><TableCell>{entry.notes || '-'}</TableCell></TableRow>))}
                        </TableBody></Table></div>) : (<p className="text-center text-muted-foreground py-8">No hay historial de cambios para esta orden.</p>)}
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    );
}


    