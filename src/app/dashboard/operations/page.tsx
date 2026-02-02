/**
 * @fileoverview Main page for the new Operations module.
 * For now, it serves as a placeholder indicating the module is under construction.
 */
'use client';

import React from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileSignature, Construction } from 'lucide-react';

export default function OperationsPage() {
    const { setTitle } = usePageTitle();

    React.useEffect(() => {
        setTitle("Centro de Trazabilidad y Operaciones");
    }, [setTitle]);

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl">
                <Card>
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-amber-100 p-4 rounded-full w-fit">
                            <Construction className="h-12 w-12 text-amber-600" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Módulo en Construcción</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                            El nuevo "Centro de Trazabilidad y Operaciones" se está desarrollando. Pronto podrás gestionar todas tus boletas y formularios digitales desde aquí.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-sm text-muted-foreground">La infraestructura base, incluyendo la base de datos y los permisos, ya ha sido creada.</p>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
