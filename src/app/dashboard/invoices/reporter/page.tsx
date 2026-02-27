/**
 * @fileoverview Page for the new Invoice Reporter module.
 * Allows users to upload XML invoices and export them to Excel.
 */
'use client';

import React from 'react';
import { useInvoiceReporter } from '@/modules/invoices/hooks/useInvoiceReporter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadCloud, Loader2, FileSpreadsheet, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isValid } from 'date-fns';

export default function InvoiceReporterPage() {
    const { state, actions, selectors } = useInvoiceReporter();

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <input
                type="file"
                ref={state.fileInputRef}
                onChange={actions.onFileSelected}
                className="hidden"
                accept=".xml"
                multiple
            />
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Reporteador de Facturas</CardTitle>
                        <CardDescription>Carga facturas XML para analizar, editar y exportar a Excel.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={actions.openFileDialog} disabled={state.isProcessing}>
                            {state.isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                            Cargar Facturas XML
                        </Button>
                        <Button onClick={actions.handleExport} disabled={state.lines.length === 0}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar a Excel
                        </Button>
                        <Button variant="destructive" onClick={actions.handleClear} disabled={state.lines.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" /> Limpiar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Facturas Procesadas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-48">
                                        {state.processedInvoices.length > 0 ? (
                                            <ul className="space-y-3 text-sm">
                                                {state.processedInvoices.map((invoice, index) => (
                                                    <li key={index} className="border-b pb-2">
                                                        <div className="flex items-center gap-2">
                                                            {invoice.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                                                            <div className="flex-1">
                                                                <p className="font-semibold truncate">{invoice.supplierName}</p>
                                                                <p className="text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
                                                            </div>
                                                        </div>
                                                        {invoice.status === 'error' && <p className="text-xs text-red-500 mt-1">{invoice.errorMessage}</p>}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-center text-muted-foreground h-full flex items-center justify-center">Aún no se han cargado facturas.</p>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Líneas de Factura</CardTitle>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox
                                            id="select-all-expenses"
                                            checked={selectors.areAllSelected}
                                            onCheckedChange={(checked) => actions.toggleAllExpenses(!!checked)}
                                        />
                                        <label htmlFor="select-all-expenses" className="text-sm font-medium">Marcar/desmarcar todos como gasto</label>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[60vh] border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">Gasto</TableHead>
                                                    <TableHead>Nº Factura</TableHead>
                                                    <TableHead>Proveedor</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Código</TableHead>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead className="text-right">Unit. s/IVA</TableHead>
                                                    <TableHead className="text-right">Unit. c/IVA</TableHead>
                                                    <TableHead className="text-right">Total s/IVA</TableHead>
                                                    <TableHead className="text-right">Total c/IVA</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {state.lines.length > 0 ? state.lines.map(line => (
                                                    <TableRow key={line.id}>
                                                        <TableCell><Checkbox checked={line.isExpense} onCheckedChange={(checked) => actions.toggleExpense(line.id, !!checked)} /></TableCell>
                                                        <TableCell>{line.invoiceNumber}</TableCell>
                                                        <TableCell>{line.supplierName}</TableCell>
                                                        <TableCell>{isValid(parseISO(line.issueDate)) ? format(parseISO(line.issueDate), 'dd/MM/yyyy') : 'Inválida'}</TableCell>
                                                        <TableCell><Input value={line.itemCode} onChange={e => actions.updateLine(line.id, { itemCode: e.target.value })} className="h-auto p-1 border-0" /></TableCell>
                                                        <TableCell><Input value={line.itemDescription} onChange={e => actions.updateLine(line.id, { itemDescription: e.target.value })} className="h-auto p-1 border-0" /></TableCell>
                                                        <TableCell className="text-right"><Input type="number" value={line.unitPrice} onChange={e => actions.updateLine(line.id, { unitPrice: Number(e.target.value) })} className="h-auto p-1 border-0 text-right" /></TableCell>
                                                        <TableCell className="text-right"><Input type="number" value={line.unitPriceWithTax} onChange={e => actions.updateLine(line.id, { unitPriceWithTax: Number(e.target.value) })} className="h-auto p-1 border-0 text-right" /></TableCell>
                                                        <TableCell className="text-right"><Input type="number" value={line.totalLine} onChange={e => actions.updateLine(line.id, { totalLine: Number(e.target.value) })} className="h-auto p-1 border-0 text-right" /></TableCell>
                                                        <TableCell className="text-right"><Input type="number" value={line.totalLineWithTax} onChange={e => actions.updateLine(line.id, { totalLineWithTax: Number(e.target.value) })} className="h-auto p-1 border-0 text-right" /></TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="h-48 text-center text-muted-foreground">
                                                            Carga uno o más archivos XML para empezar.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
