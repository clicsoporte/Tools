/**
 * @fileoverview Page for the Item Assignments Report.
 * Displays a filterable and sortable list of all product-client-location assignments.
 */
'use client';

import React from 'react';
import { useItemAssignmentsReport } from '@/modules/analytics/hooks/useItemAssignmentsReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, FileDown, FileSpreadsheet, Search, FilterX, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function ItemAssignmentsReportPage() {
    const {
        state,
        actions,
        selectors,
        isAuthorized,
        isInitialLoading,
    } = useItemAssignmentsReport();

    const { isLoading, searchTerm, sortKey, sortDirection, typeFilter, classificationFilter } = state;
    const { filteredData } = selectors;

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
    
    const renderSortIcon = (key: typeof sortKey) => {
        if (sortKey !== key) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Reporte de Catálogo de Clientes por Producto</CardTitle>
                    <CardDescription>
                        Audita qué productos están asignados a qué clientes, sus ubicaciones y si son de venta general o exclusiva.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por producto, cliente o ubicación..." 
                            value={searchTerm} 
                            onChange={(e) => actions.setSearchTerm(e.target.value)} 
                            className="pl-8 w-full"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={(value) => actions.setTypeFilter(value as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="exclusive">Solo Exclusivas</SelectItem>
                            <SelectItem value="general">Solo Generales</SelectItem>
                            <SelectItem value="unassigned">Sin Cliente</SelectItem>
                        </SelectContent>
                    </Select>
                     <MultiSelectFilter
                        title="Clasificación"
                        options={selectors.classifications.map(c => ({ value: c, label: c }))}
                        selectedValues={classificationFilter}
                        onSelectedChange={actions.setClassificationFilter}
                    />
                     <Button variant="ghost" onClick={actions.handleClearFilters}>
                        <FilterX className="mr-2 h-4 w-4" />
                        Limpiar
                    </Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Listado de Asignaciones ({filteredData.length})</CardTitle>
                         <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={actions.handleExportPDF} disabled={isLoading || filteredData.length === 0}><FileDown className="mr-2"/>Exportar PDF</Button>
                            <Button variant="outline" onClick={actions.handleExportExcel} disabled={isLoading || filteredData.length === 0}><FileSpreadsheet className="mr-2"/>Exportar Excel</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSort('product')}>
                                        <div className="flex items-center gap-2">Producto {renderSortIcon('product')}</div>
                                    </TableHead>
                                     <TableHead className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSort('client')}>
                                        <div className="flex items-center gap-2">Cliente {renderSortIcon('client')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSort('location')}>
                                        <div className="flex items-center gap-2">Ubicación {renderSortIcon('location')}</div>
                                    </TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted" onClick={() => actions.handleSort('updatedAt')}>
                                        <div className="flex items-center gap-2">Actualizado {renderSortIcon('updatedAt')}</div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredData.length > 0 ? (
                                    filteredData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                <p>{item.productName}</p>
                                                <p className="text-xs text-muted-foreground">{item.itemId}</p>
                                            </TableCell>
                                            <TableCell>{item.clientName || <span className="text-muted-foreground italic">Venta General</span>}</TableCell>
                                            <TableCell className="text-sm">{item.locationPath}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.isExclusive ? "destructive" : "secondary"}>
                                                    {item.isExclusive ? 'Exclusivo' : 'General'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                <p>{item.updatedBy}</p>
                                                <p>{item.updatedAt ? format(parseISO(item.updatedAt), 'dd/MM/yy HH:mm') : 'N/A'}</p>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            No se encontraron asignaciones para los filtros seleccionados.
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
