
/**
 * @fileoverview Page for creating consignment inventory adjustments.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, SlidersHorizontal, ArrowLeft, Plus, Minus } from 'lucide-react';
import { useConsignmentsAdjustments } from '@/modules/consignments/hooks/useConsignmentsAdjustments';
import { SearchInput } from '@/components/ui/search-input';

export default function ConsignmentsAdjustmentsPage() {
    const { state, actions, selectors, isAuthorized } = useConsignmentsAdjustments();

    if (state.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
            </main>
        );
    }
    
    if (!isAuthorized) {
        return null;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 flex justify-center items-start">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SlidersHorizontal />
                        Ajuste de Inventario de Consignación
                    </CardTitle>
                    <CardDescription>
                        Registra mermas, productos dañados, vencidos, encontrados o cualquier cambio que no sea una venta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>1. Selecciona el Cliente</Label>
                        <SearchInput
                            options={selectors.agreementOptions}
                            onSelect={(option) => actions.handleSelectAgreement(option.value)}
                            value={state.agreementSearchTerm}
                            onValueChange={actions.setAgreementSearchTerm}
                            open={state.isAgreementSearchOpen}
                            onOpenChange={actions.setIsAgreementSearchOpen}
                            placeholder="Buscar cliente de consignación..."
                        />
                    </div>

                    {state.selectedAgreementId && (
                        <>
                            <div className="space-y-2">
                                <Label>2. Selecciona el Producto</Label>
                                <SearchInput
                                    options={selectors.productOptions}
                                    onSelect={(option) => actions.handleSelectProduct(option.value)}
                                    value={state.productSearchTerm}
                                    onValueChange={actions.setProductSearchTerm}
                                    open={state.isProductSearchOpen}
                                    onOpenChange={actions.setIsProductSearchOpen}
                                    placeholder="Buscar producto en el acuerdo..."
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">3. Cantidad a Ajustar</Label>
                                    <div className="relative">
                                        <Input
                                            id="quantity"
                                            type="number"
                                            value={state.quantity}
                                            onChange={(e) => actions.setQuantity(e.target.value)}
                                            placeholder="Ej: -5"
                                            className="pr-10"
                                        />
                                         <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                                            {Number(state.quantity) > 0 ? <Plus className="h-4 w-4 text-green-600"/> : (Number(state.quantity) < 0 ? <Minus className="h-4 w-4 text-red-600"/> : null)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Usa números negativos para rebajar (dañado, vencido) y positivos para agregar (encontrado).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reason">4. Motivo del Ajuste</Label>
                                    <Select value={state.reason} onValueChange={(value) => actions.setReason(value as any)}>
                                        <SelectTrigger id="reason"><SelectValue placeholder="Selecciona un motivo..." /></SelectTrigger>
                                        <SelectContent>
                                            {selectors.adjustmentReasons.map(reason => (
                                                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">5. Notas (Opcional)</Label>
                                <Textarea
                                    id="notes"
                                    value={state.notes}
                                    onChange={(e) => actions.setNotes(e.target.value)}
                                    placeholder="Detalla la razón del ajuste. Ej: 'Caja aplastada durante el transporte'."
                                />
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={actions.handleSaveAdjustment} disabled={state.isSubmitting || !state.selectedProductId || !state.quantity || !state.reason}>
                        {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Ajuste
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
