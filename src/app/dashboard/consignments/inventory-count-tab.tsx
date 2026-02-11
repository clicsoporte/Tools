// This is a new file
'use client';

import React from 'react';
import type { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Play, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ConsignmentAgreement } from '@/modules/core/types';

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
                    {countingState.session ? 'Continúa con el inventario actual.' : 'Selecciona un acuerdo de consignación para iniciar la toma de inventario.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!countingState.session ? (
                    <div className="flex gap-4 items-center">
                        <Select onValueChange={(val) => actions.countActions.handleSelectAgreement(val)} disabled={countingState.isLoading}>
                            <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Selecciona un cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {state.agreements.map((agreement: ConsignmentAgreement) => (
                                    <SelectItem key={agreement.id} value={String(agreement.id)}>
                                        {agreement.client_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={actions.countActions.handleStartSession} disabled={countingState.isLoading || !countingState.selectedAgreementId}>
                            {countingState.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Play className="mr-2 h-4 w-4"/> Iniciar/Continuar Conteo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="font-semibold">{selectors.getAgreementName(countingState.session.agreement_id)}</h3>
                        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                            <Table>
                                <TableBody>
                                    {countingState.productsToCount.map((p, index) => (
                                        <TableRow key={p.product_id}>
                                            <TableCell className="font-medium">
                                                <p>{selectors.getProductName(p.product_id)}</p>
                                                <p className="text-xs text-muted-foreground">{p.product_id}</p>
                                            </TableCell>
                                            <TableCell className="w-48">
                                                <Input
                                                    type="number"
                                                    placeholder="Cantidad..."
                                                    defaultValue={selectors.getInitialCount(p.product_id)}
                                                    onBlur={(e) => actions.countActions.handleSaveLine(p.product_id, Number(e.target.value))}
                                                    className="text-right text-lg h-12"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground text-sm">
                                                Máx: {p.max_stock}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
            {countingState.session && (
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
                                <AlertDialogAction onClick={actions.countActions.handleAbandonSession}>Sí, abandonar</AlertDialogAction>
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
