
/**
 * @fileoverview Main page for the new Consignments module.
 */
'use client';

import React from 'react';
import { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BoletaLine, BoletaHistory } from '@/modules/core/types';
import { cn } from '@/lib/utils';
import { AgreementsTab } from './agreements-tab';
import { InventoryCountTab } from './inventory-count-tab';
import { BoletasTab } from './boletas-tab';

function StatusUpdateDialog({ hook }: { hook: ReturnType<typeof useConsignments> }) {
    const { state, actions } = hook;
    const { boletasState, isSubmitting } = state;
    const { boletaToUpdate, statusUpdatePayload, isStatusModalOpen } = boletasState;

    if (!boletaToUpdate) return null;
    
    const statusLabels: Record<string, string> = {
        approved: 'Aprobar',
        sent: 'Marcar como Enviada',
        invoiced: 'Marcar como Facturada',
        canceled: 'Cancelar',
    };

    return (
        <Dialog open={isStatusModalOpen} onOpenChange={actions.boletaActions.setStatusModalOpen}>
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
                            <Input id="erp-invoice" value={statusUpdatePayload.erpInvoiceNumber || ''} onChange={(e) => actions.boletaActions.handleStatusUpdatePayloadChange('erpInvoiceNumber', e.target.value)} />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="status-notes">Notas (Opcional)</Label>
                        <Textarea id="status-notes" value={statusUpdatePayload.notes} onChange={(e) => actions.boletaActions.handleStatusUpdatePayloadChange('notes', e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={actions.boletaActions.submitStatusUpdate} disabled={isSubmitting || (statusUpdatePayload.status === 'invoiced' && !statusUpdatePayload.erpInvoiceNumber?.trim())}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BoletaDetailsDialog({ hook }: { hook: ReturnType<typeof useConsignments> }) {
    const { state, actions, selectors } = hook;
    const { boletasState, isSubmitting } = state;
    const { isDetailsModalOpen, detailedBoleta, isDetailsLoading } = boletasState;

    const canEditLines = detailedBoleta?.boleta.status === 'pending' && selectors.hasPermission('consignments:approve');
    
    const statusConfig = selectors.statusConfig;

    return (
        <Dialog open={isDetailsModalOpen} onOpenChange={actions.boletaActions.setDetailsModalOpen}>
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
                             <ScrollArea className="h-72 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-right">Inv. Físico</TableHead>
                                            <TableHead className="text-right">Máximo</TableHead>
                                            <TableHead className="text-right w-28">Reponer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailedBoleta.lines.map((line: BoletaLine) => (
                                            <TableRow key={line.id}>
                                                <TableCell>
                                                    <p className="font-medium">{line.product_description}</p>
                                                    <p className="text-xs text-muted-foreground">{line.product_id}</p>
                                                </TableCell>
                                                <TableCell className="text-right">{line.counted_quantity}</TableCell>
                                                <TableCell className="text-right">{line.max_stock}</TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={line.replenish_quantity}
                                                        onChange={e => actions.boletaActions.handleDetailedLineChange(line.id, Number(e.target.value))}
                                                        className="text-right"
                                                        disabled={!canEditLines}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-semibold">Historial de Estados</h4>
                            <ScrollArea className="h-72 border rounded-md p-2">
                                <div className="space-y-3">
                                {detailedBoleta.history.map((h: BoletaHistory) => {
                                    const statusInfo = statusConfig[h.status as keyof typeof statusConfig] || { label: h.status, color: 'bg-gray-400' };
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
                        <Button onClick={actions.boletaActions.saveBoletaChanges} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Guardar Cambios
                        </Button>
                    }
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function ConsignmentsPage() {
    const { isAuthorized } = useAuthorization(['consignments:access']);
    const hook = useConsignments();
    const { state } = hook;
    const { isLoading } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8 flex justify-center items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </main>
        );
    }
    
    if (!isAuthorized) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Acceso Denegado</CardTitle>
                        <CardDescription>No tienes permiso para acceder a este módulo.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <AgreementsTab hook={hook} />
            <InventoryCountTab hook={hook} />
            <BoletasTab hook={hook} />
            <StatusUpdateDialog hook={hook} />
            <BoletaDetailsDialog hook={hook} />
        </main>
    );
}

