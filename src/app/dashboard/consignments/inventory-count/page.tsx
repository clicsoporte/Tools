'use client';

import React from 'react';
import { useConsignmentsInventoryCount } from '@/modules/consignments/hooks/useConsignmentsInventoryCount';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Play, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ConsignmentProduct } from '@/modules/core/types';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Skeleton } from '@/components/ui/skeleton';

export default function InventoryCountPage() {
    const { state, actions, selectors } = useConsignmentsInventoryCount();
    const { step, isLoading, selectedAgreementId, session, existingSession, productsToCount } = state;
    usePageTitle().setTitle('Toma de Inventario de Consignación');

    if (isLoading && step === 'setup') {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8 flex items-center justify-center">
                <Skeleton className="h-64 w-full max-w-xl" />
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 flex items-center justify-center">
            {step === 'setup' && (
                <Card className="w-full max-w-md">
                     <CardHeader>
                        <CardTitle>Toma de Inventario en Sitio</CardTitle>
                        <CardDescription>
                            Selecciona un acuerdo de consignación para iniciar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 items-center w-full max-w-sm mx-auto">
                        <Select onValueChange={(val) => actions.handleSelectAgreement(val)} disabled={isLoading}>
                            <SelectTrigger className="w-full h-12 text-base">
                                <SelectValue placeholder="Selecciona un cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {selectors.agreementOptions.map((agreement: { value: string; label: string }) => (
                                    <SelectItem key={agreement.value} value={agreement.value}>
                                        {agreement.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={actions.handleStartSession} disabled={isLoading || !selectedAgreementId} className="w-full h-12 text-lg">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Play className="mr-2 h-4 w-4"/> Iniciar Conteo
                        </Button>
                    </CardContent>
                </Card>
            )}
            {step === 'resume' && existingSession && (
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Sesión en Progreso</CardTitle>
                        <CardDescription>
                            Tienes una sesión sin terminar para <strong>{selectors.getAgreementName(existingSession.agreement_id)}</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p>¿Deseas continuar donde la dejaste o abandonarla para empezar de nuevo?</p>
                    </CardContent>
                    <CardFooter className="justify-center gap-4">
                        <Button variant="destructive" onClick={actions.abandonSession}>Abandonar</Button>
                        <Button onClick={actions.resumeSession}>Continuar Sesión</Button>
                    </CardFooter>
                </Card>
            )}
            {step === 'counting' && session && (
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Contando en: {selectors.getAgreementName(session.agreement_id)}</CardTitle>
                        <CardDescription>
                            Ingresa las cantidades físicas para cada producto. Los datos se guardan al pasar de un campo a otro.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                            {productsToCount.length > 0 ? (
                                productsToCount.map((p: ConsignmentProduct) => (
                                    <Card key={p.product_id} className="p-4">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 items-center">
                                            <div className="col-span-2 sm:col-span-3">
                                                <p className="font-medium leading-snug">{selectors.getProductName(p.product_id)}</p>
                                                <p className="text-sm text-muted-foreground font-mono">{p.product_id}</p>
                                                <p className="text-sm text-muted-foreground mt-1">Stock Máximo: <span className="font-semibold">{p.max_stock}</span></p>
                                            </div>
                                            <div className="col-span-1">
                                                <Label htmlFor={`count-${p.product_id}`} className="sr-only">Cantidad</Label>
                                                <Input
                                                    id={`count-${p.product_id}`}
                                                    type="number"
                                                    placeholder="Cant."
                                                    value={state.counts[p.product_id] || ''}
                                                    onChange={(e) => actions.handleQuantityChange(p.product_id, e.target.value)}
                                                    onBlur={(e) => actions.handleSaveLine(p.product_id, Number(e.target.value))}
                                                    className="text-right text-2xl h-14 font-bold hide-number-arrows"
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <p className="font-semibold">Este acuerdo no tiene productos autorizados.</p>
                                    <p className="text-sm">Ve a la sección &quot;Acuerdos de Consignación&quot; para añadirlos.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">Abandonar Sesión</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Abandonar Sesión?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Se perderán todos los conteos no guardados en esta sesión.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={actions.abandonCurrentSession}>Sí, abandonar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={actions.handleGenerateBoleta} disabled={isLoading || productsToCount.length === 0}>
                            <CheckCircle className="mr-2 h-4 w-4"/> Finalizar y Generar Boleta
                        </Button>
                    </CardFooter>
                </Card>
            )}
            {step === 'finished' && (
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500"/>
                        <CardTitle className="mt-4 text-2xl">¡Sesión Finalizada!</CardTitle>
                        <CardDescription>
                            Se ha generado la boleta de reposición y está pendiente de aprobación.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Button onClick={actions.reset}>Iniciar Nuevo Conteo</Button>
                    </CardFooter>
                </Card>
            )}
        </main>
    );
}
