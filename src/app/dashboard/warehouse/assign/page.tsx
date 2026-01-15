/**
 * @fileoverview Page for associating products with clients and warehouse locations.
 * This tool allows users to create a catalog-like mapping, indicating where
 * a specific client's product should be stored.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogClose, 
    DialogTrigger 
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    AlertDialogFooter,
  } from '@/components/ui/alert-dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, Trash2, List, PlusCircle, Search, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useItemLocation } from '@/modules/warehouse/hooks/useItemLocation';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';


export default function AssignItemPage() {
    const { setTitle } = usePageTitle();
    const { state, actions, selectors } = useItemLocation();
    
    React.useEffect(() => {
        setTitle("Catálogo de Clientes por Artículo");
    }, [setTitle]);

    const { 
        isLoading, isSubmitting, isFormOpen, isEditing,
        globalFilter, currentPage, rowsPerPage,
        formData, productSearchTerm, isProductSearchOpen,
        clientSearchTerm, isClientSearchOpen, locationSearchTerm, isLocationSearchOpen
    } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <CardTitle>Catálogo de Clientes por Artículo</CardTitle>
                                <CardDescription>Gestiona las ubicaciones y la exclusividad de los productos de tus clientes.</CardDescription>
                            </div>
                            {selectors.hasPermission('warehouse:item-assignment:create') && (
                                <Button onClick={actions.openCreateForm}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>Asociar Producto a Cliente
                                </Button>
                            )}
                        </div>
                         <div className="relative mt-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar asignaciones por producto, cliente o ubicación..."
                                value={globalFilter}
                                onChange={(e) => actions.setGlobalFilter(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Ubicación Asignada</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Última Actualización</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectors.paginatedAssignments.length > 0 ? selectors.paginatedAssignments.map(a => {
                                        return (
                                            <TableRow key={a.id}>
                                                <TableCell className="font-medium">
                                                    <div>{selectors.getProductName(a.itemId)}</div>
                                                    <div className="text-xs text-muted-foreground">{a.itemId}</div>
                                                </TableCell>
                                                <TableCell>{selectors.getClientName(a.clientId)}</TableCell>
                                                <TableCell>{selectors.getLocationPath(a.locationId)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={a.isExclusive ? "destructive" : "secondary"}>
                                                        {a.isExclusive ? 'Exclusivo' : 'General'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {a.updatedBy ? (
                                                        <>
                                                            <div>{a.updatedBy}</div>
                                                            <div>{format(parseISO(a.updatedAt!), 'dd/MM/yyyy HH:mm', { locale: es })}</div>
                                                        </>
                                                    ) : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="ghost" size="icon" onClick={() => actions.openEditForm(a)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    {selectors.hasPermission('warehouse:item-assignment:delete') && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                              <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                  Esta acción eliminará la asignación permanentemente. No se puede deshacer.
                                                                </AlertDialogDescription>
                                                              </AlertDialogHeader>
                                                              <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => actions.handleDeleteAssignment(a.id!)}>Eliminar</AlertDialogAction>
                                                              </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                {globalFilter ? 'No se encontraron asignaciones con ese filtro.' : 'No hay asignaciones creadas.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    {selectors.totalPages > 0 && (
                        <CardFooter className="flex w-full items-center justify-between pt-4">
                             <div className="text-sm text-muted-foreground">
                                Total de {selectors.filteredAssignments.length} asignacion(es).
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="rows-per-page">Filas:</Label>
                                    <Select value={String(rowsPerPage)} onValueChange={(value) => actions.setRowsPerPage(Number(value))}>
                                        <SelectTrigger id="rows-per-page" className="w-20"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[10, 25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <span className="text-sm text-muted-foreground">Página {currentPage + 1} de {selectors.totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage(p => Math.min(selectors.totalPages - 1, p + 1))} disabled={currentPage >= selectors.totalPages - 1}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardFooter>
                    )}
                </Card>
                 <Dialog open={isFormOpen} onOpenChange={(open) => { actions.setIsFormOpen(open); if (!open) actions.resetForm(); }}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? 'Editar Asignación' : 'Asociar Producto a Cliente y Ubicación'}</DialogTitle>
                            <DialogDescription>
                                {isEditing ? 'Modifica el cliente o la exclusividad de esta asignación.' : 'Crea una nueva asociación entre producto, cliente y ubicación.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            <div className="space-y-2">
                                <Label>Producto <span className="text-destructive">*</span></Label>
                                <SearchInput options={selectors.productOptions} onSelect={actions.handleSelectProduct} value={productSearchTerm} onValueChange={actions.setProductSearchTerm} placeholder="Buscar producto..." open={isProductSearchOpen} onOpenChange={actions.setIsProductSearchOpen} disabled={isEditing}/>
                            </div>
                            <div className="space-y-2">
                                <Label>Ubicación <span className="text-destructive">*</span></Label>
                                <div className="flex items-center gap-2">
                                    <SearchInput options={selectors.locationOptions} onSelect={actions.handleSelectLocation} value={locationSearchTerm} onValueChange={actions.setLocationSearchTerm} placeholder="Buscar... ('*' para ver todas)" open={isLocationSearchOpen} onOpenChange={actions.setIsLocationSearchOpen} disabled={isEditing}/>
                                    <Button type="button" variant="outline" size="icon" onClick={() => {actions.setLocationSearchTerm('*'); actions.setIsLocationSearchOpen(true)}} disabled={isEditing}>
                                        <List className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Cliente (Opcional)</Label>
                                <div className="flex items-center gap-2">
                                    <SearchInput options={selectors.clientOptions} onSelect={(val) => actions.handleSelectClient(val)} value={clientSearchTerm} onValueChange={actions.setClientSearchTerm} placeholder="Buscar cliente..." open={isClientSearchOpen} onOpenChange={actions.setIsClientSearchOpen} />
                                    <Button type="button" variant="outline" size="icon" onClick={() => actions.handleSelectClient(null)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox id="is-exclusive-check" checked={formData.isExclusive} onCheckedChange={(checked) => actions.setFormData({...formData, isExclusive: !!checked})} disabled={!formData.selectedClientId} />
                                    <Label htmlFor="is-exclusive-check" className="font-normal">
                                        Asignación exclusiva para este cliente (no es de venta general)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="requires-certificate-check" checked={formData.requiresCertificate} onCheckedChange={(checked) => actions.setFormData({...formData, requiresCertificate: !!checked})} />
                                    <Label htmlFor="requires-certificate-check" className="font-normal">
                                        Requiere Certificado de Calidad
                                    </Label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={actions.handleSubmit} disabled={isSubmitting || !formData.selectedProductId || !formData.selectedLocationId}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? 'Guardar Cambios' : 'Crear Asignación'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}
