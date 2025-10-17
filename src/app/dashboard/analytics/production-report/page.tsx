/**
 * @fileoverview Page for production reporting and analysis.
 * It allows users to filter completed production orders by a date range and
 * view summarized totals and detailed breakdowns of production performance.
 */
'use client';

import React from 'react';
import { useProductionReport } from '@/modules/analytics/hooks/useProductionReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarIcon, Search, FileDown, FileSpreadsheet, Package, PackageCheck, AlertCircle, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ProductionReportPage() {
    const {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    } = useProductionReport();

    const { isLoading, dateRange, reportData } = state;
    const { totals, details } = reportData;

    if (isInitialLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-5 w-96 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full max-w-sm" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </main>
        );
    }
    
    if (isAuthorized === false) {
        return null;
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Reporte de Producción</CardTitle>
                            <CardDescription>Analiza el rendimiento de las órdenes de producción completadas en un rango de fechas.</CardDescription>
                        </div>
                        <Button onClick={actions.handleAnalyze} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Generar Reporte
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full sm:w-auto sm:min-w-[260px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                    {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                    {format(dateRange.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y", { locale: es })
                                )
                                ) : (
                                <span>Seleccionar fecha</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={actions.setDateRange}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Producido (Bruto)</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totals.totalDelivered.toLocaleString('es-CR')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Defectuoso</CardTitle>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{totals.totalDefective.toLocaleString('es-CR')}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Neto Producido</CardTitle>
                        <PackageCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{totals.totalNet.toLocaleString('es-CR')}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Solicitado</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totals.totalRequested.toLocaleString('es-CR')}</div></CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Detalle de Órdenes</CardTitle>
                         <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={actions.handleExportPDF} disabled={isLoading || details.length === 0}><FileDown className="mr-2"/>Exportar PDF</Button>
                            <Button variant="outline" onClick={actions.handleExportExcel} disabled={isLoading || details.length === 0}><FileSpreadsheet className="mr-2"/>Exportar Excel</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[50vh] border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead>OP</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Solicitado</TableHead>
                                    <TableHead className="text-right">Producido</TableHead>
                                    <TableHead className="text-right">Defectuoso</TableHead>
                                    <TableHead className="text-right">Diferencia Neta</TableHead>
                                    <TableHead>Fecha Completada</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : details.length > 0 ? (
                                    details.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.consecutive}</TableCell>
                                            <TableCell>{item.customerName}</TableCell>
                                            <TableCell>
                                                <p className="font-medium">{item.productDescription}</p>
                                                <p className="text-xs text-muted-foreground">{item.productId}</p>
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity.toLocaleString('es-CR')}</TableCell>
                                            <TableCell className="text-right">{(item.deliveredQuantity ?? 0).toLocaleString('es-CR')}</TableCell>
                                            <TableCell className="text-right text-red-600">{(item.defectiveQuantity ?? 0).toLocaleString('es-CR')}</TableCell>
                                            <TableCell className={cn("text-right font-bold", selectors.getNetDifference(item) < 0 ? 'text-destructive' : 'text-green-600')}>
                                                {selectors.getNetDifference(item).toLocaleString('es-CR')}
                                            </TableCell>
                                            <TableCell>{item.completionDate ? format(parseISO(item.completionDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            No se encontraron datos de producción para el rango de fechas seleccionado.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </main>
    );
}
