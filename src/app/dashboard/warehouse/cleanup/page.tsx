/**
 * @fileoverview New page for the dedicated warehouse cleanup tools.
 */
'use client';

import React from 'react';
import { useCleanupTool } from '@/modules/warehouse/hooks/useCleanupTool';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Search, Trash2, Box, Layers, Building, Waypoints, Package, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

export default function CleanupToolPage() {
    const { state, actions, selectors } = useCleanupTool();
    const { isLoading, isSubmitting, mode, searchTerm, searchResults, selectedItemId, isConfirmOpen } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-3xl mx-auto" />
            </main>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-3xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Trash2 /> Herramientas de Limpieza de Almacén</CardTitle>
                        <CardDescription>Herramienta para corregir y eliminar asignaciones de productos de forma masiva.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label className="font-semibold text-lg">Paso 1: Elige el modo de limpieza</Label>
                             <RadioGroup value={mode} onValueChange={(value) => actions.setMode(value as any)} className="flex flex-wrap gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="product" id="mode-product" /><Label htmlFor="mode-product" className="font-normal">Por Producto</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="location" id="mode-location" /><Label htmlFor="mode-location">Por Ubicación</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="rack" id="mode-rack" /><Label htmlFor="mode-rack">Por Rack</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="level" id="mode-level" /><Label htmlFor="mode-level">Por Nivel</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="search-input" className="font-semibold text-lg">Paso 2: Busca el ítem a limpiar</Label>
                            <div className="flex items-center gap-2">
                                <SearchInput
                                    options={selectors.searchOptions}
                                    onSelect={actions.handleSelect}
                                    value={searchTerm}
                                    onValueChange={actions.setSearchTerm}
                                    open={state.isSearchOpen}
                                    onOpenChange={actions.setIsSearchOpen}
                                    placeholder={selectors.searchPlaceholder}
                                    triggerAction="icon"
                                />
                                <Button onClick={actions.handleSearch} disabled={!selectedItemId}>
                                    <Search className="mr-2 h-4 w-4" /> Buscar Asignaciones
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {searchResults.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 3: Revisa y Confirma la Limpieza</CardTitle>
                            <CardDescription>
                                Se encontraron {searchResults.length} asignacion(es) para <strong>{selectors.getCleanupTitle()}</strong>. Selecciona las que deseas eliminar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center space-x-2 mb-4 border-t pt-4">
                                <Checkbox
                                    id="select-all-results"
                                    checked={selectors.areAllSelected}
                                    onCheckedChange={(checked) => actions.handleSelectAll(!!checked)}
                                />
                                <Label htmlFor="select-all-results">Seleccionar todo</Label>
                            </div>
                            <ScrollArea className="h-64 border rounded-md p-2">
                                <div className="space-y-2">
                                    {searchResults.map(result => (
                                        <div key={result.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                            <Checkbox
                                                id={`check-${result.id}`}
                                                checked={state.selectedAssignmentIds.has(result.id)}
                                                onCheckedChange={() => actions.handleToggleSelection(result.id)}
                                            />
                                            <Label htmlFor={`check-${result.id}`} className="flex flex-col flex-1 cursor-pointer">
                                                <span className="font-medium">{result.productName} ({result.itemId})</span>
                                                <span className="text-xs text-muted-foreground">{result.locationPath}</span>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter>
                            <AlertDialog open={isConfirmOpen} onOpenChange={actions.setIsConfirmOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={state.selectedAssignmentIds.size === 0 || isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Trash2 className="mr-2"/>}
                                        Limpiar {state.selectedAssignmentIds.size} Asignacion(es)
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle/>¿Confirmar Limpieza?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Estás a punto de eliminar permanentemente {state.selectedAssignmentIds.size} asignacion(es). El estado de las ubicaciones afectadas se recalculará. Esta acción no se puede deshacer.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={actions.handleConfirmCleanup}>Sí, limpiar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                )}
            </div>
        </main>
    );
}
