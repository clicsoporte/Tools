
'use client';

import React from 'react';
import { useConsignmentsInventoryCount } from '@/modules/consignments/hooks/useConsignmentsInventoryCount';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Play, CheckCircle, Save, FileSignature } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ConsignmentProduct } from '@/modules/core/types';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function InventoryCountPage() {
    const { state, actions, selectors } = useConsignmentsInventoryCount();
    const { step, isLoading, selectedAgreementId, productsToCount, isSubmitting } = state;

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
                        <CardTitle>Conteo Físico en Sitio</CardTitle>
                        <CardDescription>
                            Selecciona un acuerdo de consignación para iniciar el conteo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 items-center w-full max-w-sm mx-auto">
                        <Select onValueChange={actions.handleSelectAgreement} disabled={isLoading}>
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
                    </CardContent>
                </Card>
            )}
            
            {step === 'counting' && (
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Contando en: {selectors.getAgreementName(selectedAgreementId)}</CardTitle>
                        <CardDescription>
                            Ingresa las cantidades físicas para cada producto.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[60vh] p-1">
                            <div className="space-y-4">
                                {productsToCount.length > 0 ? (
                                    productsToCount.map((p: ConsignmentProduct) => (
                                        <Card key={p.product_id} className="p-4">
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 items-center">
                                                <div className="col-span-2 sm:col-span-3">
                                                    <p className="font-medium leading-snug">{selectors.getProductName(p.product_id)}</p>
                                                    <p className="text-sm text-muted-foreground font-mono">{p.product_id}</p>
                                                </div>
                                                <div className="col-span-1">
                                                    <Label htmlFor={`count-${p.product_id}`} className="sr-only">Cantidad</Label>
                                                    <Input
                                                        id={`count-${p.product_id}`}
                                                        type="number"
                                                        placeholder="Cant."
                                                        value={state.counts[p.product_id] || ''}
                                                        onChange={(e) => actions.handleQuantityChange(p.product_id, e.target.value)}
                                                        className="text-right text-2xl h-14 font-bold hide-number-arrows"
                                                    />
                                                </div>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <p className="font-semibold">Este acuerdo no tiene productos autorizados.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="justify-between">
                         <Button variant="outline" onClick={actions.handleSaveInformationalCount} disabled={isSubmitting || !selectors.hasCounts}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Save className="mr-2 h-4 w-4"/> Guardar Conteo Informativo
                        </Button>
                        <AlertDialog open={state.isClosureConfirmOpen} onOpenChange={actions.setIsClosureConfirmOpen}>
                            <AlertDialogTrigger asChild>
                                <Button disabled={isSubmitting || !selectors.hasCounts}>
                                    <FileSignature className="mr-2 h-4 w-4"/> Solicitar Cierre de Periodo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar Cierre de Periodo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción generará un registro de cierre oficial con el conteo actual para la facturación. ¿Estás seguro que este es el conteo final?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={actions.handleRequestClosure}>Sí, Generar Cierre</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
            )}

            {step === 'finished' && (
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500"/>
                        <CardTitle className="mt-4 text-2xl">¡Conteo Guardado!</CardTitle>
                        <CardDescription>
                            El conteo informativo ha sido registrado.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Button onClick={actions.reset}>Realizar otro conteo</Button>
                    </CardFooter>
                </Card>
            )}
        </main>
    );
}
