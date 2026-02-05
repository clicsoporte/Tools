'use client';

import React from 'react';
import { useCorrectionTool, type SortKey } from '@/modules/warehouse/hooks/useCorrectionTool';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Search, FilterX, Edit2, Undo2, Save, Printer, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { DialogColumnSelector } from '@/components/ui/dialog-column-selector';

export default function CorrectionClient() {
    const { state, actions, selectors } = useCorrectionTool();

    const { isSearching, isSubmitting, filters, searchResults, unitToCorrect, isConfirmModalOpen, newProductSearch, isNewProductSearchOpen, editableUnit, visibleColumns, sortKey, sortDirection, currentPage, rowsPerPage } = state;
    
    const renderSortIcon = (key: any) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? ' ▲' : ' ▼';
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Administración de Ingresos</CardTitle>
                        <CardDescription>Busca una unidad de inventario para corregir su cantidad, producto o para aplicarla al sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>Rango de Fechas de Ingreso</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.dateRange?.from ? (filters.dateRange.to ? (`${format(filters.dateRange.from, "LLL dd, y", { locale: es })} - ${format(filters.dateRange.to, "LLL dd, y", { locale: es })}`) : format(filters.dateRange.from, "LLL dd, y", { locale: es })) : (<span>Seleccionar rango</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={filters.dateRange?.from} selected={filters.dateRange} onSelect={(range) => actions.setFilter('dateRange', range)} numberOfMonths={2} locale={es} /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="consecutive-search">Nº Consecutivo</Label>
                                <Input id="consecutive-search" placeholder="Buscar por ING- o U-" value={filters.receptionConsecutive} onChange={e => actions.setFilter('receptionConsecutive', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="product-search">Cód. Producto</Label>
                                <Input id="product-search" placeholder="Buscar por código de producto..." value={filters.productId} onChange={e => actions.setFilter('productId', e.target.value)} />
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="lot-search">Nº Lote / ID Físico</Label>
                                <Input id="lot-search" placeholder="Buscar por lote..." value={filters.humanReadableId} onChange={e => actions.setFilter('humanReadableId', e.target.value)} />
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="doc-search">Nº Documento</Label>
                                <Input id="doc-search" placeholder="Buscar por boleta, factura..." value={filters.documentId} onChange={e => actions.setFilter('documentId', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="show-voided" checked={filters.showVoided} onCheckedChange={(checked) => actions.setFilter('showVoided', !!checked)} />
                                <Label htmlFor="show-voided" className="font-normal">Mostrar anulados</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="show-pending" checked={filters.statusFilter === 'pending'} onCheckedChange={actions.handleStatusFilterChange} />
                                <Label htmlFor="show-pending" className="font-normal">Mostrar solo pendientes</Label>
                            </div>
                            <Button onClick={actions.handleSearch} disabled={isSearching}>
                                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                                Buscar
                            </Button>
                            <Button variant="ghost" onClick={actions.handleClearFilters}>
                                <FilterX className="mr-2 h-4 w-4" />
                                Limpiar Filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <CardTitle>Resultados de Búsqueda ({searchResults.length})</CardTitle>
                            <DialogColumnSelector
                                allColumns={selectors.availableColumns}
                                visibleColumns={visibleColumns}
                                onColumnChange={actions.handleColumnVisibilityChange}
                                onSave={actions.savePreferences}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[50vh] w-full border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {selectors.visibleColumnsData.map(col => (
                                            <TableHead key={col.id} className="cursor-pointer" onClick={() => actions.handleSort(col.id as SortKey)}>
                                                {col.label} {renderSortIcon(col.id)}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isSearching ? (
                                        <TableRow><TableCell colSpan={selectors.visibleColumnsData.length + 1} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : selectors.paginatedResults.length > 0 ? (
                                        selectors.paginatedResults.map(unit => (
                                            <TableRow key={unit.id} className={unit.status === 'voided' ? 'bg-destructive/10 text-muted-foreground' : ''}>
                                                {selectors.visibleColumnsData.map(col => {
                                                     const { content, className, type, variant } = selectors.getColumnContent(unit, col.id);
                                                     if (type === 'badge') {
                                                         return <TableCell key={col.id}><Badge variant={variant} className={className}>{content}</Badge></TableCell>
                                                     }
                                                     if (type === 'multiline') {
                                                         return <TableCell key={col.id}><p className={content[0].className}>{content[0].text}</p><p className={content[1].className}>{content[1].text}</p></TableCell>
                                                     }
                                                     return <TableCell key={col.id} className={className}>{content}</TableCell>
                                                })}
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => actions.handlePrintTicket(unit)}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button>
                                                    <Button variant="outline" size="sm" onClick={() => actions.setUnitToCorrect(unit)} disabled={unit.status === 'voided'}>
                                                        <Edit2 className="mr-2 h-4 w-4"/>
                                                        {unit.status === 'pending' ? 'Revisar y Aplicar' : 'Corregir'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={selectors.visibleColumnsData.length + 1} className="h-24 text-center">No se encontraron resultados.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                    {selectors.totalPages > 1 && (
                        <CardFooter>
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); actions.setCurrentPage(p => p - 1) }} className={currentPage === 0 ? 'pointer-events-none opacity-50' : undefined} />
                                    </PaginationItem>
                                     <PaginationItem>
                                        <span className="p-2 text-sm">Página {currentPage + 1} de {selectors.totalPages}</span>
                                    </PaginationItem>
                                    <PaginationItem>
                                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); actions.setCurrentPage(p => p + 1) }} className={currentPage >= selectors.totalPages - 1 ? 'pointer-events-none opacity-50' : undefined} />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </CardFooter>
                    )}
                </Card>
                <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {unitToCorrect?.status === 'pending' ? 'Revisar y Aplicar Ingreso' : 'Corregir Ingreso de Inventario'}
                            </DialogTitle>
                            <DialogDescription>
                                {unitToCorrect?.status === 'pending' ? 'Revisa y modifica los datos del ingreso antes de aplicarlo al inventario.' : 'Esta acción anulará el ingreso original y creará uno nuevo con los datos corregidos.'}
                            </DialogDescription>
                        </DialogHeader>
                        {unitToCorrect && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                <Card className="bg-muted/30">
                                    <CardHeader>
                                        <CardTitle className="text-base">Datos Originales</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div><Label>Producto</Label><p>{selectors.getOriginalProductName()}</p></div>
                                        <div><Label>Cantidad</Label><p>{unitToCorrect.quantity}</p></div>
                                        <div><Label>Lote / ID Físico</Label><p>{unitToCorrect.humanReadableId || 'N/A'}</p></div>
                                        <div><Label>Documento</Label><p>{unitToCorrect.documentId || 'N/A'}</p></div>
                                        <div><Label>Documento ERP</Label><p>{unitToCorrect.erpDocumentId || 'N/A'}</p></div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Datos Corregidos</CardTitle>
                                         <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={actions.resetEditableUnit}>
                                                <Undo2 className="mr-2 h-4 w-4"/>
                                                Restaurar
                                            </Button>
                                             <Button variant="destructive" size="sm" onClick={actions.handleClearForm}>
                                                Limpiar
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="new-product">Producto</Label>
                                            <SearchInput
                                                options={selectors.productOptions}
                                                onSelect={actions.handleSelectNewProduct}
                                                value={newProductSearch}
                                                onValueChange={actions.setNewProductSearch}
                                                open={isNewProductSearchOpen}
                                                onOpenChange={actions.setNewProductSearchOpen}
                                                placeholder="Buscar nuevo producto..."
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="new-quantity">Cantidad</Label>
                                            <Input id="new-quantity" type="number" value={editableUnit.quantity ?? ''} onChange={e => actions.setEditableUnitField('quantity', parseFloat(e.target.value))} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor="new-lot">Lote / ID Físico</Label>
                                            <Input id="new-lot" value={editableUnit.humanReadableId ?? ''} onChange={e => actions.setEditableUnitField('humanReadableId', e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="new-doc">Documento</Label>
                                            <Input id="new-doc" value={editableUnit.documentId ?? ''} onChange={e => actions.setEditableUnitField('documentId', e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="new-erp-doc">Documento ERP</Label>
                                            <Input id="new-erp-doc" value={editableUnit.erpDocumentId ?? ''} onChange={e => actions.setEditableUnitField('erpDocumentId', e.target.value)} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={isSubmitting || !selectors.isCorrectionFormValid} variant={unitToCorrect?.status === 'pending' ? 'default' : 'destructive'}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (unitToCorrect?.status === 'pending' ? <CheckCircle className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />)}
                                        {unitToCorrect?.status === 'pending' ? 'Aplicar Ingreso' : 'Guardar Corrección'}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-6 w-6 text-destructive" />
                                                ¿Confirmar acción?
                                            </div>
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {unitToCorrect?.status === 'pending'
                                              ? 'Estás a punto de aplicar este ingreso al inventario con las modificaciones realizadas. Esta acción es final para este registro.'
                                              : 'Estás a punto de anular el ingreso original y crear uno nuevo con los datos corregidos. Revisa cuidadosamente los cambios.'
                                            }
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={actions.handleConfirmCorrection}>Sí, continuar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}
