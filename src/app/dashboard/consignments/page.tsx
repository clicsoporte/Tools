/**
 * @fileoverview Main page for the new Consignments module.
 */
'use client';

import React from 'react';
import { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgreementsTab } from './agreements-tab';
import { InventoryCountTab } from './inventory-count-tab';
import { BoletasTab } from './boletas-tab';

export default function ConsignmentsPage() {
    const { isAuthorized } = useAuthorization(['consignments:access']);
    const hook = useConsignments();
    const { state } = hook;
    const { isLoading, currentTab } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8 flex justify-center items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </main>
        );
    }
    
    if (!isAuthorized) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Acceso Denegado</CardTitle>
                        <CardDescription>No tienes permiso para acceder a este módulo.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Tabs value={currentTab} onValueChange={(value) => hook.actions.setCurrentTab(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="agreements">1. Acuerdos de Consignación</TabsTrigger>
                    <TabsTrigger value="inventory_count">2. Toma de Inventario</TabsTrigger>
                    <TabsTrigger value="boletas">3. Gestión de Boletas</TabsTrigger>
                </TabsList>
                <TabsContent value="agreements">
                    <AgreementsTab hook={hook} />
                </TabsContent>
                <TabsContent value="inventory_count">
                    <InventoryCountTab hook={hook} />
                </TabsContent>
                <TabsContent value="boletas">
                    <BoletasTab hook={hook} />
                </TabsContent>
            </Tabs>
        </main>
    );
}
