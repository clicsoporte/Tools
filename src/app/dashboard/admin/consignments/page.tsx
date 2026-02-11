
/**
 * @fileoverview Page for managing consignments settings.
 */
'use client';

import React from 'react';
import { useConsignmentsSettings } from '@/modules/consignments/hooks/useConsignmentsSettings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

export default function ConsignmentsSettingsPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:consignments']);

    if (!isAuthorized) {
        return null; // Or a permission denied component
    }

    // This is a placeholder. The actual UI will be built out using the useConsignmentsSettings hook.
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Consignaciones</CardTitle>
                    <CardDescription>
                        Ajustes para los consecutivos y comportamiento del módulo de consignaciones.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-muted-foreground">
                    <Construction className="h-8 w-8" />
                    <p>Esta sección está en construcción y pronto permitirá gestionar los consecutivos de las boletas de consignación por cliente.</p>
                </CardContent>
            </Card>
        </main>
    );
}
