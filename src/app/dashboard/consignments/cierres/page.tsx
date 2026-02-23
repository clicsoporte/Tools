

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/modules/core/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function ClosuresPage() {
    const { products } = useAuth();
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
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.closures.map((closure: PeriodClosure & { client_name: string; is_initial_inventory: boolean; }) => (
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
                                        {closure.is_initial_inventory && (
                                            <Badge variant="outline" className="border-green-600 text-green-700">
                                                Inventario Inicial
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => actions.handleViewClosure(closure)}
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
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{state.selectedClosure?.status === 'pending' ? 'Revisar y Aprobar Cierre' : 'Detalles del Cierre'}: {state.selectedClosure?.consecutive}</DialogTitle>
                        <DialogDescription>
                             {state.selectedClosure?.status === 'pending' ? 'Verifica el conteo y aprueba el cierre para habilitar la facturación.' : 'Detalles del cierre y su estado actual.'}
                        </DialogDescription>
                    </DialogHeader>
                    {state.isDetailsLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-lg">Conteo Físico Registrado</h4>
                                <ScrollArea className="h-72 border rounded-md p-2">
                                    {state.physicalCountLines.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="text-right">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {state.physicalCountLines.map(line => {
                                                    const product = products.find(p => p.id === line.product_id);
                                                    return (
                                                        <TableRow key={line.id}>
                                                            <TableCell>
                                                                <p className="font-medium">{product?.description || 'Desconocido'}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{line.product_id}</p>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold">{line.quantity}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <p>No se encontraron datos de conteo.</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                            <div className="space-y-4">
                                {state.selectedClosure?.status === 'pending' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Vincular con Cierre Anterior</Label>
                                            <Select value={state.previousClosureId?.toString() || 'none'} onValueChange={(val) => actions.setPreviousClosureId(val === 'none' ? null : Number(val))}>
                                                <SelectTrigger><SelectValue placeholder="Seleccionar cierre anterior..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No vincular (Esto establecerá el Inventario Inicial)</SelectItem>
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
                                            <Alert variant="default" className="bg-green-50 border-green-200">
                                                <Info className="h-4 w-4" />
                                                <AlertTitle>Estableciendo Inventario Inicial</AlertTitle>
                                                <AlertDescription>
                                                    Al no vincular un cierre anterior, estás estableciendo el <strong>inventario inicial oficial</strong> para este cliente. Asegúrate de que esto sea correcto.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        <div className="space-y-2">
                                            <Label htmlFor="rejection-notes">Notas para Rechazo (Opcional)</Label>
                                            <Textarea id="rejection-notes" value={state.notes} onChange={(e) => actions.setNotes(e.target.value)} placeholder="Indica por qué se rechaza el cierre..." />
                                        </div>
                                    </>
                                )}
                                {state.selectedClosure?.status === 'rejected' && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Cierre Rechazado</AlertTitle>
                                        <AlertDescription>
                                            <p className="mb-2"><strong>Rechazado por:</strong> {state.selectedClosure.approved_by}</p>
                                            <p><strong>Motivo:</strong> {state.selectedClosure.notes || 'No se especificó un motivo.'}</p>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {state.selectedClosure?.status === 'approved' && (
                                    <Alert variant="default" className="bg-green-50 border-green-200">
                                        <AlertTitle>Cierre Aprobado</AlertTitle>
                                        <AlertDescription>
                                            <p className="mb-2"><strong>Aprobado por:</strong> {state.selectedClosure.approved_by}</p>
                                            <p>Ya puedes generar el reporte de facturación para este período.</p>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center">
                        <div className="flex-1 sm:flex-grow-0">
                           {state.selectedClosure?.status === 'pending' && (
                                <Button variant="destructive" onClick={() => actions.handleReject(state.notes)} disabled={state.isSubmitting}>
                                    Rechazar Cierre
                                </Button>
                           )}
                        </div>
                        <div className="flex gap-2">
                            <DialogClose asChild><Button variant="ghost">Cerrar</Button></DialogClose>
                            {state.selectedClosure?.status === 'pending' && (
                                <Button onClick={actions.handleApprove} disabled={state.isSubmitting}>
                                    {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Aprobar Cierre
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
