/**
 * @fileoverview New dedicated page for warehouse cleanup tools.
 * Allows users to clear item assignments by rack, level, specific location, or product.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCleanupTool } from '@/modules/warehouse/hooks/useCleanupTool';
import { Loader2, Trash2 } from 'lucide-react';

export default function CleanupToolPage() {
    const { state, actions, selectors, isAuthorized } = useCleanupTool();
    const { 
        isLoading, isSubmitting, cleanupType, searchTerm, 
        isSearchOpen, selectedItem 
    } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
            </main>
        );
    }
    
    if (!isAuthorized) return null;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Herramientas de Limpieza de Asignaciones</CardTitle>
                        <CardDescription>
                            Elimina asignaciones de productos de las ubicaciones en lote. Esta acción es irreversible y solo debe usarse para mantenimiento.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label className="font-semibold text-base">1. Selecciona el tipo de limpieza</Label>
                            <RadioGroup value={cleanupType} onValueChange={actions.handleCleanupTypeChange} className="grid grid-cols-2 gap-4">
                                <div>
                                    <RadioGroupItem value="rack" id="r-rack" className="peer sr-only" />
                                    <Label htmlFor="r-rack" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        Limpiar por Rack
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="level" id="r-level" className="peer sr-only" />
                                    <Label htmlFor="r-level" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        Limpiar por Nivel
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="location" id="r-location" className="peer sr-only" />
                                    <Label htmlFor="r-location" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        Limpiar por Ubicación
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="product" id="r-product" className="peer sr-only" />
                                    <Label htmlFor="r-product" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        Limpiar por Producto
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                        {cleanupType && (
                            <div className="space-y-2">
                                <Label htmlFor="search-item" className="font-semibold text-base">2. Selecciona el ítem a limpiar</Label>
                                <SearchInput
                                    options={selectors.searchOptions}
                                    onSelect={(value) => actions.handleItemSelect(value)}
                                    value={searchTerm}
                                    onValueChange={actions.setSearchTerm}
                                    open={isSearchOpen}
                                    onOpenChange={actions.setIsSearchOpen}
                                    placeholder={`Buscar ${selectors.getCleanupTitle().toLowerCase()}...`}
                                />
                            </div>
                        )}
                    </CardContent>
                    {selectedItem && (
                        <CardFooter>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Limpiar Asignaciones para &quot;{selectedItem.label}&quot;
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Se eliminarán TODAS las asignaciones de productos para <strong>{selectedItem.label}</strong>. Esta acción no se puede deshacer y puede afectar múltiples registros.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={actions.handleConfirmCleanup}>Sí, limpiar todo</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </main>
    );
}
