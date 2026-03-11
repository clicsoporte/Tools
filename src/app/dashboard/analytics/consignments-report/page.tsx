
'use client';

import React from 'react';
import { useConsignmentsReport, type ConsignmentsReportSortKey } from '@/modules/analytics/hooks/useConsignmentsReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarIcon, Search, FileDown, FileSpreadsheet, AlertTriangle, ArrowUp, ArrowDown, FilterX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DialogColumnSelector } from '@/components/ui/dialog-column-selector';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';

export default function ConsignmentsReportPage() {
    const { state, actions, selectors, isAuthorized } = useConsignmentsReport();
    const { isLoading, hasRun, dateRange, agreements, selectedAgreementId, reportData, processedBoletas, sortKey, sortDirection, visibleColumns, boletaFilter, closureFilter } = state;

    if (!isAuthorized) return null;

    const renderSortIcon = (key: ConsignmentsReportSortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
             <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300">
                <AlertTriangle className="h-4 w-4 !text-blue-600" />
                <AlertTitle>Modo de Análisis Flexible</AlertTitle>
                <AlertDescription>
                    Este reporte permite un análisis flexible de las consignaciones por mes. Para la <strong>facturación oficial</strong>, por favor utiliza la herramienta <strong>&quot;Gestión de Cierres&quot;</strong> en el módulo de Consignaciones.
                </AlertDescription>
            </Alert>
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Reporte de Cierre de Consignaciones (Analítico)</CardTitle>
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
                        <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Selecciona un cliente..." /></SelectTrigger>
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
                            <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:min-w-[260px] justify-start text-left font-normal", (!dateRange?.from || closureFilter) && "text-muted-foreground")} disabled={!!closureFilter}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, "LLL dd, y", { locale: es })} - ${format(dateRange.to, "LLL dd, y", { locale: es })}`) : format(dateRange.from, "LLL dd, y", { locale: es })) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={actions.setDateRange} numberOfMonths={2} locale={es} /></PopoverContent>
                    </Popover>
                     <Select value={closureFilter || 'none'} onValueChange={actions.setClosureFilter} disabled={!selectedAgreementId}>
                        <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="O filtrar por Cierre de Periodo..." /></SelectTrigger>
                        <SelectContent>
                             <SelectItem value="none">-- Sin Filtro por Cierre --</SelectItem>
                            {selectors.closureOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <MultiSelectFilter
                        title="Filtrar por Boleta(s)"
                        options={selectors.boletaOptions}
                        selectedValues={boletaFilter}
                        onSelectedChange={actions.setBoletaFilter}
                        disabled={!selectedAgreementId}
                    />
                     <Button variant="ghost" onClick={actions.handleClearFilters}>
                        <FilterX className="mr-2 h-4 w-4" />
                        Limpiar Filtros
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Resultados del Cierre</CardTitle>
                         <div className="flex items-center gap-2">
                            <DialogColumnSelector
                                allColumns={selectors.availableColumns}
                                visibleColumns={visibleColumns}
                                onColumnChange={actions.handleColumnVisibilityChange}
                                onSave={actions.savePreferences}
                            />
                            <Button variant="outline" onClick={actions.handleExportPDF} disabled={isLoading || reportData.length === 0}><FileDown className="mr-2"/>Exportar PDF</Button>
                            <Button variant="outline" onClick={actions.handleExportExcel} disabled={isLoading || reportData.length === 0}><FileSpreadsheet className="mr-2"/>Exportar Excel</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {processedBoletas.length > 0 && (
                        <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-semibold mb-2">Boletas Incluidas en este Reporte</h4>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                {processedBoletas.map(boleta => (
                                    <li key={boleta.id}>
                                        <strong>{boleta.consecutive}</strong>
                                        {boleta.status === 'invoiced' && boleta.erp_invoice_number && <span className="text-red-600 font-semibold">{` (Factura: ${boleta.erp_invoice_number})`}</span>}
                                        {boleta.approved_by && ` - Aprobada por: ${boleta.approved_by}`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {selectors.visibleColumnsData.map(col => (
                                        <TableHead 
                                            key={col.id} 
                                            className={cn(col.sortable && "cursor-pointer hover:bg-muted", col.align === 'right' && 'text-right')}
                                            onClick={() => col.sortable && actions.handleSort(col.id as ConsignmentsReportSortKey)}
                                        >
                                            <div className={cn("flex items-center", col.align === 'right' && 'justify-end')}>
                                                {col.label} {col.sortable && renderSortIcon(col.id as ConsignmentsReportSortKey)}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                     <TableRow><TableCell colSpan={selectors.availableColumns.length} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : !hasRun ? (
                                    <TableRow><TableCell colSpan={selectors.availableColumns.length} className="h-32 text-center text-muted-foreground">Selecciona un cliente y un rango de fechas y haz clic en &quot;Generar Reporte&quot;.</TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row.productId}>
                                            {selectors.visibleColumnsData.map(col => {
                                                const content = selectors.getColumnContent(row, col.id);
                                                return <TableCell key={col.id} className={cn(col.align === 'right' && 'text-right', content.className)}>{content.content}</TableCell>
                                            })}
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow><TableCell colSpan={selectors.availableColumns.length} className="h-32 text-center text-muted-foreground">No se encontraron datos de consumo para el período seleccionado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </main>
    );
}
