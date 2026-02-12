// This is a new file
'use client';

import React from 'react';
import type { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Check, Ban, Truck, FileCheck2, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { RestockBoleta } from '@/modules/core/types';

type BoletasTabProps = {
  hook: ReturnType<typeof useConsignments>;
};

export function BoletasTab({ hook }: BoletasTabProps) {
    const { state, actions, selectors } = hook;
    const { boletasState } = state;
    const { boletas, isLoading } = boletasState;

    const statusConfig = {
        pending: { label: "Pendiente", color: "bg-yellow-500" },
        approved: { label: "Aprobada", color: "bg-green-500" },
        sent: { label: "Enviada", color: "bg-blue-500" },
        invoiced: { label: "Facturada", color: "bg-indigo-500" },
        canceled: { label: "Cancelada", color: "bg-red-700" },
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión de Boletas de Reposición</CardTitle>
                <CardDescription>
                    Aprueba, edita y gestiona el ciclo de vida de las boletas de envío.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Consecutivo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Fecha Creación</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Factura ERP</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {boletas.map((boleta: RestockBoleta) => (
                            <TableRow key={boleta.id}>
                                <TableCell className="font-mono text-red-600 font-bold">{boleta.consecutive}</TableCell>
                                <TableCell>{selectors.getAgreementName(boleta.agreement_id)}</TableCell>
                                <TableCell>{format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                                <TableCell>
                                    <Badge style={{ backgroundColor: statusConfig[boleta.status as keyof typeof statusConfig]?.color }} className="text-white">
                                        {statusConfig[boleta.status as keyof typeof statusConfig]?.label || 'Desconocido'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{boleta.erp_invoice_number}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => actions.boletaActions.openBoletaDetails(boleta.id)}>
                                                <FileText className="mr-2 h-4 w-4" /> Ver/Editar Detalles
                                            </DropdownMenuItem>
                                            {selectors.hasPermission('consignments:approve') &&
                                                <DropdownMenuItem onSelect={() => actions.boletaActions.openStatusModal(boleta, 'approved')} disabled={boleta.status !== 'pending'}>
                                                    <Check className="mr-2 h-4 w-4" /> Aprobar
                                                </DropdownMenuItem>
                                            }
                                            <DropdownMenuItem onSelect={() => actions.boletaActions.openStatusModal(boleta, 'sent')} disabled={boleta.status !== 'approved'}>
                                                <Truck className="mr-2 h-4 w-4" /> Marcar como Enviada
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => actions.boletaActions.openStatusModal(boleta, 'invoiced')} disabled={boleta.status !== 'sent'}>
                                                <FileCheck2 className="mr-2 h-4 w-4" /> Marcar como Facturada
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => actions.boletaActions.openStatusModal(boleta, 'canceled')} className="text-red-500">
                                                <Ban className="mr-2 h-4 w-4" /> Cancelar Boleta
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
