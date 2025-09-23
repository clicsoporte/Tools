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
import { logError, logInfo } from "../../../../modules/core/lib/logger";
import { UploadCloud, RotateCcw, Loader2, Save, LifeBuoy, Trash2 as TrashIcon, Download } from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { Checkbox } from '../../../../components/ui/checkbox';
import { Label } from '../../../../components/ui/label';
import { getDbModules, backupAllForUpdate, restoreAllFromUpdateBackup, listAllUpdateBackups, deleteOldUpdateBackups, uploadBackupFile } from '../../../../modules/core/lib/db';
import type { DatabaseModule, UpdateBackupInfo } from '../../../../modules/core/types';
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';


export default function MaintenancePage() {
    const { isAuthorized } = useAuthorization(['admin:maintenance:backup', 'admin:maintenance:restore', 'admin:maintenance:reset']);
    const { toast } = useToast();
    const [dbModules, setDbModules] = useState<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const { setTitle } = usePageTitle();

    // State for update backups
    const [updateBackups, setUpdateBackups] = useState<UpdateBackupInfo[]>([]);
    const [isRestoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
    const [isClearBackupsConfirmOpen, setClearBackupsConfirmOpen] = useState(false);
    const [showAllRestorePoints, setShowAllRestorePoints] = useState(false);
    const [selectedRestoreTimestamp, setSelectedRestoreTimestamp] = useState<string>('');


    const fetchMaintenanceData = useCallback(async () => {
        setIsProcessing(true);
        setProcessingAction('load');
        try {
            const [modules, backups] = await Promise.all([
                getDbModules(), 
                listAllUpdateBackups(),
            ]);
            setDbModules(modules);
            setUpdateBackups(backups);
            if (backups.length > 0) {
                const latestTimestamp = backups.reduce((latest, current) => new Date(current.date) > new Date(latest) ? current.date : latest, backups[0].date);
                setSelectedRestoreTimestamp(latestTimestamp);
            }
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
        if(isAuthorized) {
            fetchMaintenanceData();
        }
    }, [setTitle, fetchMaintenanceData, isAuthorized]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        setIsProcessing(true);
        setProcessingAction('upload');
        const formData = new FormData();
        acceptedFiles.forEach(file => {
            formData.append('backupFiles', file);
        });

        try {
            const uploadedCount = await uploadBackupFile(formData);
            toast({
                title: "Archivos Subidos",
                description: `${uploadedCount} archivo(s) de backup se han subido correctamente.`
            });
            await fetchMaintenanceData();
        } catch (error: any) {
             toast({
                title: "Error al Subir",
                description: `No se pudieron subir los archivos. Error: ${error.message}`,
                variant: "destructive"
            });
        } finally {
             setIsProcessing(false);
             setProcessingAction(null);
        }

    }, [fetchMaintenanceData, toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'], 'application/octet-stream': ['.db', '.sqlite', '.sqlite3'] },
    });
    
    const handleFullBackup = async () => {
        setIsProcessing(true);
        setProcessingAction('full-backup');
        try {
            await backupAllForUpdate();
            await fetchMaintenanceData();
            toast({
                title: "Backup Completo Creado",
                description: `Se creó un nuevo punto de restauración para la actualización.`
            });
        } catch (error: any) {
             toast({
                title: "Error de Backup",
                description: `No se pudo crear el backup completo. ${error.message}`,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };
    
    const handleFullRestore = async () => {
        if (!selectedRestoreTimestamp) {
            toast({ title: "Error", description: "Debe seleccionar un punto de restauración.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        setProcessingAction('full-restore');
        try {
            await restoreAllFromUpdateBackup(selectedRestoreTimestamp);
            toast({
                title: "Restauración Completada",
                description: `Se han restaurado los datos. La página se recargará en 5 segundos.`,
                duration: 5000,
            });
            setTimeout(() => window.location.reload(), 5000);
        } catch (error: any) {
             toast({
                title: "Error de Restauración",
                description: `No se pudo completar la restauración. ${error.message}`,
                variant: "destructive"
            });
             setIsProcessing(false);
            setProcessingAction(null);
        }
    };

    const handleClearOldBackups = async () => {
        if (uniqueTimestamps.length <= 1) {
            toast({ title: "Acción no necesaria", description: "No hay backups antiguos para eliminar.", variant: "default"});
            return;
        }

        setIsProcessing(true);
        setProcessingAction('clear-backups');
        try {
            const count = await deleteOldUpdateBackups();
            await fetchMaintenanceData();
            toast({
                title: "Limpieza Completada",
                description: `Se han eliminado ${count} backups antiguos.`
            });
        } catch (error: any) {
             toast({
                title: "Error al Limpiar",
                description: `No se pudieron eliminar los backups. ${error.message}`,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };
    
    const uniqueTimestamps = [...new Set(updateBackups.map(b => b.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime());

    const oldBackupsCount = uniqueTimestamps.length > 1 ? uniqueTimestamps.length - 1 : 0;
    
    if (isAuthorized === null || (isAuthorized && isLoading)) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-8">
                    <Skeleton className="h-96 w-full" />
                </div>
            </main>
        )
    }

    if (!isAuthorized) {
        return null;
    }


    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">

                 <Card className="border-primary/50">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <LifeBuoy className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Gestión de Backups y Actualizaciones</CardTitle>
                                <CardDescription>
                                Herramientas para crear puntos de restauración, restaurar el sistema y gestionar archivos de backup.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold">Crear Backup</h3>
                                <p className="text-sm text-muted-foreground">
                                    Crea una copia de seguridad de todas las bases de datos en un nuevo punto de restauración. Ideal antes de una actualización.
                                </p>
                                <Button onClick={handleFullBackup} disabled={isProcessing} className="w-full">
                                    {processingAction === 'full-backup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Crear Punto de Restauración
                                </Button>
                            </div>
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold">Restaurar Sistema</h3>
                                 <div className="space-y-2">
                                    <Label>Punto de Restauración a Usar</Label>
                                     <Select value={selectedRestoreTimestamp} onValueChange={setSelectedRestoreTimestamp} disabled={isProcessing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione un punto de restauración..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniqueTimestamps.slice(0, showAllRestorePoints ? undefined : 5).map(ts => (
                                                <SelectItem key={ts} value={ts}>{format(parseISO(ts), "dd/MM/yyyy 'a las' HH:mm:ss", { locale: es })}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox id="show-all-restore-points" checked={showAllRestorePoints} onCheckedChange={(checked) => setShowAllRestorePoints(checked as boolean)} />
                                        <Label htmlFor="show-all-restore-points" className="text-sm font-normal">Mostrar todos los puntos de restauración</Label>
                                    </div>
                                </div>
                                <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isProcessing || !selectedRestoreTimestamp} className="w-full">
                                            {processingAction === 'full-restore' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                            Restaurar desde Selección
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar Restauración?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción reemplazará todas las bases de datos actuales con los datos del punto de restauración seleccionado. Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleFullRestore}>Sí, restaurar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                         <Card>
                            <CardHeader>
                                <CardTitle>Archivos de Backup</CardTitle>
                                <CardDescription>Sube backups desde tu computadora o descarga los existentes.</CardDescription>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                <div {...getRootProps()} className={cn("flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors", isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}>
                                    <input {...getInputProps()} disabled={isProcessing}/>
                                    <UploadCloud className="w-12 h-12 text-muted-foreground" />
                                    <p className="mt-4 text-center text-muted-foreground">
                                        {isDragActive ? "Suelta los archivos aquí..." : "Arrastra archivos .db aquí o haz clic para seleccionar"}
                                    </p>
                                </div>
                                <ScrollArea className="h-60 w-full rounded-md border p-2">
                                     {updateBackups.length > 0 ? (
                                        <div className="space-y-2">
                                            {updateBackups.map(b => (
                                                <div key={b.fileName} className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
                                                    <div>
                                                        <p className="font-semibold text-sm">{b.moduleName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(parseISO(b.date), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                                                        </p>
                                                    </div>
                                                    <a href={`/api/temp-backups?file=${encodeURIComponent(b.fileName)}`} download={b.fileName}>
                                                        <Button variant="ghost" size="icon"><Download className="h-4 w-4"/></Button>
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                     ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <p className="text-muted-foreground text-sm">No hay archivos de backup.</p>
                                        </div>
                                     )}
                                </ScrollArea>
                            </CardContent>
                            <CardFooter>
                                <AlertDialog open={isClearBackupsConfirmOpen} onOpenChange={setClearBackupsConfirmOpen}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" disabled={isProcessing || oldBackupsCount === 0} className="w-full sm:w-auto">
                                                {processingAction === 'clear-backups' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TrashIcon className="mr-2 h-4 w-4" />}
                                                Limpiar {oldBackupsCount > 0 ? `${oldBackupsCount} Puntos de Restauración` : 'Backups'} Antiguos
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Limpiar Backups Antiguos?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará todos los puntos de restauración excepto el más reciente para liberar espacio. Esta acción no se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearOldBackups}>Sí, limpiar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                             </CardFooter>
                         </Card>
                    </CardContent>
                </Card>
            </div>
            
            {(isProcessing) && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Procesando...</span>
                </div>
            )}
        </main>
    );
}
