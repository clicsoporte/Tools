/**
 * @fileoverview Page for the new Warehouse Occupancy Report.
 */
'use client';

import React from 'react';
import { useOccupancyReport, type SortKey, type OccupancyReportRow } from '@/modules/analytics/hooks/useOccupancyReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, Search, FilterX, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DialogColumnSelector } from '@/components/ui/dialog-column-selector';
import { Info } from 'lucide-react';

// This new component handles rendering the tooltip for mixed items.
const ItemsTooltipContent = ({ items }: { items: OccupancyReportRow['items'] }) => {
    return (
        <div className="p-2">
            <p className="font-bold mb-2">Artículos en esta ubicación:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
                {items.map((item: OccupancyReportRow['items'][0]) => (
                    <li key={item.productId}>
                        <span className="font-semibold">{item.productDescription}</span>
                        <span className="text-muted-foreground"> ({item.productId})</span>
                        {item.quantity !== undefined && <span className="font-bold ml-2">Cant: {item.quantity}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
};


export default function OccupancyReportPage() {
    const {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    } = useOccupancyReport();

    const { isLoading, searchTerm, sortKey, sortDirection, statusFilter, classificationFilter, clientFilter, rowsPerPage, currentPage, visibleColumns, hasRun } = state;
    const { paginatedData, classifications, clients } = selectors;

    if (isInitialLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader><Skeleton className="h-8 w-64" /><Skeleton className="h-5 w-96 mt-2" /></CardHeader>
                    <CardContent className="space-y-4"><Skeleton className="h-10 w-full max-w-sm" /><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
            </main>
        );
    }
    
    if (isAuthorized === false) return null;
    
    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Reporte de Ocupación de Almacén</CardTitle>
                            <CardDescription>
                                Visualiza el estado de cada ubicación final (Libre, Ocupado, Mixto) y su contenido.
                            </CardDescription>
                        </div>
                        <Button onClick={actions.fetchData} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Generar Reporte
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                     <div className="flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar por ubicación, producto, cliente..." 
                                value={searchTerm} 
                                onChange={(e) => actions.setSearchTerm(e.target.value)} 
                                className="pl-8 w-full"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => actions.setStatusFilter(value as any)}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Estados</SelectItem>
                                <SelectItem value="Libre">Solo Libres</SelectItem>
                                <SelectItem value="Ocupado">Solo Ocupados</SelectItem>
                                <SelectItem value="Mixto">Solo Mixtos</SelectItem>
                            </SelectContent>
                        </Select>
                         <MultiSelectFilter
                            title="Clasificación"
                            options={classifications.map((c: string) => ({ value: c, label: c }))}
                            selectedValues={classificationFilter}
                            onSelectedChange={actions.setClassificationFilter}
                        />
                         <MultiSelectFilter
                            title="Cliente"
                            options={clients.map((c: { id: string, name: string }) => ({ value: String(c.id), label: c.name }))}
                            selectedValues={clientFilter}
                            onSelectedChange={actions.setClientFilter}
                        />
                         <Button variant="ghost" onClick={actions.handleClearFilters}>
                            <FilterX className="mr-2 h-4 w-4" />
                            Limpiar
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Listado de Ubicaciones ({selectors.filteredData.length})</CardTitle>
                         <div className="flex items-center gap-2">
                             <DialogColumnSelector
                                allColumns={selectors.availableColumns}
                                visibleColumns={visibleColumns}
                                onColumnChange={actions.handleColumnVisibilityChange}
                                onSave={actions.savePreferences}
                            />
                            <Button variant="outline" onClick={actions.handleExportExcel} disabled={isLoading || paginatedData.length === 0}><FileSpreadsheet className="mr-2"/>Exportar Excel</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh] border rounded-md">
                         <TooltipProvider>
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        {selectors.visibleColumnsData.map((col) => (
                                            <TableHead key={col.id} className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSort(col.id as SortKey)}>
                                                <div className="flex items-center gap-2">{col.label} {renderSortIcon(col.id as SortKey)}</div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: rowsPerPage }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={visibleColumns.length}><Skeleton className="h-8 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : !hasRun ? (
                                        <TableRow>
                                            <TableCell colSpan={visibleColumns.length} className="h-32 text-center">
                                                Ajusta los filtros y haz clic en &quot;Generar Reporte&quot; para empezar.
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedData.length > 0 ? (
                                        paginatedData.map((item: OccupancyReportRow) => (
                                            <TableRow key={item.locationId}>
                                                {selectors.visibleColumnsData.map((col) => {
                                                     const { content, className } = selectors.renderCellContent(item, col.id);
                                                    return (
                                                        <TableCell key={col.id} className={className}>
                                                            {col.id === 'items' && item.status === 'Mixto' ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <ItemsTooltipContent items={item.items} />
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                content
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={visibleColumns.length} className="h-32 text-center">
                                                No se encontraron ubicaciones con los filtros aplicados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                         </TooltipProvider>
                    </ScrollArea>
                </CardContent>
                 <CardFooter className="flex w-full items-center justify-end pt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="rows-per-page">Filas por página:</Label>
                            <Select value={String(rowsPerPage)} onValueChange={(value) => actions.setRowsPerPage(Number(value))}>
                                <SelectTrigger id="rows-per-page" className="w-20"><SelectValue /></SelectTrigger>
                                <SelectContent>{[10, 25, 50, 100].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <span className="text-sm text-muted-foreground">Página {currentPage + 1} de {selectors.totalPages}</span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage(currentPage - 1)} disabled={currentPage === 0}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.setCurrentPage(currentPage + 1)} disabled={currentPage >= selectors.totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </main>
    );
}
