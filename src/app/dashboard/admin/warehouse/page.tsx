/**
 * @fileoverview Page for managing warehouse structure and settings.
 * This component allows administrators to define the hierarchical levels of a warehouse
 * (e.g., Building, Aisle, Rack) and then create the actual physical locations
 * based on that hierarchy. It also controls global warehouse settings.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { getWarehouseSettings, saveWarehouseSettings, getLocations, addLocation, deleteLocation, updateLocation } from '@/modules/warehouse/lib/actions';
import { PlusCircle, Trash2, Edit2, Save, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WarehouseSettings, WarehouseLocation } from '@/modules/core/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const emptyLocation: Omit<WarehouseLocation, 'id'> = { name: '', code: '', type: 'building', parentId: null };

function LocationTree({ locations, onEdit, onDelete }: { locations: WarehouseLocation[], onEdit: (loc: WarehouseLocation) => void, onDelete: (loc: WarehouseLocation) => void }) {
    const [openNodes, setOpenNodes] = useState<Set<number>>(() => {
        // Automatically open the first two levels by default
        const rootIds = locations.filter(l => !l.parentId).map(l => l.id);
        const secondLevelIds = locations.filter(l => l.parentId && rootIds.includes(l.parentId)).map(l => l.id);
        return new Set([...rootIds, ...secondLevelIds]);
    });

    const toggleNode = (id: number) => {
        setOpenNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const renderNode = (location: WarehouseLocation, level = 0) => {
        const children = locations.filter(l => l.parentId === location.id);
        const hasChildren = children.length > 0;
        const isOpen = openNodes.has(location.id);

        return (
            <div key={location.id} className="relative">
                 {level > 0 && <span className="absolute -left-2 top-1/2 w-4 h-px bg-muted-foreground/30"></span>}
                <div className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50`}>
                    <div className="flex items-center gap-2">
                        <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center gap-2">
                            {hasChildren ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => toggleNode(location.id)}>
                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                            ) : (
                                <span className="w-6 shrink-0"></span> // Placeholder to align items
                            )}
                            <span className="font-medium">{location.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">({location.code})</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(location)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(location)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
                {isOpen && hasChildren && (
                    <div className="relative pl-6 border-l-2 border-muted-foreground/10 ml-5">{children.map(child => renderNode(child, level + 1))}</div>
                )}
            </div>
        );
    };

    const rootLocations = locations.filter(l => !l.parentId);
    return (
        <div className="space-y-1">
            {rootLocations.map(loc => renderNode(loc))}
        </div>
    );
}

export default function WarehouseSettingsPage() {
    useAuthorization(['admin:settings:warehouse']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    
    const [settings, setSettings] = useState<WarehouseSettings | null>(null);
    const [locations, setLocations] = useState<WarehouseLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [newLevelName, setNewLevelName] = useState('');
    
    const [isLocationFormOpen, setLocationFormOpen] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<Partial<WarehouseLocation>>(emptyLocation);
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [locationToDelete, setLocationToDelete] = useState<WarehouseLocation | null>(null);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [settingsData, locationsData] = await Promise.all([
                getWarehouseSettings(),
                getLocations(),
            ]);
            setSettings(settingsData);
            setLocations(locationsData);
        } catch (error) {
            logError('Failed to fetch warehouse config data', { error });
            toast({ title: "Error", description: "No se pudieron cargar los datos de configuración del almacén.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        setTitle("Configuración de Almacenes");
        fetchAllData();
    }, [setTitle, fetchAllData]);

    const handleAddLevel = () => {
        if (!settings || !newLevelName.trim()) return;
        const newLevels = [...(settings.locationLevels || []), { type: `level${(settings.locationLevels?.length || 0) + 1}`, name: newLevelName.trim() }];
        setSettings({ ...settings, locationLevels: newLevels });
        setNewLevelName('');
    };
    
    const handleDeleteLevel = useCallback((index: number) => {
        if (!settings) return;
        const newLevels = settings.locationLevels?.filter((_, i) => i !== index);
        setSettings({ ...settings, locationLevels: newLevels });
    }, [settings]);

    const handleSaveSettings = async () => {
        if (!settings) return;
        try {
            await saveWarehouseSettings(settings);
            toast({ title: "Configuración Guardada", description: "Los ajustes de almacén han sido guardados." });
            logInfo("Warehouse settings updated", { settings });
        } catch (error: any) {
            logError("Failed to save warehouse settings", { error: error.message });
            toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive" });
        }
    };

    const handleSaveLocation = async () => {
        if (!currentLocation.name || !currentLocation.code || !currentLocation.type) {
            toast({ title: "Datos incompletos", variant: "destructive" });
            return;
        }

        try {
            if (isEditingLocation && currentLocation.id) {
                await updateLocation(currentLocation as WarehouseLocation);
                setLocations(prev => prev.map(l => l.id === currentLocation.id ? (currentLocation as WarehouseLocation) : l));
                toast({ title: "Ubicación Actualizada" });
            } else {
                const newLoc = await addLocation(currentLocation as Omit<WarehouseLocation, 'id'>);
                setLocations(prev => [...prev, newLoc]);
                toast({ title: "Ubicación Creada" });
            }
            setLocationFormOpen(false);
        } catch (error: any) {
            logError("Failed to save location", { error: error.message });
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };
    
    const handleDeleteLocationAction = useCallback(async () => {
        if (!locationToDelete) return;
        try {
            await deleteLocation(locationToDelete.id);
            setLocations(prev => prev.filter(l => l.id !== locationToDelete.id));
            toast({ title: "Ubicación Eliminada" });
            setLocationToDelete(null);
        } catch (error: any) {
             logError("Failed to delete location", { error: error.message });
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    }, [locationToDelete, toast]);
    
    const openLocationForm = (loc?: WarehouseLocation) => {
        if (loc) {
            setCurrentLocation(loc);
            setIsEditingLocation(true);
        } else {
            setCurrentLocation(emptyLocation);
            setIsEditingLocation(false);
        }
        setLocationFormOpen(true);
    }
    
    const parentLocationOptions = locations
        .filter(l => l.id !== currentLocation?.id) // Prevent self-parenting
        .map(l => ({ value: String(l.id), label: `${l.name} (${l.code})` }));

    if (isLoading || !settings) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Configuración General de Almacén</CardTitle>
                        <CardDescription>Ajustes globales para el módulo de almacenes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                             <Switch
                                id="enable-physical-inventory"
                                checked={settings.enablePhysicalInventoryTracking}
                                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, enablePhysicalInventoryTracking: checked } : null)}
                            />
                            <Label htmlFor="enable-physical-inventory" className="text-base">Habilitar Control de Inventario Físico</Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                           Si está desactivado, el sistema solo permitirá asignar ubicaciones a un artículo (modo informativo). 
                           Si está activado, se habilitará el control de cantidades por ubicación y movimientos de inventario.
                        </p>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSaveSettings}><Save className="mr-2"/> Guardar Configuración</Button>
                    </CardFooter>
                </Card>

                 <Accordion type="multiple" className="w-full" defaultValue={['item-1', 'item-2']}>
                    <AccordionItem value="item-1">
                        <AccordionTrigger>
                            <CardTitle>Paso 1: Definir Jerarquía del Almacén (El Molde)</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none">
                                <CardHeader className="pt-0">
                                    <CardDescription>
                                        Aquí defines los **nombres** para cada nivel de tu organización. Esto es como crear una plantilla. Por ejemplo: Bodega, Pasillo, Rack, Estante, Casilla.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {settings.locationLevels?.map((level, index) => (
                                        <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                                            <p className="font-medium">Nivel {index + 1}: {level.name}</p>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteLevel(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Separator />
                                    <div className="flex items-end gap-2 pt-2">
                                        <div className="grid flex-1 gap-2">
                                            <Label htmlFor="new-level-name">Nombre del Nuevo Nivel</Label>
                                            <Input id="new-level-name" value={newLevelName} onChange={(e) => setNewLevelName(e.target.value)} placeholder="Ej: Tarima" />
                                        </div>
                                        <Button size="icon" onClick={handleAddLevel}>
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleSaveSettings}><Save className="mr-2"/> Guardar Niveles</Button>
                                </CardFooter>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>
                           <CardTitle>Paso 2: Crear Ubicaciones Reales (El Árbol)</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none">
                                <CardHeader className="pt-0">
                                     <div className="flex items-center justify-between">
                                        <CardDescription>
                                            Usa los niveles que definiste en el Paso 1 para construir la estructura real de tu almacén. Por ejemplo, crea una `Bodega` llamada "Bodega Principal", luego un `Pasillo` dentro de ella.
                                        </CardDescription>
                                         <Button onClick={() => openLocationForm()}>
                                            <PlusCircle className="mr-2"/> Añadir Ubicación
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <LocationTree locations={locations} onEdit={openLocationForm} onDelete={setLocationToDelete} />
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                 <Dialog open={isLocationFormOpen} onOpenChange={setLocationFormOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{isEditingLocation ? "Editar" : "Añadir"} Ubicación</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="loc-name">Nombre</Label>
                                    <Input id="loc-name" value={currentLocation.name || ''} onChange={e => setCurrentLocation(p => ({...p, name: e.target.value}))} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="loc-code">Código Único</Label>
                                    <Input id="loc-code" value={currentLocation.code || ''} onChange={e => setCurrentLocation(p => ({...p, code: e.target.value}))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loc-type">Tipo de Ubicación (Nivel)</Label>
                                <Select value={currentLocation.type || ''} onValueChange={(val) => setCurrentLocation(p => ({...p, type: val as string}))}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {settings.locationLevels?.map((level, index) => (
                                            <SelectItem key={level.type} value={level.type}>Nivel {index+1}: {level.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loc-parent">Ubicación Padre (Opcional)</Label>
                                <Select value={String(currentLocation.parentId || 'none')} onValueChange={(val) => setCurrentLocation(p => ({...p, parentId: val === 'none' ? null : Number(val)}))}>
                                    <SelectTrigger><SelectValue placeholder="Sin padre (Nivel Raíz)"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sin padre (Nivel Raíz)</SelectItem>
                                        {parentLocationOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setLocationFormOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveLocation}><Save className="mr-2"/> Guardar</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
                  <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar "{locationToDelete?.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará la ubicación y TODAS las ubicaciones hijas que contenga. 
                                El inventario asociado no se eliminará, pero quedará sin ubicación.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setLocationToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteLocationAction}>Sí, Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
            </div>
        </main>
    );
}
