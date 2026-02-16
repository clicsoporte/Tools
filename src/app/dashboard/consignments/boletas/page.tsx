
'use client';

import React from 'react';
import { useConsignmentsBoletas } from '@/modules/consignments/hooks/useConsignmentsBoletas';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Check, Ban, Truck, FileCheck2, Trash2, Undo2, Printer, ArrowUp, ArrowDown, Loader2, RefreshCw, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { RestockBoleta, BoletaLine, BoletaHistory } from '@/modules/core/types';
import type { BoletaSortKey } from '@/modules/consignments/hooks/useConsignmentsBoletas';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function StatusUpdateDialog({ hook }: { hook: ReturnType<typeof useConsignmentsBoletas> }) {
    const { state, actions } = hook;
    const { isSubmitting, boletaToUpdate, statusUpdatePayload, isStatusModalOpen } = state;

    if (!boletaToUpdate) return null;
    
    const statusLabels: Record<string, string> = {
        pending: 'Enviar a Aprobación',
        approved: 'Aprobar',
        sent: 'Marcar como Enviada',
        invoiced: 'Marcar como Facturada',
        canceled: 'Cancelar',
    };

    return (
        <Dialog open={isStatusModalOpen} onOpenChange={actions.setStatusModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{statusLabels[statusUpdatePayload.status] || 'Actualizar'} Boleta {boletaToUpdate.consecutive}</DialogTitle>
                    <DialogDescription>
                        Confirma la acción y añade notas si es necesario.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {statusUpdatePayload.status === 'invoiced' && (
                        <div className="space-y-2">
                            <Label htmlFor="erp-invoice">Número de Factura ERP</Label>
                            <Input id="erp-invoice" value={statusUpdatePayload.erpInvoiceNumber || ''} onChange={(e) => actions.handleStatusUpdatePayloadChange('erpInvoiceNumber', e.target.value)} />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="status-notes">Notas (Opcional)</Label>
                        <Textarea id="status-notes" value={statusUpdatePayload.notes} onChange={(e) => actions.handleStatusUpdatePayloadChange('notes', e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={actions.submitStatusUpdate} disabled={isSubmitting || (statusUpdatePayload.status === 'invoiced' && !statusUpdatePayload.erpInvoiceNumber?.trim())}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BoletaDetailsDialog({ hook }: { hook: ReturnType<typeof useConsignmentsBoletas> }) {
    const { state, actions, selectors } = hook;
    const { isSubmitting, isDetailsModalOpen, detailedBoleta, isDetailsLoading } = state;

    const canEditLines = detailedBoleta?.boleta.status === 'review' && selectors.permissions.canApprove;
    
    const statusConfig = selectors.statusConfig;

    return (
        <Dialog open={isDetailsModalOpen} onOpenChange={actions.setDetailsModalOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Detalles de Boleta: {detailedBoleta?.boleta.consecutive}</DialogTitle>
                </DialogHeader>
                {isDetailsLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : detailedBoleta ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        <div className="md:col-span-2 space-y-4">
                             <h4 className="font-semibold">Líneas de Reposición</h4>
                             <ScrollArea className="h-96 border rounded-md p-2">
                                <div className="space-y-3">
                                    {detailedBoleta.lines.map((line: BoletaLine) => (
                                        <Card key={line.id}>
                                            <CardHeader className="p-3">
                                                <p className="font-medium">{line.product_description}</p>
                                                <p className="text-xs text-muted-foreground">{line.product_id}</p>
                                            </CardHeader>
                                            <CardContent className="p-3 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                                 <div className="space-y-1">
                                                    <Label htmlFor={`count-${line.id}`} className="text-xs">Inv. Físico</Label>
                                                    <Input id={`count-${line.id}`} value={line.counted_quantity} disabled className="h-8 text-right bg-muted" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`max-${line.id}`} className="text-xs">Máximo</Label>
                                                    <Input id={`max-${line.id}`} value={line.max_stock} disabled className="h-8 text-right bg-muted" />
                                                </div>
                                                <div className="space-y-1 col-span-2 md:col-span-2">
                                                    <div className="flex justify-between items-center">
                                                        <Label htmlFor={`replenish-${line.id}`} className="text-xs">A Reponer</Label>
                                                        {line.is_manually_edited === 1 && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.handleResetLineQuantity(line.id)}>
                                                                <Undo2 className="h-4 w-4 text-orange-500"/>
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <Input 
                                                        id={`replenish-${line.id}`}
                                                        type="number" 
                                                        value={line.replenish_quantity}
                                                        onChange={e => actions.handleDetailedLineChange(line.id, Number(e.target.value))}
                                                        className="text-right h-10 text-lg font-bold"
                                                        disabled={!canEditLines}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-semibold">Historial de Estados</h4>
                            <ScrollArea className="h-96 border rounded-md p-2">
                                <div className="space-y-3">
                                {detailedBoleta.history.map((h: BoletaHistory) => {
                                    const statusInfo = statusConfig[h.status as keyof typeof statusConfig] || { label: h.status, color: '#94a3b8' };
                                    return (
                                        <div key={h.id} className="text-xs">
                                            <div className="flex justify-between items-center">
                                                <Badge style={{ backgroundColor: statusInfo.color }} className="text-white">{statusInfo.label}</Badge>
                                                <p className="text-muted-foreground">{format(parseISO(h.timestamp), 'dd/MM/yy HH:mm', {locale: es})}</p>
                                            </div>
                                            <p className="text-muted-foreground mt-1">Por: {h.updatedBy}</p>
                                            {h.notes && <p className="italic text-muted-foreground mt-1">&quot;{h.notes}&quot;</p>}
                                        </div>
                                    );
                                })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                ) : (
                    <p>No se encontraron detalles.</p>
                )}
                 <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cerrar</Button></DialogClose>
                    {canEditLines && 
                        <Button onClick={actions.saveBoletaChanges} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Guardar Cambios
                        </Button>
                    }
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function BoletasPage() {
    const { state, actions, selectors } = useConsignmentsBoletas();
    const { sortKey, sortDirection, filters } = state;
    const { sortedBoletas, agreementOptions } = selectors;
    usePageTitle().setTitle('Gestión de Boletas');

    const renderSortIcon = (key: BoletaSortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
    };

    const statusOptions = Object.entries(selectors.statusConfig).map(([value, { label }]) => ({ value, label }));

    if (state.isInitialLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-5xl mx-auto" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <TooltipProvider>
                <Card className="max-w-6xl mx-auto">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle>Gestión de Boletas de Reposición</CardTitle>
                                <CardDescription>
                                    Aprueba, edita y gestiona el ciclo de vida de las boletas de envío.
                                </CardDescription>
                            </div>
                            <Button variant="outline" onClick={() => actions.loadData(true)} disabled={state.isRefreshing}>
                                {state.isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refrescar
                            </Button>
                        </div>
                         <div className="flex items-center gap-2 flex-wrap pt-4">
                            <MultiSelectFilter
                                title="Filtrar por Cliente"
                                options={agreementOptions}
                                selectedValues={filters.client}
                                onSelectedChange={actions.setBoletaClientFilter}
                            />
                             <MultiSelectFilter
                                title="Filtrar por Estado"
                                options={statusOptions}
                                selectedValues={filters.status}
                                onSelectedChange={actions.setBoletaStatusFilter}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => actions.handleBoletaSort('consecutive')}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">Consecutivo {renderSortIcon('consecutive')}</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Número único de la boleta de reposición. Se genera automáticamente basado en el cliente.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => actions.handleBoletaSort('client_name')}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">Cliente {renderSortIcon('client_name')}</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Cliente de consignación al que pertenece la boleta.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => actions.handleBoletaSort('created_at')}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">Fecha Creación {renderSortIcon('created_at')}</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Fecha y hora en que se finalizó el conteo de inventario y se generó la boleta.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => actions.handleBoletaSort('status')}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">Estado {renderSortIcon('status')}</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Estado actual de la boleta en el flujo de aprobación.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead className="cursor-pointer text-right" onClick={() => actions.handleBoletaSort('total_replenish_quantity')}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center justify-end">Total a Reponer {renderSortIcon('total_replenish_quantity')}</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Suma total de las unidades de todos los productos que se necesitan reponer para alcanzar el stock máximo.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>Factura ERP</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Número de la factura del ERP con la que se procesó esta reposición. Aparece después de marcar la boleta como 'Facturada'.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>Acciones</div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Menú de acciones disponibles para la boleta según su estado actual y tus permisos.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedBoletas.map((boleta: RestockBoleta) => (
                                    <TableRow key={boleta.id}>
                                        <TableCell className="font-mono text-red-600 font-bold">{boleta.consecutive}</TableCell>
                                        <TableCell>{selectors.getAgreementName(boleta.agreement_id)}</TableCell>
                                        <TableCell>{format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                                        <TableCell>
                                            <Badge style={{ backgroundColor: selectors.statusConfig[boleta.status as keyof typeof selectors.statusConfig]?.color }} className="text-white">
                                                {selectors.statusConfig[boleta.status as keyof typeof selectors.statusConfig]?.label || 'Desconocido'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {(boleta.total_replenish_quantity ?? 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-mono">{boleta.erp_invoice_number}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => actions.openBoletaDetails(boleta.id)}>
                                                        <FileText className="mr-2 h-4 w-4" /> Ver/Editar Detalles
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.handlePrintBoleta(boleta)} disabled={!['approved', 'sent', 'invoiced'].includes(boleta.status)}>
                                                        <Printer className="mr-2 h-4 w-4" /> Imprimir Boleta
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'pending')} disabled={boleta.status !== 'review' || !selectors.permissions.canSubmitForApproval}>
                                                        <Send className="mr-2 h-4 w-4" /> Enviar a Aprobación
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'approved')} disabled={boleta.status !== 'pending' || !selectors.permissions.canApprove}>
                                                        <Check className="mr-2 h-4 w-4" /> Aprobar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'sent')} disabled={boleta.status !== 'approved' || !selectors.permissions.canSend}>
                                                        <Truck className="mr-2 h-4 w-4" /> Marcar como Enviada
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'invoiced')} disabled={boleta.status !== 'sent' || !selectors.permissions.canInvoice}>
                                                        <FileCheck2 className="mr-2 h-4 w-4" /> Marcar como Facturada
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'review')} disabled={!['pending', 'approved'].includes(boleta.status) || !selectors.permissions.canRevert} className="text-orange-600">
                                                        <Undo2 className="mr-2 h-4 w-4" /> Devolver a Revisión
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'sent')} disabled={boleta.status !== 'invoiced' || !selectors.permissions.canRevert} className="text-orange-600">
                                                        <Undo2 className="mr-2 h-4 w-4" /> Revertir a Enviada
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => actions.openStatusModal(boleta, 'canceled')} className="text-red-500" disabled={boleta.status === 'canceled' || boleta.status === 'invoiced' || !selectors.permissions.canCancel}>
                                                        <Ban className="mr-2 h-4 w-4" /> Cancelar Boleta
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <StatusUpdateDialog hook={{state, actions, selectors}} />
                <BoletaDetailsDialog hook={{state, actions, selectors}} />
            </TooltipProvider>
        </main>
    );
}
