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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Search, RotateCcw, Package, AlertTriangle, Calendar as CalendarIcon, FilterX } from 'lucide-react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCorrectionTool } from '@/modules/warehouse/hooks/useCorrectionTool';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

export default function CorrectionPage() {
    useAuthorization(['warehouse:correction:execute']);
    const { setTitle } = usePageTitle();
    const { state, actions, selectors } = useCorrectionTool();
    const {
        isSearching,
        isSubmitting,
        filters,
        searchResults,
        unitToCorrect,
        isConfirmModalOpen,
        newProductSearch,
        isNewProductSearchOpen,
        newSelectedProduct,
        editableUnit,
    } = state;

    useEffect(() => {
        setTitle("Corrección de Ingresos");
    }, [setTitle]);
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6"/>Buscar Ingresos para Corregir</CardTitle>
                        <CardDescription>Usa los filtros para encontrar la unidad de inventario que necesitas corregir.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <div className="space-y-2"><Label htmlFor="documentId">Nº Documento</Label><Input id="documentId" value={filters.documentId} onChange={e => actions.setFilter('documentId', e.target.value)} /></div>
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

                {searchResults.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultados de la Búsqueda</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID Unidad</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Lote/ID Físico</TableHead>
                                            <TableHead>Cant.</TableHead>
                                            <TableHead>Fecha Ingreso</TableHead>
                                            <TableHead className="text-right">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {searchResults.map(unit => (
                                            <TableRow key={unit.id}>
                                                <TableCell className="font-mono">{unit.unitCode}</TableCell>
                                                <TableCell>
                                                    <p className="font-medium">{selectors.getProductName(unit.productId)}</p>
                                                    <p className="text-sm text-muted-foreground">{unit.productId}</p>
                                                </TableCell>
                                                <TableCell>{unit.humanReadableId || 'N/A'}</TableCell>
                                                <TableCell className="font-bold">{unit.quantity}</TableCell>
                                                <TableCell>{format(parseISO(unit.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => actions.setUnitToCorrect(unit)}>
                                                        <RotateCcw className="mr-2 h-4 w-4"/>
                                                        Corregir
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                 <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Corregir Ingreso de Unidad</DialogTitle>
                            <DialogDescription>
                                Modifica los campos necesarios para la unidad <strong>{unitToCorrect?.unitCode}</strong>.
                                Al guardar, se anulará la unidad original y se creará una nueva con esta información.
                            </DialogDescription>
                        </DialogHeader>
                        {unitToCorrect && (
                            <div className="py-4 space-y-6">
                                <div className="space-y-4 rounded-lg border p-4">
                                     <h4 className="font-semibold text-muted-foreground">Datos Originales</h4>
                                     <div className="text-sm grid grid-cols-2 gap-2">
                                        <p><strong>Producto:</strong> {selectors.getOriginalProductName()}</p>
                                        <p><strong>Cantidad:</strong> {unitToCorrect.quantity}</p>
                                        <p><strong>Lote/ID:</strong> {unitToCorrect.humanReadableId || 'N/A'}</p>
                                        <p><strong>Documento:</strong> {unitToCorrect.documentId || 'N/A'}</p>
                                     </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h4 className="font-semibold">Datos a Corregir</h4>
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

                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>¡Acción Irreversible!</AlertTitle>
                                    <AlertDescription>
                                        Al continuar, la unidad original será anulada y se creará una nueva unidad con los datos ingresados arriba. Esta acción quedará registrada en el historial de movimientos.
                                    </AlertDescription>
                                </Alert>
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
                                        <Button disabled={!newSelectedProduct || isSubmitting}>
                                            <Save className="mr-2 h-4 w-4"/>
                                            Aplicar Corrección
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar Corrección?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Se va a generar un movimiento de anulación para el ingreso original y se creará un nuevo ingreso con los datos corregidos. ¿Estás seguro?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>No, cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={actions.handleConfirmCorrection} disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                Sí, Corregir
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
