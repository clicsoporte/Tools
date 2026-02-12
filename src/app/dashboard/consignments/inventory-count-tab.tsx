// This is a new file
'use client';

import React from 'react';
import type { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Play, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ConsignmentProduct } from '@/modules/core/types';
import { Label } from '@/components/ui/label';

type InventoryCountTabProps = {
  hook: ReturnType<typeof useConsignments>;
};

export function InventoryCountTab({ hook }: InventoryCountTabProps) {
    const { state, actions, selectors } = hook;
    const { countingState } = state;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Toma de Inventario en Sitio</CardTitle>
                 <CardDescription>
                    {countingState.step === 'counting' ? 'Continúa con el inventario actual.' : 'Selecciona un acuerdo de consignación para iniciar la toma de inventario.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {countingState.step === 'setup' && (
                    <div className="flex flex-col gap-4 items-center w-full max-w-sm mx-auto">
                        <Select onValueChange={(val) => actions.countActions.handleSelectAgreement(val)} disabled={countingState.isLoading}>
                            <SelectTrigger className="w-full h-12 text-base">
                                <SelectValue placeholder="Selecciona un cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {selectors.agreementOptions.map((agreement) => (
                                    <SelectItem key={agreement.value} value={agreement.value}>
                                        {agreement.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={actions.countActions.handleStartSession} disabled={countingState.isLoading || !countingState.selectedAgreementId} className="w-full h-12 text-lg">
                            {countingState.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Play className="mr-2 h-4 w-4"/> Iniciar Conteo
                        </Button>
                    </div>
                )}
                 {countingState.step === 'resume' && countingState.existingSession && (
                    <div className="text-center space-y-4">
                        <h3 className="font-semibold text-lg">Sesión en Progreso</h3>
                        <p className="text-muted-foreground">
                            Tienes una sesión de conteo sin terminar para el cliente <strong>{selectors.getAgreementName(countingState.existingSession.agreement_id)}</strong>.
                        </p>
                        <p>¿Deseas continuar donde la dejaste o abandonarla para empezar de nuevo?</p>
                        <div className="flex justify-center gap-4 pt-4">
                            <Button variant="destructive" onClick={actions.countActions.abandonSession}>Abandonar Sesión</Button>
                            <Button onClick={actions.countActions.resumeSession}>Continuar Sesión</Button>
                        </div>
                    </div>
                )}
                {countingState.step === 'counting' && countingState.session && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{selectors.getAgreementName(countingState.session.agreement_id)}</h3>
                         <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                            {countingState.productsToCount.length > 0 ? (
                                countingState.productsToCount.map((p: ConsignmentProduct) => (
                                    <Card key={p.product_id} className="p-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium">{selectors.getProductName(p.product_id)}</p>
                                                <p className="text-xs text-muted-foreground">{p.product_id}</p>
                                                <p className="text-sm text-muted-foreground mt-1">Stock Máximo: {p.max_stock}</p>
                                            </div>
                                            <div className="w-full sm:w-32">
                                                <Label htmlFor={`count-${p.product_id}`} className="sr-only">Cantidad</Label>
                                                <Input
                                                    id={`count-${p.product_id}`}
                                                    type="number"
                                                    placeholder="Cant."
                                                    defaultValue={selectors.getInitialCount(p.product_id)}
                                                    onBlur={(e) => actions.countActions.handleSaveLine(p.product_id, Number(e.target.value))}
                                                    className="text-right text-2xl h-14 font-bold hide-number-arrows"
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground py-10">
                                    <p className="font-semibold">Este acuerdo no tiene productos autorizados.</p>
                                    <p className="text-sm">Ve a la pestaña &quot;Acuerdos de Consignación&quot; para añadirlos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
            {countingState.step === 'counting' && countingState.session && (
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
                                <AlertDialogAction onClick={actions.countActions.abandonCurrentSession}>Sí, abandonar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={actions.countActions.handleGenerateBoleta} disabled={countingState.isLoading}>
                        <CheckCircle className="mr-2 h-4 w-4"/> Finalizar y Generar Boleta
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
