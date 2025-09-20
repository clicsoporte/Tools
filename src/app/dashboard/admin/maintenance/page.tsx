/**
 * @fileoverview System maintenance page for administrators.
 * This page provides critical, high-risk functionalities such as database
 * backup, restore, and factory reset. It is designed to be modular to support
 * future tools with separate databases.
 */
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "../../../../components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "../../../../components/ui/select"
import { useToast } from "../../../../modules/core/hooks/use-toast";
import { logError, logInfo, logWarn } from "../../../../modules/core/lib/logger";
import { DatabaseBackup, UploadCloud, RotateCcw, AlertTriangle, Loader2, Save, LifeBuoy } from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { Checkbox } from '../../../../components/ui/checkbox';
import { Label } from '../../../../components/ui/label';
import { Input } from '../../../../components/ui/input';
import { getDbModules, backupDatabase, restoreDatabase, resetDatabase, backupAllForUpdate, restoreAllFromUpdateBackup, listUpdateBackups } from '../../../../modules/core/lib/db';
import type { DatabaseModule, UpdateBackupInfo } from '../../../../modules/core/types';
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';


export default function MaintenancePage() {
    useAuthorization(['admin:maintenance:backup', 'admin:maintenance:restore', 'admin:maintenance:reset']);
    const { toast } = useToast();
    const [dbModules, setDbModules] = useState<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]>([]);
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const { setTitle } = usePageTitle();

    // State for the reset confirmation flow
    const [resetStep, setResetStep] = useState(0);
    const [resetConfirmationText, setResetConfirmationText] = useState('');

    // State for update backups
    const [updateBackups, setUpdateBackups] = useState<UpdateBackupInfo[]>([]);
    const [isRestoreConfirmOpen, setRestoreConfirmOpen] = useState(false);


    const fetchMaintenanceData = useCallback(async () => {
        setIsProcessing(true);
        setProcessingAction('load');
        try {
            const [modules, backups] = await Promise.all([getDbModules(), listUpdateBackups()]);
            setDbModules(modules);
            if (modules.length > 0) {
                setSelectedModule(modules[0].id);
            }
            setUpdateBackups(backups);
        } catch(error: any) {
            logError("Error fetching maintenance data", { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar los datos de mantenimiento.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    }, [toast]);

    useEffect(() => {
        setTitle("Mantenimiento del Sistema");
        fetchMaintenanceData();
    }, [setTitle, fetchMaintenanceData]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0 && selectedModule) {
            const file = acceptedFiles[0];
            setIsProcessing(true);
            setProcessingAction(`restore-${selectedModule}`);
            try {
                const formData = new FormData();
                formData.append('moduleId', selectedModule);
                formData.append('backupFile', file);
                
                await restoreDatabase(formData);
                
                toast({
                    title: "Restauración Exitosa",
                    description: `La base de datos para el módulo '${selectedModule}' ha sido restaurada.`,
                });
                await logInfo(`Database restored for module: ${selectedModule}`);
            } catch (error: any) {
                toast({
                    title: "Error de Restauración",
                    description: `No se pudo restaurar la base de datos. Error: ${error.message}`,
                    variant: "destructive"
                });
                await logError(`Error restoring database for module ${selectedModule}`, { error: error.message });
            } finally {
                setIsProcessing(false);
                setProcessingAction(null);
            }
        }
    }, [selectedModule, toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'], 'application/octet-stream': ['.db', '.sqlite', '.sqlite3'] },
        maxFiles: 1,
    });

    const handleBackup = async () => {
        if (!selectedModule) return;
        setIsProcessing(true);
        setProcessingAction(`backup-${selectedModule}`);
        try {
            const buffer = await backupDatabase(selectedModule);
            const blob = new Blob([new Uint8Array(buffer)], { type: 'application/x-sqlite3' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${selectedModule}-${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({
                title: "Copia de Seguridad Exitosa",
                description: `Se ha descargado la copia de seguridad para '${selectedModule}'.`,
            });
            await logInfo(`Database backup created for module: ${selectedModule}`);
        } catch (error: any) {
            toast({
                title: "Error de Backup",
                description: `No se pudo crear la copia de seguridad. Error: ${error.message}`,
                variant: "destructive"
            });
            await logError(`Error creating backup for module ${selectedModule}`, { error: error.message });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    }

    const handleReset = async () => {
        if (!selectedModule || resetStep !== 2 || resetConfirmationText !== 'RESET') return;
        setIsProcessing(true);
        setProcessingAction(`reset-${selectedModule}`);
        try {
            await resetDatabase(selectedModule);
            toast({
                title: "Sistema Reseteado",
                description: `El módulo '${dbModules.find(m => m.id === selectedModule)?.name}' ha sido reseteado a los valores de fábrica.`,
                variant: 'destructive',
            });
            await logWarn(`System reset to factory defaults for module: ${selectedModule}`);
        } catch (error: any) {
             toast({
                title: "Error de Reseteo",
                description: `No se pudo resetear el módulo. Error: ${error.message}`,
                variant: "destructive"
            });
            await logError(`Error resetting module ${selectedModule}`, { error: error.message });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
            setResetStep(0);
            setResetConfirmationText('');
        }
    }
    
    const handleFullBackup = async () => {
        setIsProcessing(true);
        setProcessingAction('full-backup');
        try {
            const backedUpFiles = await backupAllForUpdate();
            await fetchMaintenanceData();
            toast({
                title: "Backup Completo Creado",
                description: `Se han respaldado ${backedUpFiles.length} bases de datos para la actualización.`
            });
            await logInfo("Full backup for update created", { files: backedUpFiles });
        } catch (error: any) {
             toast({
                title: "Error de Backup",
                description: `No se pudo crear el backup completo. ${error.message}`,
                variant: "destructive"
            });
            await logError(`Error creating full backup`, { error: error.message });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };
    
    const handleFullRestore = async () => {
        setIsProcessing(true);
        setProcessingAction('full-restore');
        try {
            const restoredFiles = await restoreAllFromUpdateBackup();
            toast({
                title: "Restauración Completa",
                description: `Se han restaurado ${restoredFiles.length} bases de datos. La página se recargará.`,
                duration: 5000,
            });
            await logWarn("Full restore from update backup performed", { files: restoredFiles });
            setTimeout(() => window.location.reload(), 3000);
        } catch (error: any) {
             toast({
                title: "Error de Restauración",
                description: `No se pudo completar la restauración. ${error.message}`,
                variant: "destructive"
            });
            await logError(`Error performing full restore`, { error: error.message });
             setIsProcessing(false);
            setProcessingAction(null);
        }
    };


    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">

                 <Card className="border-primary/50">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <LifeBuoy className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Gestión de Actualizaciones</CardTitle>
                                <CardDescription>
                                Herramientas para realizar un backup antes de actualizar y restaurar después.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="font-semibold">Paso 1: Crear Backup</h3>
                             <p className="text-sm text-muted-foreground">
                                Presiona este botón para crear una copia de seguridad de todas las bases de datos en una carpeta especial.
                            </p>
                            <Button onClick={handleFullBackup} disabled={isProcessing} className="w-full">
                                {processingAction === 'full-backup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Backup para Actualización
                            </Button>
                        </div>
                        <div className="space-y-4">
                             <h3 className="font-semibold">Paso 2: Restaurar Backup</h3>
                            <p className="text-sm text-muted-foreground">
                                Después de actualizar los archivos de la aplicación, presiona este botón para restaurar los datos desde el último backup.
                            </p>
                            {updateBackups.length > 0 ? (
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    {updateBackups.map(b => (
                                        <li key={b.moduleId}>
                                            <strong>{b.moduleName}:</strong> {format(parseISO(b.date), "dd/MM/yyyy HH:mm", { locale: es })}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-center py-4 text-muted-foreground">No hay backups de actualización disponibles.</p>
                            )}

                             <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isProcessing || updateBackups.length === 0} className="w-full">
                                        {processingAction === 'full-restore' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                        Restaurar Último Backup
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Confirmar Restauración?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción reemplazará todas las bases de datos actuales con los datos del último backup. Esta acción no se puede deshacer.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleFullRestore}>Sí, restaurar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Mantenimiento por Módulo</CardTitle>
                        <CardDescription>
                            Elige sobre qué módulo o herramienta deseas realizar la operación individual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Select value={selectedModule} onValueChange={setSelectedModule} disabled={isProcessing}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Selecciona un módulo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {dbModules.map(mod => (
                                     <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Copia de Seguridad</CardTitle>
                            <CardDescription>
                                Descarga un archivo de la base de datos actual para guardarlo como respaldo.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button onClick={handleBackup} disabled={!selectedModule || isProcessing}>
                                {processingAction === `backup-${selectedModule}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseBackup className="mr-2 h-4 w-4" />}
                                Descargar Copia de Seguridad
                            </Button>
                        </CardFooter>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Restaurar Copia de Seguridad</CardTitle>
                            <CardDescription>
                                Sube un archivo de base de datos (`.db`) para reemplazar los datos actuales. Esta acción es irreversible.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div {...getRootProps()} className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                                <input {...getInputProps()} disabled={!selectedModule || isProcessing}/>
                                <UploadCloud className="w-12 h-12 text-muted-foreground" />
                                <p className="mt-4 text-center text-muted-foreground">
                                    {isDragActive ? "Suelta el archivo aquí..." : "Arrastra un archivo .db o haz clic para seleccionar"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
                 <Card className="border-destructive">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                            <div>
                                <CardTitle>Zona de Peligro</CardTitle>
                                <CardDescription>
                                Estas acciones son destructivas y no se pueden deshacer. Procede con extrema precaución.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <h3 className="font-semibold">Resetear Módulo a Estado de Fábrica</h3>
                       <p className="text-sm text-muted-foreground">
                           Esto borrará todos los datos del módulo seleccionado ({dbModules.find(m => m.id === selectedModule)?.name}) y lo restaurará a su estado inicial.
                       </p>
                        {resetStep > 0 && (
                            <div className="space-y-4 rounded-lg border bg-background p-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="confirm-reset"
                                        checked={resetStep > 1}
                                        onCheckedChange={(checked) => setResetStep(checked ? 2 : 1)}
                                     />
                                    <Label htmlFor="confirm-reset" className="font-medium text-destructive">
                                        Entiendo que esta acción es irreversible y borrará todos los datos del módulo.
                                    </Label>
                                </div>
                                {resetStep > 1 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="reset-text">Para confirmar, escribe "RESET" en el campo de abajo:</Label>
                                        <Input
                                            id="reset-text"
                                            value={resetConfirmationText}
                                            onChange={(e) => setResetConfirmationText(e.target.value.toUpperCase())}
                                            className="border-destructive focus-visible:ring-destructive"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                         {resetStep === 0 ? (
                            <Button variant="destructive" onClick={() => setResetStep(1)} disabled={!selectedModule || isProcessing}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Iniciar Reseteo de Fábrica
                            </Button>
                         ) : (
                             <Button 
                                variant="destructive" 
                                onClick={handleReset} 
                                disabled={resetStep !== 2 || resetConfirmationText !== 'RESET' || isProcessing}
                            >
                                {processingAction === `reset-${selectedModule}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Resetear Módulo Ahora
                            </Button>
                         )}
                    </CardFooter>
                </Card>
            </div>
            
            {isProcessing && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Procesando...</span>
                </div>
            )}
        </main>
    );
}
