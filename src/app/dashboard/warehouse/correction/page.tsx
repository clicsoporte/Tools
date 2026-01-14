/**
 * @fileoverview Page for correcting warehouse receiving errors with advanced search.
 */
'use client';

// This forces the page to be dynamically rendered, avoiding client-side caching issues.
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { correctInventoryUnit, searchInventoryUnits } from '@/modules/warehouse/lib/actions';
import type { InventoryUnit, Product, DateRange } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, Save, Search, RotateCcw, Package, AlertTriangle, Calendar as CalendarIcon, FilterX } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { useCorrectionTool } from '@/modules/warehouse/hooks/useCorrectionTool';

export default function CorrectionPage() {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    const { setTitle } = usePageTitle();
    
    const { state, actions, selectors } = useCorrectionTool();

    const { 
        isLoading, isSearching, isSubmitting, searchTerm, searchResult,
        unitToCorrect, isConfirmModalOpen, newProductSearch, isNewProductSearchOpen,
        newSelectedProduct, confirmStep, confirmText
    } = state;

    useEffect(() => {
        setTitle("Administración de Ingresos");
    }, [setTitle]);

    if (isLoading) {
        return <main className="flex-1 p-4 md:p-6 lg:p-8"><Skeleton className="h-96 w-full max-w-4xl mx-auto" /></main>;
    }
    
    if (isAuthorized === false) return null;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6"/>Buscar Ingreso para Corregir</CardTitle>
                        <CardDescription>Busca una unidad de inventario por su ID único (ej: U-00001) o por su ID físico (Lote).</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex w-full max-w-sm items-center space-x-2">
                            <Input
                                id="unit-search"
                                placeholder="Ingresa el ID de la unidad..."
                                value={searchTerm}
                                onChange={(e) => actions.setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && actions.handleSearch()}
                                className="h-11 text-base"
                            />
                            <Button type="button" onClick={actions.handleSearch} disabled={isSearching} className="h-11">
                                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                                Buscar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {searchResult && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Unidad Encontrada</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div className="font-mono bg-muted p-2 rounded-md"><strong>ID Unidad:</strong> {searchResult.unit.unitCode}</div>
                                <div><strong>Producto:</strong> {searchResult.product.description} ({searchResult.product.id})</div>
                                <div><strong>Cantidad:</strong> {searchResult.unit.quantity}</div>
                                <div><strong>Ubicación:</strong> {selectors.getOriginalLocationPath()}</div>
                                <div><strong>ID Físico:</strong> {searchResult.unit.humanReadableId || 'N/A'}</div>
                                <div><strong>Documento:</strong> {searchResult.unit.documentId || 'N/A'}</div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={() => actions.setUnitToCorrect(searchResult.unit)}>
                                <RotateCcw className="mr-2 h-4 w-4"/>
                                Corregir Producto de esta Unidad
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Corregir Producto de Ingreso</DialogTitle>
                            <DialogDescription>
                                Se anulará el ingreso de <strong>{selectors.getOriginalProductName()}</strong> y se creará uno nuevo con el producto correcto.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="new-product" className="font-semibold">Seleccionar Producto Correcto</Label>
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
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Confirmación de Seguridad Requerida</AlertTitle>
                                <AlertDescription>
                                    <p className="mb-2">Esta es una acción irreversible que afecta el inventario. Para continuar, por favor, sigue estos pasos:</p>
                                    <div className="flex items-center space-x-2 my-2">
                                        <Checkbox id="confirm-step1" checked={confirmStep > 0} onCheckedChange={(checked) => actions.setConfirmStep(checked ? 1 : 0)} />
                                        <Label htmlFor="confirm-step1" className="font-normal">Entiendo que esto anulará la unidad original.</Label>
                                    </div>
                                    {confirmStep > 0 && (
                                        <div className="space-y-2 mt-2">
                                            <Label htmlFor="confirm-text">Escribe &quot;CORREGIR&quot; para confirmar:</Label>
                                            <Input
                                                id="confirm-text"
                                                value={confirmText}
                                                onChange={(e) => {
                                                    actions.setConfirmText(e.target.value.toUpperCase());
                                                    if (e.target.value.toUpperCase() === 'CORREGIR') actions.setConfirmStep(2);
                                                }}
                                                className="border-destructive focus-visible:ring-destructive"
                                            />
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={actions.handleConfirmCorrection} disabled={isSubmitting || !newSelectedProduct || confirmStep < 2 || confirmText !== 'CORREGIR'}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                <Save className="mr-2 h-4 w-4"/>
                                Aplicar Corrección
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}
