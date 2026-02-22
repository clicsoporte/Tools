
'use client';

import React from 'react';
import { useConsignmentsClosures } from '@/modules/consignments/hooks/useConsignmentsClosures';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, FileSignature, Loader2, RefreshCw, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PeriodClosure } from '@/modules/core/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


export default function ClosuresPage() {
    const { state, actions, selectors } = useConsignmentsClosures();

    if (state.isInitialLoading) {
        return <main className="flex-1 p-4 md:p-6 lg:p-8"><Loader2 className="animate-spin" /></main>;
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card className="max-w-6xl mx-auto">
                 <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Gestión de Cierres de Periodo</CardTitle>
                            <CardDescription>
                                Administra los cierres de facturación para los clientes de consignación.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => actions.loadData(true)} disabled={state.isRefreshing}>
                                {state.isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refrescar
                            </Button>
                            <Button onClick={actions.handleInitiateClosure}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Cierre
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Consecutivo</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Fecha Creación</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.closures.map((closure: PeriodClosure & { client_name: string }) => (
                                <TableRow key={closure.id}>
                                    <TableCell className="font-mono font-bold text-primary">{closure.consecutive}</TableCell>
                                    <TableCell>{closure.client_name}</TableCell>
                                    <TableCell>{format(parseISO(closure.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                                    <TableCell>
                                        <Badge variant={closure.status === 'approved' ? 'default' : (closure.status === 'rejected' ? 'destructive' : 'secondary')}>
                                            {selectors.getStatusLabel(closure.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => actions.handleViewClosure(closure.id)}
                                        >
                                            {closure.status === 'pending' ? 'Revisar y Aprobar' : 'Ver Detalles'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={state.isDetailsModalOpen} onOpenChange={actions.setDetailsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aprobar Cierre de Periodo: {state.selectedClosure?.consecutive}</DialogTitle>
                        <DialogDescription>
                            Verifica la información y aprueba el cierre para habilitar la facturación.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                         <div className="space-y-2">
                            <Label>Vincular con Cierre Anterior</Label>
                             <Select value={state.previousClosureId?.toString() || 'none'} onValueChange={(val) => actions.setPreviousClosureId(val === 'none' ? null : Number(val))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar cierre anterior..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No vincular (Inventario Inicial será 0)</SelectItem>
                                    {state.availablePreviousClosures.map(pc => (
                                        <SelectItem key={pc.id} value={String(pc.id)}>
                                            {pc.consecutive} - {format(parseISO(pc.created_at), 'dd/MM/yy')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                El inventario final de este cierre se usará como inventario inicial para el nuevo período.
                            </p>
                        </div>
                        {state.previousClosureId === null && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Primer Cierre de Periodo</AlertTitle>
                                <AlertDescription>
                                    Al no vincular un cierre anterior, estás estableciendo el <strong>inventario inicial oficial</strong> para este cliente. Asegúrate de que esto es correcto.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                             <Label htmlFor="rejection-notes">Notas para Rechazo (Opcional)</Label>
                            <Textarea id="rejection-notes" value={state.notes} onChange={(e) => actions.setNotes(e.target.value)} placeholder="Indica por qué se rechaza el cierre..." />
                        </div>
                    </div>
                    <DialogFooter className="justify-between">
                        <Button variant="destructive" onClick={() => actions.handleReject(state.notes)} disabled={state.isSubmitting}>
                            Rechazar Cierre
                        </Button>
                        <div className="flex gap-2">
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={actions.handleApprove} disabled={state.isSubmitting}>
                                {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Aprobar Cierre
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
