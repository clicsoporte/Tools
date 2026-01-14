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

// Represents the state of the form within the correction modal
type CorrectionFormState = {
    productId: string;
    quantity: number;
    humanReadableId: string;
    documentId: string;
    erpDocumentId: string;
};

export default function CorrectionPage() {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, products: authProducts } = useAuth();
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [filters, setFilters] = useState({
        dateRange: { from: subDays(new Date(), 7), to: new Date() } as DateRange | undefined,
        productId: '',
        humanReadableId: '',
        unitCode: '',
        documentId: ''
    });

    const [searchResults, setSearchResults] = useState<InventoryUnit[]>([]);
    const [unitToCorrect, setUnitToCorrect] = useState<InventoryUnit | null>(null);
    const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
    
    const [correctionForm, setCorrectionForm] = useState<CorrectionFormState>({
        productId: '', quantity: 1, humanReadableId: '', documentId: '', erpDocumentId: ''
    });
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    
    const [debouncedProductSearch] = useDebounce(productSearchTerm, 300);

    const originalProduct = useMemo(() => 
        unitToCorrect ? authProducts.find(p => p.id === unitToCorrect.productId) : null, 
    [unitToCorrect, authProducts]);
    
    const correctedProduct = useMemo(() =>
        authProducts.find(p => p.id === correctionForm.productId),
    [authProducts, correctionForm.productId]);

    useEffect(() => {
        setTitle("Corrección de Ingresos");
    }, [setTitle]);

    const handleSearch = async () => {
        setIsLoading(true);
        setSearchResults([]);
        try {
            const results = await searchInventoryUnits(filters);
            setSearchResults(results);
            if (results.length === 0) {
                toast({ title: 'Sin Resultados', description: 'No se encontraron ingresos con los filtros especificados.' });
            }
        } catch (error: any) {
            logError('Failed to search inventory units', { error: error.message });
            toast({ title: 'Error', description: 'No se pudieron buscar los ingresos.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFilterChange = (field: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            dateRange: { from: subDays(new Date(), 7), to: new Date() },
            productId: '',
            humanReadableId: '',
            unitCode: '',
            documentId: ''
        });
        setSearchResults([]);
    };
    
    const openCorrectionModal = (unit: InventoryUnit) => {
        setUnitToCorrect(unit);
        // Pre-fill the form with original data
        const product = authProducts.find(p => p.id === unit.productId);
        setCorrectionForm({
            productId: unit.productId,
            quantity: unit.quantity,
            humanReadableId: unit.humanReadableId || '',
            documentId: unit.documentId || '',
            erpDocumentId: unit.erpDocumentId || '',
        });
        setProductSearchTerm(product ? `[${product.id}] ${product.description}` : unit.productId);
        setIsCorrectionModalOpen(true);
    };

    const handleFormChange = (field: keyof CorrectionFormState, value: any) => {
        setCorrectionForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSelectNewProduct = (productId: string) => {
        const product = authProducts.find(p => p.id === productId);
        if (product) {
            handleFormChange('productId', productId);
            setProductSearchTerm(`[${product.id}] ${product.description}`);
        }
        setIsProductSearchOpen(false);
    };

    const handleCorrection = async () => {
        if (!unitToCorrect || !correctionForm.productId || !user) {
            toast({ title: 'Datos Incompletos', description: 'Se requiere una unidad y un producto para la corrección.', variant: 'destructive'});
            return;
        }

        setIsSubmitting(true);
        try {
            await correctInventoryUnit({
                unitId: unitToCorrect.id,
                newProductId: correctionForm.productId,
                newQuantity: correctionForm.quantity,
                newHumanReadableId: correctionForm.humanReadableId,
                newDocumentId: correctionForm.documentId,
                newErpDocumentId: correctionForm.erpDocumentId,
                userId: user.id,
                userName: user.name
            });
            toast({ title: 'Corrección Exitosa', description: `La unidad ${unitToCorrect.unitCode} ha sido anulada y una nueva unidad ha sido creada con los datos corregidos.` });
            logInfo('Inventory unit corrected', { oldUnit: unitToCorrect.unitCode, correctedData: correctionForm, user: user.name });
            setIsCorrectionModalOpen(false);
            setUnitToCorrect(null);
            await handleSearch(); // Refresh search results
        } catch (error: any) {
            logError('Failed to correct inventory unit', { error: error.message });
            toast({ title: 'Error al Corregir', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const productOptions = useMemo(() => {
        if (debouncedProductSearch.length < 2) return [];
        return authProducts
            .filter(p => p.id.toLowerCase().includes(debouncedProductSearch.toLowerCase()) || p.description.toLowerCase().includes(debouncedProductSearch.toLowerCase()))
            .map(p => ({ value: p.id, label: `[${p.id}] ${p.description}` }));
    }, [authProducts, debouncedProductSearch]);


    if (isAuthorized === false) return null;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6"/>Buscar Ingresos para Corregir</CardTitle>
                        <CardDescription>Usa los filtros para encontrar la unidad de inventario que necesitas corregir.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label>Rango de Fechas</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal', !filters.dateRange && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.dateRange?.from ? (filters.dateRange.to ? (`${format(filters.dateRange.from, 'LLL dd, y', { locale: es })} - ${format(filters.dateRange.to, 'LLL dd, y', { locale: es })}`) : format(filters.dateRange.from, 'LLL dd, y', { locale: es })) : (<span>Rango de Fechas</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={filters.dateRange?.from} selected={filters.dateRange} onSelect={(range) => handleFilterChange('dateRange', range)} numberOfMonths={2} locale={es} /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2"><Label htmlFor="productId">Código Producto</Label><Input id="productId" value={filters.productId} onChange={e => handleFilterChange('productId', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="humanReadableId">Nº Lote / ID Físico</Label><Input id="humanReadableId" value={filters.humanReadableId} onChange={e => handleFilterChange('humanReadableId', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="unitCode">ID Unidad (U-XXXXX)</Label><Input id="unitCode" value={filters.unitCode} onChange={e => handleFilterChange('unitCode', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="documentId">Nº Documento</Label><Input id="documentId" value={filters.documentId} onChange={e => handleFilterChange('documentId', e.target.value)} /></div>
                        </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                        <Button onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                            Buscar Ingresos
                        </Button>
                        <Button variant="ghost" onClick={handleClearFilters}>
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
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Cant.</TableHead>
                                            <TableHead>Fecha Ingreso</TableHead>
                                            <TableHead className="text-right">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {searchResults.map(unit => {
                                            const product = authProducts.find(p => p.id === unit.productId);
                                            return (
                                                <TableRow key={unit.id}>
                                                    <TableCell className="font-mono">{unit.unitCode}</TableCell>
                                                    <TableCell>
                                                        <p className="font-medium">{product?.description || 'Desconocido'}</p>
                                                        <p className="text-sm text-muted-foreground">{unit.productId}</p>
                                                    </TableCell>
                                                    <TableCell>{unit.documentId || 'N/A'}</TableCell>
                                                    <TableCell className="font-bold">{unit.quantity}</TableCell>
                                                    <TableCell>{format(parseISO(unit.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => openCorrectionModal(unit)}>
                                                            <RotateCcw className="mr-2 h-4 w-4"/>
                                                            Corregir
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                 <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Corregir Ingreso</DialogTitle>
                            <DialogDescription>
                                Modifica los campos incorrectos de la unidad <strong>{unitToCorrect?.unitCode}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        {unitToCorrect && (
                             <div className="py-4 space-y-6">
                                <div className="space-y-4 rounded-lg border p-4">
                                     <h3 className="font-semibold text-lg">Datos a Corregir</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="new-product">Producto</Label>
                                            <SearchInput
                                                id="new-product"
                                                options={productOptions}
                                                onSelect={handleSelectNewProduct}
                                                value={productSearchTerm}
                                                onValueChange={setProductSearchTerm}
                                                placeholder="Buscar por código o descripción..."
                                                open={isProductSearchOpen}
                                                onOpenChange={setIsProductSearchOpen}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-quantity">Cantidad</Label>
                                            <Input id="new-quantity" type="number" value={correctionForm.quantity} onChange={e => handleFormChange('quantity', Number(e.target.value))}/>
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-humanReadableId">Nº Lote / ID Físico</Label>
                                            <Input id="new-humanReadableId" value={correctionForm.humanReadableId} onChange={e => handleFormChange('humanReadableId', e.target.value)}/>
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="new-documentId">Nº Documento</Label>
                                            <Input id="new-documentId" value={correctionForm.documentId} onChange={e => handleFormChange('documentId', e.target.value)}/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-erpDocumentId">Nº Documento ERP</Label>
                                            <Input id="new-erpDocumentId" value={correctionForm.erpDocumentId} onChange={e => handleFormChange('erpDocumentId', e.target.value)}/>
                                        </div>
                                    </div>
                                </div>
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>¡Acción Irreversible!</AlertTitle>
                                    <AlertDescription>
                                        Al continuar, la unidad original será anulada y se creará una nueva con los datos corregidos. Esta acción quedará registrada en el historial de movimientos.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={!correctionForm.productId || isSubmitting}>
                                        <Save className="mr-2 h-4 w-4"/>
                                        Aplicar Corrección
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Confirmar Corrección?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Vas a anular el ingreso de <strong>{unitToCorrect?.quantity}x {originalProduct?.description}</strong> y registrar un nuevo ingreso para <strong>{correctionForm.quantity}x {correctedProduct?.description}</strong>. ¿Estás seguro?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>No, cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleCorrection} disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Sí, Corregir
                                        </AlertDialogAction>
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
