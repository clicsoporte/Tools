

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import type { RequestSettings } from "@/modules/core/types";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { getRequestSettings, saveRequestSettings } from "@/modules/requests/lib/actions";
import { PlusCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function RequestSettingsPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:requests']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const [settings, setSettings] = useState<RequestSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newRoute, setNewRoute] = useState("");
    const [newShippingMethod, setNewShippingMethod] = useState("");

    useEffect(() => {
        setTitle("Configuración de Compras");
        const loadSettings = async () => {
            setIsLoading(true);
            const currentSettings = await getRequestSettings();
            if (currentSettings) {
                if (!Array.isArray(currentSettings.shippingMethods)) {
                    currentSettings.shippingMethods = [];
                }
                if (currentSettings.useWarehouseReception === undefined) {
                    currentSettings.useWarehouseReception = false;
                }
            }
            setSettings(currentSettings);
            setIsLoading(false);
        };
        if (isAuthorized) {
            loadSettings();
        }
    }, [setTitle, isAuthorized]);

    const handleAddRoute = () => {
        if (!settings || !newRoute.trim()) {
            toast({ title: "Datos incompletos", description: "El nombre de la ruta no puede estar vacío.", variant: "destructive" });
            return;
        }
        if (settings.routes.some(r => r.toLowerCase() === newRoute.trim().toLowerCase())) {
            toast({ title: "Ruta Duplicada", description: "Esa ruta ya existe.", variant: "destructive" });
            return;
        }
        setSettings(prev => {
            if (!prev) return null;
            const updatedRoutes = [...prev.routes, newRoute.trim()];
            return { ...prev, routes: updatedRoutes };
        });
        setNewRoute("");
    };

    const handleDeleteRoute = useCallback((routeToDelete: string) => {
        if (!settings) return;
        setSettings(prev => {
            if (!prev) return null;
            const updatedRoutes = prev.routes.filter(r => r !== routeToDelete);
            return { ...prev, routes: updatedRoutes };
        });
        toast({ title: "Ruta Eliminada", description: "La ruta ha sido eliminada. Guarda los cambios para confirmar.", variant: "destructive"});
    }, [settings, toast]);

    const handleAddShippingMethod = () => {
        if (!settings || !newShippingMethod.trim()) {
            toast({ title: "Datos incompletos", description: "El método de envío no puede estar vacío.", variant: "destructive" });
            return;
        }
        if (settings.shippingMethods.some(s => s.toLowerCase() === newShippingMethod.trim().toLowerCase())) {
            toast({ title: "Método Duplicado", description: "Ese método de envío ya existe.", variant: "destructive" });
            return;
        }
        setSettings(prev => {
            if (!prev) return null;
            const updatedMethods = [...prev.shippingMethods, newShippingMethod.trim()];
            return { ...prev, shippingMethods: updatedMethods };
        });
        setNewShippingMethod("");
    };

    const handleDeleteShippingMethod = useCallback((methodToDelete: string) => {
        if (!settings) return;
        setSettings(prev => {
            if (!prev) return null;
            const updatedMethods = prev.shippingMethods.filter(s => s !== methodToDelete);
            return { ...prev, shippingMethods: updatedMethods };
        });
        toast({ title: "Método de Envío Eliminado", description: "El método ha sido eliminado. Guarda los cambios para confirmar.", variant: "destructive"});
    }, [settings, toast]);


    const handleSave = async () => {
        if (!settings) return;
        try {
            await saveRequestSettings(settings);
            toast({ title: "Configuración Guardada", description: "Los ajustes de compras han sido guardados." });
            await logInfo("Request settings updated", { settings });
        } catch (error: any) {
            logError("Failed to save request settings", { error: error.message });
            toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive" });
        }
    };
    
    if (!isAuthorized) {
        return null;
    }

    if (isLoading || !settings) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <Skeleton className="h-64 w-full" />
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
                        <CardTitle>Configuración General de Compras</CardTitle>
                        <CardDescription>Ajustes generales para el módulo de solicitudes de compra.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex items-center space-x-2">
                            <Switch
                                id="use-warehouse"
                                checked={settings.useWarehouseReception}
                                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, useWarehouseReception: checked } : null)}
                            />
                            <Label htmlFor="use-warehouse">Habilitar paso de "Recibido en Bodega"</Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Si se activa, las solicitudes recibidas necesitarán un paso adicional para ser archivadas.
                        </p>
                        <Separator className="my-6" />
                        <div className="space-y-2">
                            <Label htmlFor="pdf-top-legend">Leyenda Superior del PDF (Opcional)</Label>
                            <Input
                                id="pdf-top-legend"
                                value={settings.pdfTopLegend || ''}
                                onChange={(e) => setSettings(prev => prev ? { ...prev, pdfTopLegend: e.target.value } : null)}
                                placeholder="Ej: Documento Controlado - Versión 1.0"
                            />
                            <p className="text-sm text-muted-foreground pt-1">
                                Este texto aparecerá en la parte superior de los reportes PDF.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestión de Rutas</CardTitle>
                            <CardDescription>Añade o elimina las rutas de entrega disponibles para las solicitudes de compra.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                {settings.routes.map(route => (
                                    <div key={route} className="flex items-center justify-between rounded-lg border p-3">
                                        <p className="font-medium">{route}</p>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRoute(route)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Separator />
                            <div className="flex items-end gap-2 pt-2">
                                <div className="grid flex-1 gap-2">
                                    <Label htmlFor="new-route">Nueva Ruta</Label>
                                    <Input id="new-route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} placeholder="Ej: Zona Norte" />
                                </div>
                                <Button size="icon" onClick={handleAddRoute}>
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Métodos de Envío</CardTitle>
                            <CardDescription>Añade o elimina los métodos de envío para las solicitudes de compra.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                             {settings.shippingMethods.map(method => (
                                <div key={method} className="flex items-center justify-between rounded-lg border p-3">
                                    <p className="font-medium">{method}</p>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteShippingMethod(method)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                             ))}
                           </div>
                            <Separator />
                            <div className="flex items-end gap-2 pt-2">
                                <div className="grid flex-1 gap-2">
                                    <Label htmlFor="new-shipping-method">Nuevo Método de Envío</Label>
                                    <Input id="new-shipping-method" value={newShippingMethod} onChange={(e) => setNewShippingMethod(e.target.value)} placeholder="Ej: Encomienda" />
                                </div>
                                <Button size="icon" onClick={handleAddShippingMethod}>
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
             <Card className="mt-6 max-w-4xl mx-auto">
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave}>Guardar Todos los Cambios</Button>
                </CardFooter>
            </Card>
        </main>
    );
}
