
/**
 * @fileoverview Page for the new Consignments Report.
 */
'use client';

import React from 'react';
import { useConsignmentsReport } from '@/modules/analytics/hooks/useConsignmentsReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarIcon, Search, FileDown, FileSpreadsheet } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ConsignmentsReportPage() {
    const { state, actions, selectors, isAuthorized } = useConsignmentsReport();
    const { isLoading, hasRun, dateRange, agreements, selectedAgreementId, reportData } = state;

    if (!isAuthorized) return null;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Reporte de Cierre de Consignaciones</CardTitle>
                            <CardDescription>Genera el reporte de consumo mensual para un cliente de consignación específico.</CardDescription>
                        </div>
                        <Button onClick={actions.handleGenerateReport} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Generar Reporte
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4 items-center">
                    <Select value={selectedAgreementId || ''} onValueChange={actions.setSelectedAgreementId}>
                        <SelectTrigger className="w-full sm:w-[300px]"><SelectValue placeholder="Selecciona un cliente..." /></SelectTrigger>
                        <SelectContent>
                            {agreements.map((agreement) => (
                                <SelectItem key={agreement.id} value={String(agreement.id)}>
                                    {agreement.client_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:min-w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, "LLL dd, y", { locale: es })} - ${format(dateRange.to, "LLL dd, y", { locale: es })}`) : format(dateRange.from, "LLL dd, y", { locale: es })) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={actions.setDateRange} numberOfMonths={2} locale={es} /></PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Resultados del Cierre</CardTitle>
                         <div className="flex items-center gap-2">
                            <Button variant="outline" disabled={isLoading || reportData.length === 0}><FileDown className="mr-2"/>Exportar PDF</Button>
                            <Button variant="outline" disabled={isLoading || reportData.length === 0}><FileSpreadsheet className="mr-2"/>Exportar Excel</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Inv. Inicial</TableHead>
                                    <TableHead className="text-right">Total Repuesto</TableHead>
                                    <TableHead className="text-right">Inv. Final</TableHead>
                                    <TableHead className="text-right font-bold">Consumo</TableHead>
                                    <TableHead className="text-right">Precio Unit.</TableHead>
                                    <TableHead className="text-right font-bold">Valor Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                     <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : !hasRun ? (
                                    <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Selecciona un cliente y un rango de fechas y haz clic en &quot;Generar Reporte&quot;.</TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row.productId}>
                                            <TableCell>
                                                <p className="font-medium">{row.productDescription}</p>
                                                <p className="text-xs text-muted-foreground">{row.productId}</p>
                                            </TableCell>
                                            <TableCell className="text-right">{row.initialStock.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-blue-600">{row.totalReplenished.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{row.finalStock.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-lg">{row.consumption.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{row.price.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</TableCell>
                                            <TableCell className="text-right font-bold text-primary text-lg">{row.totalValue.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No se encontraron datos de consumo para el período seleccionado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </main>
    );
}
