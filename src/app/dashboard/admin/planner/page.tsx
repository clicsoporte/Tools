
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import type { PlannerMachine, PlannerSettings } from "@/modules/core/types";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { getPlannerSettings, savePlannerSettings } from "@/modules/planner/lib/db-client";
import { PlusCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function PlannerSettingsPage() {
    useAuthorization(['admin:settings:planner']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const [settings, setSettings] = useState<PlannerSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newMachine, setNewMachine] = useState({ id: "", name: "" });

    useEffect(() => {
        setTitle("Configuración del Planificador");
        const loadSettings = async () => {
            setIsLoading(true);
            const currentSettings = await getPlannerSettings();
            if (!currentSettings.assignmentLabel) {
                currentSettings.assignmentLabel = 'Máquina Asignada';
            }
            setSettings(currentSettings);
            setIsLoading(false);
        };
        loadSettings();
    }, [setTitle]);

    const handleAddMachine = () => {
        if (!settings || !newMachine.id || !newMachine.name) {
            toast({ title: "Datos incompletos", description: "El ID y el Nombre de la máquina son requeridos.", variant: "destructive" });
            return;
        }
        if (settings.machines.some(m => m.id === newMachine.id)) {
            toast({ title: "ID Duplicado", description: "Ya existe una máquina con ese ID.", variant: "destructive" });
            return;
        }
        setSettings(prev => prev ? { ...prev, machines: [...prev.machines, newMachine] } : null);
        setNewMachine({ id: "", name: "" });
    };

    const handleDeleteMachine = (id: string) => {
        if (!settings) return;
        setSettings(prev => prev ? { ...prev, machines: prev.machines.filter(m => m.id !== id) } : null);
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            await savePlannerSettings(settings);
            toast({ title: "Configuración Guardada", description: "Los ajustes del planificador han sido guardados." });
            await logInfo("Planner settings updated", { settings });
        } catch (error: any) {
            logError("Failed to save planner settings", { error: error.message });
            toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive" });
        }
    };

    if (isLoading || !settings) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-2xl space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración General del Planificador</CardTitle>
                        <CardDescription>Ajustes generales para el módulo de planificación de producción.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Label htmlFor="assignment-label">Etiqueta para Asignación</Label>
                             <Input
                                id="assignment-label"
                                value={settings.assignmentLabel}
                                onChange={(e) => setSettings(prev => prev ? { ...prev, assignmentLabel: e.target.value } : null)}
                             />
                             <p className="text-sm text-muted-foreground">
                                Cambia el texto que se muestra para la asignación (ej: "Máquina", "Proceso", "Operario").
                             </p>
                        </div>
                        <Separator />
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="use-warehouse"
                                checked={settings.useWarehouseReception}
                                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, useWarehouseReception: checked } : null)}
                            />
                            <Label htmlFor="use-warehouse">Habilitar paso de "Recibido en Bodega"</Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Si se activa, las órdenes completadas necesitarán un paso adicional para ser archivadas.
                        </p>
                         <div className="flex items-center space-x-2">
                            <Switch
                                id="require-machine"
                                checked={settings.requireMachineForStart}
                                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, requireMachineForStart: checked } : null)}
                            />
                            <Label htmlFor="require-machine">Requerir asignación para iniciar la orden</Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                           Si se activa, será obligatorio realizar una asignación a la orden antes de poder cambiar su estado a "En Progreso".
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Gestión de Asignaciones (Máquinas, Procesos, etc.)</CardTitle>
                        <CardDescription>Añade o elimina las opciones de asignación disponibles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                            {settings.machines.map(machine => (
                                <div key={machine.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="font-medium">{machine.name}</p>
                                        <p className="text-sm text-muted-foreground">ID: <span className="font-mono">{machine.id}</span></p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteMachine(machine.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Separator />
                        <div className="flex items-end gap-2 pt-2">
                            <div className="grid flex-1 gap-2">
                                <Label htmlFor="machine-id">ID de Asignación</Label>
                                <Input id="machine-id" value={newMachine.id} onChange={(e) => setNewMachine(prev => ({ ...prev, id: e.target.value }))} placeholder="Ej: M01" />
                            </div>
                            <div className="grid flex-1 gap-2">
                                <Label htmlFor="machine-name">Nombre de Asignación</Label>
                                <Input id="machine-name" value={newMachine.name} onChange={(e) => setNewMachine(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: Prensa Heidelberg" />
                            </div>
                            <Button size="icon" onClick={handleAddMachine}>
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardFooter className="border-t px-6 py-4">
                        <Button onClick={handleSave}>Guardar Todos los Cambios</Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    );
}
