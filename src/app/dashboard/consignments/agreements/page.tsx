'use client';

import React from 'react';
import { useConsignmentsAgreements } from '@/modules/consignments/hooks/useConsignmentsAgreements';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Edit2, Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchInput } from '@/components/ui/search-input';
import { ConsignmentAgreement, ConsignmentProduct } from '@/modules/core/types';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Skeleton } from '@/components/ui/skeleton';

export default function AgreementsPage() {
    const { state, actions, selectors } = useConsignmentsAgreements();
    usePageTitle().setTitle('Acuerdos de Consignación');

    if (state.isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-5xl mx-auto" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card className="max-w-5xl mx-auto">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Acuerdos de Consignación</CardTitle>
                            <CardDescription>
                                Define los clientes, bodegas, productos y stocks máximos para cada consignación.
                            </CardDescription>
                        </div>
                        {selectors.hasPermission('consignments:setup') && (
                            <Button onClick={() => actions.openAgreementForm()}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Acuerdo
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 pt-4">
                        <Switch
                            id="active-filter"
                            checked={state.showOnlyActiveAgreements}
                            onCheckedChange={actions.setShowOnlyActiveAgreements}
                        />
                        <Label htmlFor="active-filter">Mostrar solo acuerdos activos</Label>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Bodega ERP</TableHead>
                                <TableHead>Productos</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectors.filteredAgreements.map((agreement: ConsignmentAgreement & { product_count?: number }) => (
                                <TableRow key={agreement.id}>
                                    <TableCell className="font-medium">{agreement.client_name}</TableCell>
                                    <TableCell>{agreement.erp_warehouse_id}</TableCell>
                                    <TableCell>{agreement.product_count || 0}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={agreement.is_active === 1}
                                            onCheckedChange={(checked) => actions.toggleAgreementStatus(agreement.id, checked)}
                                            disabled={!selectors.hasPermission('consignments:setup')}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => actions.openAgreementForm(agreement)} disabled={!selectors.hasPermission('consignments:setup')}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                         <AlertDialog open={state.agreementToDelete?.id === agreement.id} onOpenChange={(open) => !open && actions.setAgreementToDelete(null)}>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={!selectors.hasPermission('consignments:setup')} onClick={() => actions.setAgreementToDelete(agreement)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción eliminará permanentemente el acuerdo para <strong>{state.agreementToDelete?.client_name}</strong>. Esto solo es posible si el acuerdo no tiene boletas de reposición asociadas.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={actions.handleDeleteAgreement}
                                                        disabled={state.isSubmitting}
                                                    >
                                                        {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                        Sí, Eliminar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={state.isAgreementFormOpen} onOpenChange={actions.setIsAgreementFormOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{state.editingAgreement ? 'Editar' : 'Nuevo'} Acuerdo de Consignación</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="client-search">Cliente</Label>
                                <SearchInput
                                    options={selectors.customerOptions}
                                    onSelect={(value) => actions.handleFieldChange('client_id', value)}
                                    value={state.clientSearchTerm}
                                    onValueChange={actions.setClientSearchTerm}
                                    open={state.isClientSearchOpen}
                                    onOpenChange={actions.setIsClientSearchOpen}
                                    placeholder="Buscar cliente..."
                                    disabled={!!state.editingAgreement}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="erp-warehouse">Bodega ERP Asignada (sin IVA)</Label>
                                <SearchInput
                                    options={selectors.warehouseOptions}
                                    onSelect={(value) => actions.handleFieldChange('erp_warehouse_id', value)}
                                    value={state.warehouseSearchTerm}
                                    onValueChange={actions.setWarehouseSearchTerm}
                                    open={state.isWarehouseSearchOpen}
                                    onOpenChange={actions.setIsWarehouseSearchOpen}
                                    placeholder="Buscar bodega virtual..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notas</Label>
                                <Textarea
                                    id="notes"
                                    value={state.agreementFormData.notes || ''}
                                    onChange={(e) => actions.handleFieldChange('notes', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label>Productos Autorizados</Label>
                            <div className="space-y-2">
                                <SearchInput
                                    options={selectors.productOptions}
                                    onSelect={actions.addProductToAgreement}
                                    value={state.productSearchTerm}
                                    onValueChange={actions.setProductSearchTerm}
                                    open={state.isProductSearchOpen}
                                    onOpenChange={actions.setIsProductSearchOpen}
                                    placeholder="Añadir producto..."
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Máximo</TableHead>
                                            <TableHead>Precio (sin IVA)</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {state.agreementProducts.map((p: ConsignmentProduct, index: number) => (
                                            <TableRow key={p.product_id}>
                                                <TableCell>{selectors.getProductName(p.product_id)}</TableCell>
                                                <TableCell>
                                                    <Input type="number" value={p.max_stock || ''} onChange={(e) => actions.updateProductField(index, 'max_stock', Number(e.target.value))} className="w-24 hide-number-arrows"/>
                                                </TableCell>
                                                <TableCell>
                                                    <Input type="number" value={p.price || ''} onChange={(e) => actions.updateProductField(index, 'price', Number(e.target.value))} className="w-28 hide-number-arrows"/>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => actions.removeProductFromAgreement(index)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleSaveAgreement} disabled={state.isSubmitting}>
                            {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Guardar Acuerdo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
