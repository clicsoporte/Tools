
/**
 * @fileoverview Main page for the new Consignments module.
 */
'use client';

import React from 'react';
import { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';

export default function ConsignmentsPage() {
    const { isAuthorized } = useAuthorization(['consignments:access']);
    const { setTitle } = usePageTitle();

    React.useEffect(() => {
        setTitle('Gestión de Consignaciones');
    }, [setTitle]);

    if (!isAuthorized) {
        return null;
    }

    // This is a placeholder. The main UI with sub-modules will be built here.
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Módulo de Gestión de Consignaciones</CardTitle>
                    <CardDescription>
                        Esta sección está en desarrollo y pronto contendrá las herramientas para gestionar acuerdos, tomar inventarios y aprobar boletas de reposición.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-muted-foreground">
                    <Construction className="h-8 w-8" />
                    <p>Funcionalidad en construcción...</p>
                </CardContent>
            </Card>
        </main>
    );
}
