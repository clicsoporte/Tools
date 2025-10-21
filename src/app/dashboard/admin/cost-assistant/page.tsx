/**
 * @fileoverview Placeholder page for Cost Assistant settings.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Wrench } from 'lucide-react';

export default function CostAssistantSettingsPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:cost-assistant']);
    const { setTitle } = usePageTitle();

    useEffect(() => {
        setTitle("Configuración del Asistente de Costos");
    }, [setTitle]);

    if (isAuthorized === null) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-64 w-full max-w-2xl mx-auto" />
            </main>
        );
    }
    
    if (isAuthorized === false) {
        return null;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wrench className="h-6 w-6"/>
                            Configuración del Asistente de Costos
                        </CardTitle>
                        <CardDescription>
                            Ajustes globales para el módulo de Asistente de Costos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Este módulo aún no tiene configuraciones globales.</p>
                            <p className="text-sm">Las preferencias de columnas son específicas de cada usuario.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
