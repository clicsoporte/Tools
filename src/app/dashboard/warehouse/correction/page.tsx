/**
 * @fileoverview Page for the Inventory Correction tool.
 * Allows supervisors to correct receiving errors by changing the product associated with an inventory unit.
 */
'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, RotateCcw, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCorrectionTool } from '@/modules/warehouse/hooks/useCorrectionTool';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CorrectionPage() {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    const { setTitle } = usePageTitle();

    useEffect(() => {
        setTitle("Administración de Ingresos");
    }, [setTitle]);

    const { state, actions, selectors } = useCorrectionTool();
    const {
        isLoading,
        isSearching,
        isSubmitting,
        searchTerm,
        searchResult,
        unitToCorrect,
        isConfirmModalOpen,
        newProductSearch,
        isNewProductSearchOpen,
        newSelectedProduct,
        confirmStep,
        confirmText,
    } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        )
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500 text-white">
                                <RotateCcw className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>Administración de Ingresos</CardTitle>
                                <CardDescription>Busca una unidad de inventario por su ID único para corregir el producto asociado.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ingresa el ID de la unidad (ej: U00030) o Lote/ID Físico"
                                    value={searchTerm}
                                    onChange={(e) => actions.setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && actions.handleSearch()}
                                    className="pl-9 h-11 text-base"
                                />
                            </div>
                            <Button onClick={actions.handleSearch} disabled={isSearching || !searchTerm}>
                                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                                Buscar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {searchResult && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado de la Búsqueda</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>ID de Unidad</Label>
                                    <p className="font-mono text-lg font-semibold">{searchResult.unit.unitCode}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Producto Actual</Label>
                                    <p>{searchResult.product.description} <span className="text-muted-foreground">({searchResult.product.id})</span></p>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Ubicación</Label>
                                    <p className="text-sm">{selectors.getOriginalLocationPath()}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Cantidad</Label>
                                    <p>{searchResult.unit.quantity}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Lote / ID Físico</Label>
                                    <p>{searchResult.unit.humanReadableId || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Fecha de Creación</Label>
                                    <p>{format(parseISO(searchResult.unit.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })} por {searchResult.unit.createdBy}</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={() => actions.setUnitToCorrect(searchResult.unit)}>
                                <RotateCcw className="mr-2 h-4 w-4"/>
                                Iniciar Corrección
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {isSearching && <div className="text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto"/></div>}
            </div>

            <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive"/>
                            Confirmar Corrección de Ingreso
                        </DialogTitle>
                        <DialogDescription>
                            Estás a punto de realizar un cambio irreversible en el inventario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                            <h4 className="font-semibold">Unidad Original</h4>
                             <p className="text-sm"><strong>ID:</strong> {unitToCorrect?.unitCode}</p>
                            <p className="text-sm"><strong>Producto:</strong> {selectors.getOriginalProductName()}</p>
                            <p className="text-sm"><strong>Ubicación:</strong> {selectors.getOriginalLocationPath()}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-product-search" className="font-semibold">Producto Correcto</Label>
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
                         {newSelectedProduct && (
                            <>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="confirm-step-1" onCheckedChange={(checked) => actions.setConfirmStep(checked ? 1 : 0)} />
                                    <Label htmlFor="confirm-step-1" className="font-medium text-destructive">
                                        Entiendo que esta acción es irreversible y generará nuevos movimientos de inventario.
                                    </Label>
                                </div>
                                {confirmStep >= 1 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-text">Para confirmar, escribe &quot;CORREGIR&quot;:</Label>
                                        <Input
                                            id="confirm-text"
                                            value={confirmText}
                                            onChange={(e) => {
                                                actions.setConfirmText(e.target.value.toUpperCase());
                                                if (e.target.value.toUpperCase() === 'CORREGIR') {
                                                    actions.setConfirmStep(2);
                                                } else {
                                                    actions.setConfirmStep(1);
                                                }
                                            }}
                                            className="border-destructive focus-visible:ring-destructive"
                                        />
                                    </div>
                                )}
                            </>
                         )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button
                            variant="destructive"
                            onClick={actions.handleConfirmCorrection}
                            disabled={isSubmitting || confirmStep !== 2}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <CheckCircle className="mr-2"/>}
                            Ejecutar Corrección
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}
