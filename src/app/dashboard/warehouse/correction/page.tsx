/**
 * @fileoverview Page for correcting warehouse receiving errors with advanced search.
 */
'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchInput } from '@/components/ui/search-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Search, RotateCcw, Package, AlertTriangle, Calendar as CalendarIcon, FilterX, Info, Check, Printer, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCorrectionTool, type SortKey } from '@/modules/warehouse/hooks/useCorrectionTool';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Badge } from '@/components/ui/badge';
import { DialogColumnSelector } from '@/components/ui/dialog-column-selector';
import type { InventoryUnit } from '@/modules/core/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';


export default function CorrectionPage() {
    useAuthorization(['warehouse:correction:execute']);
    const { setTitle } = usePageTitle();
    const { state, actions, selectors } = useCorrectionTool();
    const {
        isSearching,
        isSubmitting,
        filters,
        isConfirmModalOpen,
        newProductSearch,
        isNewProductSearchOpen,
        editableUnit,
        visibleColumns,
        sortKey,
        sortDirection,
    } = state;

    useEffect(() => {
        setTitle("Administración de Ingresos");
    }, [setTitle]);

    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
    };
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6"/>Buscar Ingresos</CardTitle>
                        <CardDescription>Usa los filtros para encontrar la unidad de inventario que necesitas aplicar o corregir.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Rango de Fechas</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal', !filters.dateRange && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.dateRange?.from ? (filters.dateRange.to ? (`${format(filters.dateRange.from, 'LLL dd, y', { locale: es })} - ${format(filters.dateRange.to, 'LLL dd, y', { locale: es })}`) : format(filters.dateRange.from, 'LLL dd, y', { locale: es })) : (<span>Rango de Fechas</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={filters.dateRange?.from} selected={filters.dateRange} onSelect={(range) => actions.setFilter('dateRange', range)} numberOfMonths={2} locale={es} /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2"><Label htmlFor="productId">Código Producto</Label><Input id="productId" value={filters.productId} onChange={e => actions.setFilter('productId', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="humanReadableId">Nº Lote / ID Físico</Label><Input id="humanReadableId" value={filters.humanReadableId} onChange={e => actions.setFilter('humanReadableId', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="unitCode">ID Unidad (U-XXXXX)</Label><Input id="unitCode" value={filters.unitCode} onChange={e => actions.setFilter('unitCode', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="receptionConsecutive">Consecutivo Ingreso (ING-XXXXX)</Label><Input id="receptionConsecutive" value={filters.receptionConsecutive} onChange={e => actions.setFilter('receptionConsecutive', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="documentId">Nº Documento</Label><Input id="documentId" value={filters.documentId} onChange={e => actions.setFilter('documentId', e.target.value)} /></div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch id="show-only-pending" checked={filters.statusFilter === 'pending'} onCheckedChange={actions.handleStatusFilterChange} />
                                <Label htmlFor="show-only-pending">Mostrar solo pendientes</Label>
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Checkbox id="showVoided" checked={filters.showVoided} onCheckedChange={(checked) => actions.setFilter('showVoided', !!checked)} />
                                <Label htmlFor="showVoided">Incluir anulados</Label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                        <Button onClick={actions.handleSearch} disabled={isSearching}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                            Buscar Ingresos
                        </Button>
                        <Button variant="ghost" onClick={actions.handleClearFilters}>
                            <FilterX className="mr-2 h-4 w-4"/>
                            Limpiar
                        </Button>
                    </CardFooter>
                </Card>

                {state.searchResults.length > 0 && (
                    <Card>
                        <CardHeader>
                           <div className="flex justify-between items-center">
                                <CardTitle>Resultados de la Búsqueda ({selectors.sortedResults.length})</CardTitle>
                                <DialogColumnSelector
                                    allColumns={selectors.availableColumns}
                                    visibleColumns={visibleColumns}
                                    onColumnChange={actions.handleColumnVisibilityChange}
                                    onSave={actions.savePreferences}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative overflow-auto h-[60vh] w-full rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            {selectors.visibleColumnsData.map((col: { id: string, label: string }) => (
                                                <TableHead key={col.id} className="cursor-pointer" onClick={() => actions.handleSort(col.id as SortKey)}>
                                                    <div className="flex items-center gap-1">
                                                        {col.label} {renderSortIcon(col.id as SortKey)}
                                                    </div>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-right sticky right-0 bg-background p-2">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectors.paginatedResults.map((unit: InventoryUnit) => {
                                            const isVoided = !!unit.correctionConsecutive;
                                            return (
                                                <TableRow key={unit.id} className={cn(isVoided && 'bg-destructive/10 text-destructive')}>
                                                    {visibleColumns.map(colId => {
                                                        const { content, className, type, variant } = selectors.getColumnContent(unit, colId);
                                                        return (
                                                            <TableCell key={colId} className={cn(className, isVoided && 'text-destructive')}>
                                                                {type === 'badge' ? (
                                                                    <Badge variant={variant}>{content}</Badge>
                                                                ) : type === 'multiline' && Array.isArray(content) ? (
                                                                    <div>
                                                                        {content.map((line: any, i: number) => <p key={i} className={line.className}>{line.text}</p>)}
                                                                    </div>
                                                                ) : (
                                                                    content
                                                                )}
                                                            </TableCell>
                                                        )
                                                    })}
                                                    <TableCell className="text-right sticky right-0 bg-card p-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isVoided ? null : unit.status === 'pending' ? (
                                                                <Button variant="default" size="sm" onClick={() => actions.setUnitToCorrect(unit)} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap" disabled={!selectors.hasPermission('warehouse:correction:apply')}>
                                                                    <Check className="mr-2 h-4 w-4"/> Revisar y Aplicar
                                                                </Button>
                                                            ) : (
                                                                <Button variant="outline" size="sm" onClick={() => actions.setUnitToCorrect(unit)} className="whitespace-nowrap">
                                                                    <RotateCcw className="mr-2 h-4 w-4"/> Corregir
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => actions.handlePrintTicket(unit)} disabled={isSubmitting} title="Imprimir Boleta">
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter className="flex w-full items-center justify-end pt-4">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="rows-per-page">Filas por página:</Label>
                                    <Select value={String(state.rowsPerPage)} onValueChange={(value) => actions.setRowsPerPage(Number(value))}>
                                        <SelectTrigger id="rows-per-page" className="w-20"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[10, 25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <span className="text-sm text-muted-foreground">Página {state.currentPage + 1} de {selectors.totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage((p: number) => p - 1)} disabled={state.currentPage === 0}><ChevronLeft className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage((p: number) => p + 1)} disabled={state.currentPage >= selectors.totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                )}

                 <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                    <DialogContent className="sm:max-w-3xl" aria-describedby="correction-dialog-description">
                        <DialogHeader>
                            <DialogTitle>
                                {state.unitToCorrect?.status === 'pending' ? 'Revisar y Aplicar Ingreso' : 'Corregir Ingreso de Unidad'}
                            </DialogTitle>
                            <DialogDescription id="correction-dialog-description">
                                 {state.unitToCorrect?.status === 'pending' ? 
                                    `Revisa y completa los datos de la unidad ${state.unitToCorrect?.receptionConsecutive}. Al aplicar, el ingreso quedará finalizado.`
                                    : `Modifica los campos necesarios para la unidad ${state.unitToCorrect?.receptionConsecutive}. Se anulará la unidad original y se creará una nueva.`
                                 }
                            </DialogDescription>
                        </DialogHeader>
                        {state.unitToCorrect && (
                            <div className="py-4 space-y-6">
                                <div className="space-y-4 rounded-lg border p-4">
                                     <h4 className="font-semibold text-muted-foreground">Datos Originales</h4>
                                     <div className="text-sm grid grid-cols-2 gap-2">
                                        <p><strong>Producto:</strong> {selectors.getOriginalProductName()}</p>
                                        <p><strong>Cantidad:</strong> {state.unitToCorrect.quantity}</p>
                                        <p><strong>Lote/ID:</strong> {state.unitToCorrect.humanReadableId || 'N/A'}</p>
                                        <p><strong>Documento:</strong> {state.unitToCorrect.documentId || 'N/A'}</p>
                                     </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h4 className="font-semibold">Datos a Modificar</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-product">Producto</Label>
                                            <SearchInput
                                                options={selectors.productOptions}
                                                onSelect={actions.handleSelectNewProduct}
                                                value={newProductSearch}
                                                onValueChange={actions.setNewProductSearch}
                                                placeholder="Buscar por código o descripción..."
                                                open={isNewProductSearchOpen}
                                                onOpenChange={actions.setNewProductSearchOpen}
                                            />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="edit-quantity">Cantidad</Label>
                                            <Input id="edit-quantity" type="number" value={editableUnit.quantity || ''} onChange={e => actions.setEditableUnitField('quantity', Number(e.target.value))} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="edit-lote">Nº Lote / ID Físico</Label>
                                            <Input id="edit-lote" value={editableUnit.humanReadableId || ''} onChange={e => actions.setEditableUnitField('humanReadableId', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="edit-doc">Nº Documento</Label>
                                            <Input id="edit-doc" value={editableUnit.documentId || ''} onChange={e => actions.setEditableUnitField('documentId', e.target.value)} />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="edit-erp-doc">Nº Documento ERP</Label>
                                            <Input id="edit-erp-doc" value={editableUnit.erpDocumentId || ''} onChange={e => actions.setEditableUnitField('erpDocumentId', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {state.unitToCorrect?.status !== 'pending' && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>¡Acción Irreversible!</AlertTitle>
                                        <AlertDescription>
                                            Al continuar, la unidad original será anulada y se creará una nueva unidad con los datos ingresados arriba. Esta acción quedará registrada en el historial de movimientos.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                        <DialogFooter className="justify-between">
                            <div className='flex gap-2'>
                                <Button variant="ghost" onClick={actions.handleClearForm}>
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Limpiar Formulario
                                </Button>
                                <Button variant="outline" onClick={actions.resetEditableUnit}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Restaurar Original
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button disabled={!editableUnit.quantity || editableUnit.quantity < 0 || isSubmitting}>
                                            {state.unitToCorrect?.status === 'pending' ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                            {state.unitToCorrect?.status === 'pending' ? 'Aplicar Ingreso' : 'Aplicar Corrección'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar Cambios?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {state.unitToCorrect?.status === 'pending' ?
                                                    "Se guardarán los cambios y el ingreso quedará marcado como 'Aplicado'."
                                                    : "Se va a generar un movimiento de anulación para el ingreso original y se creará un nuevo ingreso con los datos corregidos."
                                                }
                                                ¿Estás seguro?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>No, cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={actions.handleConfirmCorrection} disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                Sí, Continuar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}
