// This is a new file

/**
 * @fileoverview New page for consignment replenishment requests.
 * Allows warehouse staff to quickly create a replenishment order based on customer request.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, CheckCircle, FileInput, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsignmentsReplenishment } from '@/modules/consignments/hooks/useConsignmentsReplenishment';
import { SearchInput } from '@/components/ui/search-input';
import { ConsignmentProduct } from '@/modules/core/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ReplenishmentRequestPage() {
    const { state, actions, selectors } = useConsignmentsReplenishment();
    const { isLoading, step, agreements, selectedAgreementId, products, quantities } = state;

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
                        <CardTitle>Solicitud de Reposición</CardTitle>
                        <CardDescription>Selecciona un cliente para registrar las cantidades a reponer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <SearchInput
                            options={selectors.agreementOptions}
                            onSelect={actions.handleSelectAgreement}
                            placeholder="Buscar cliente..."
                            value={state.agreementSearchTerm}
                            onValueChange={actions.setAgreementSearchTerm}
                            open={state.isAgreementSearchOpen}
                            onOpenChange={actions.setIsAgreementSearchOpen}
                        />
                        <Button onClick={actions.handleStartRequest} disabled={isLoading || !selectedAgreementId} className="w-full">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Play className="mr-2 h-4 w-4"/> Iniciar Solicitud
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === 'requesting' && (
                <Card className="w-full max-w-2xl">
                     <CardHeader>
                        <CardTitle>Solicitud para: {selectors.getAgreementName(selectedAgreementId!)}</CardTitle>
                        <CardDescription>Ingresa las cantidades solicitadas por el cliente para cada producto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[60vh] p-1">
                            <div className="space-y-4">
                                {products.map((p: ConsignmentProduct) => (
                                    <Card key={p.product_id}>
                                        <CardContent className="p-4 grid grid-cols-3 gap-4 items-center">
                                            <div className="col-span-2">
                                                <p className="font-medium">{selectors.getProductName(p.product_id)}</p>
                                                <p className="text-sm text-muted-foreground font-mono">{p.product_id}</p>
                                            </div>
                                            <div>
                                                <Label htmlFor={`qty-${p.product_id}`} className="sr-only">Cantidad a Reponer</Label>
                                                <Input
                                                    id={`qty-${p.product_id}`}
                                                    type="number"
                                                    placeholder="Cant."
                                                    value={quantities[p.product_id] || ''}
                                                    onChange={(e) => actions.handleQuantityChange(p.product_id, e.target.value)}
                                                    className="text-right h-12 text-lg font-bold"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="justify-end">
                         <Button onClick={actions.handleGenerateBoleta} disabled={isLoading || selectors.isRequestEmpty}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Save className="mr-2 h-4 w-4"/> Finalizar y Generar Boleta
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {step === 'finished' && (
                 <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500"/>
                        <CardTitle className="mt-4 text-2xl">¡Solicitud Generada!</CardTitle>
                        <CardDescription>
                            Se ha creado la boleta de reposición y está pendiente de aprobación.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Button onClick={actions.reset}>Iniciar Nueva Solicitud</Button>
                    </CardFooter>
                </Card>
            )}
        </main>
    );
}
