'use client';

import React from 'react';
import { useWarehouseExplorer } from '@/modules/warehouse/hooks/useWarehouseExplorer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Loader2, Trash2, Box, Layers, Archive, Package, Building, Waypoints } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
  
// Helper to render an icon for a location type
const LocationIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'building': return <Building className="h-4 w-4 text-muted-foreground" />;
        case 'zone': return <Waypoints className="h-4 w-4 text-muted-foreground" />;
        case 'rack': return <Box className="h-4 w-4 text-muted-foreground" />;
        case 'shelf': return <Layers className="h-4 w-4 text-muted-foreground" />;
        case 'bin': return <Archive className="h-4 w-4 text-muted-foreground" />;
        default: return <Box className="h-4 w-4 text-muted-foreground" />;
    }
};


export default function WarehouseExplorerPage() {
    const { state, actions, selectors } = useWarehouseExplorer();

    if (state.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="grid grid-cols-3 gap-4 h-[80vh]">
                    <Skeleton className="col-span-1 h-full" />
                    <Skeleton className="col-span-2 h-full" />
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar ubicación por nombre o código..."
                            value={state.searchTerm}
                            onChange={(e) => actions.setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
                {/* Column 1: Racks */}
                <ScrollArea className="border-r">
                    <div className="p-2">
                        <h3 className="font-semibold px-2 py-1">Racks</h3>
                        {selectors.racks.map(rack => (
                            <button
                                key={rack.id}
                                onClick={() => actions.selectRack(rack.id)}
                                className={cn(
                                    "w-full text-left p-2 rounded-md flex items-center gap-2",
                                    state.selectedRackId === rack.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                                    selectors.isHighlighted(rack.id) && "ring-2 ring-blue-500"
                                )}
                            >
                                <LocationIcon type={rack.type} />
                                <span className="flex-1 truncate">{rack.name}</span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>

                {/* Column 2: Levels */}
                <ScrollArea className="border-r bg-muted/20">
                     <div className="p-2">
                        <h3 className="font-semibold px-2 py-1">Niveles</h3>
                        {selectors.levels.map(level => (
                            <button
                                key={level.id}
                                onClick={() => actions.selectLevel(level.id)}
                                className={cn(
                                    "w-full text-left p-2 rounded-md flex items-center gap-2",
                                    state.selectedLevelId === level.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                                    selectors.isHighlighted(level.id) && "ring-2 ring-blue-500"
                                )}
                            >
                                <LocationIcon type={level.type} />
                                <span className="flex-1 truncate">{level.name}</span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>

                {/* Column 3: Details Panel */}
                <ScrollArea className="col-span-1 md:col-span-1 bg-muted/40">
                    <div className="p-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>{selectors.details.title}</CardTitle>
                                <CardDescription>{selectors.details.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {state.selectedRackId === null ? (
                                    <p className="text-muted-foreground text-center py-8">Selecciona un rack para ver sus detalles.</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <h4 className="font-semibold">Ocupación</h4>
                                            {selectors.details.items.length > 0 ? (
                                                selectors.details.items.map((item, index) => (
                                                    <div key={index} className="p-2 border rounded-md bg-background">
                                                        <p className="font-medium flex items-center gap-2">
                                                            <Package className="h-4 w-4 text-muted-foreground"/> 
                                                            {item.productName}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground ml-6">Ubicación: {item.locationPath}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground">No hay productos asignados en la selección actual.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold">Ubicaciones Libres ({selectors.details.emptyLocations.length})</h4>
                                            {selectors.details.emptyLocations.length > 0 ? (
                                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                                    {selectors.details.emptyLocations.map(loc => (
                                                        <div key={loc.id} className="p-1 text-sm text-muted-foreground">{loc.path}</div>
                                                    ))}
                                                </div>
                                            ) : (
                                                 <p className="text-sm text-muted-foreground">No hay ubicaciones libres en la selección actual.</p>
                                            )}
                                        </div>
                                         <div className="border-t pt-4">
                                            <h4 className="font-semibold mb-2">Acciones</h4>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" disabled={!state.selectedRackId || state.isSubmitting}>
                                                        {state.isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Trash2 className="mr-2"/>}
                                                        Limpiar Selección
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Confirmar Limpieza?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Se eliminarán todas las asignaciones de productos en: <strong>{selectors.details.title}</strong>. Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={actions.handleCleanup}>Sí, limpiar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                         </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
            </div>
        </main>
    );
}
