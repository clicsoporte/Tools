// This is a new file
'use client';

import React from 'react';
import { useConsignmentsClosures } from '@/modules/consignments/hooks/useConsignmentsClosures';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, FileSignature, Loader2, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ClosuresPage() {
    const { state, actions, selectors } = useConsignmentsClosures();

    if (state.isInitialLoading) {
        return <main className="flex-1 p-4 md:p-6 lg:p-8"><Loader2 className="animate-spin" /></main>;
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card className="max-w-6xl mx-auto">
                 <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Gestión de Cierres de Periodo</CardTitle>
                            <CardDescription>
                                Administra los cierres de facturación para los clientes de consignación.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => actions.loadData(true)} disabled={state.isRefreshing}>
                                {state.isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refrescar
                            </Button>
                            <Button onClick={actions.handleInitiateClosure}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Cierre
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Consecutivo</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Fecha Creación</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.closures.map(closure => (
                                <TableRow key={closure.id}>
                                    <TableCell className="font-mono font-bold text-primary">{closure.consecutive}</TableCell>
                                    <TableCell>{selectors.getAgreementName(closure.agreement_id)}</TableCell>
                                    <TableCell>{format(parseISO(closure.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                                    <TableCell>
                                        <Badge variant={closure.status === 'approved' ? 'default' : (closure.status === 'rejected' ? 'destructive' : 'secondary')}>
                                            {selectors.getStatusLabel(closure.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => actions.handleViewClosure(closure.id)}
                                        >
                                            Ver Detalles
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </main>
    );
}
