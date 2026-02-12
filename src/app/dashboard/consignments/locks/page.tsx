'use client';

import React, { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Loader2, RefreshCw, Unlock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsignmentLocks } from '@/modules/consignments/hooks/useConsignmentLocks';

export default function ConsignmentLockPage() {
    const { setTitle } = usePageTitle();
    const { state, actions } = useConsignmentLocks();

    useEffect(() => {
        setTitle("Gestión de Bloqueos de Consignación");
    }, [setTitle]);
    
    if (state.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-64 w-full max-w-4xl mx-auto" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <CardTitle>Sesiones de Conteo Activas</CardTitle>
                                <CardDescription>
                                    Aquí puedes ver qué acuerdos están siendo inventariados y por quién. Puedes liberar sesiones si es necesario.
                                </CardDescription>
                            </div>
                            <Button onClick={actions.fetchLocks} disabled={state.isLoading}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refrescar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Acuerdo (Cliente)</TableHead>
                                    <TableHead>Bloqueado por</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {state.locks.length > 0 ? state.locks.map(lock => (
                                    <TableRow key={lock.id}>
                                        <TableCell className="font-medium">{lock.agreement_name}</TableCell>
                                        <TableCell>{lock.user_name}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={state.isReleasing === lock.id}>
                                                        {state.isReleasing === lock.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                                                        Liberar
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Forzar Liberación?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción finalizará la sesión de conteo de <strong>{lock.user_name}</strong> en el acuerdo <strong>{lock.agreement_name}</strong>. El usuario podría perder progreso no guardado.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => actions.handleReleaseLock(lock.id)}>Sí, liberar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No hay sesiones de conteo activas en este momento.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
