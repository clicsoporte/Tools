/**
 * @fileoverview Page for proactive purchase suggestions.
 * It analyzes ERP orders within a date range, compares them against current
 * inventory, and suggests items that need to be purchased, grouping them by item ID.
 */
'use client';

import React from 'react';
import { useRequestSuggestions } from '@/modules/requests/hooks/useRequestSuggestions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, CalendarIcon, FilePlus, Layers, AlertCircle, ShoppingCart, FilterX, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RequestSuggestionsPage() {
    const {
        state,
        actions,
        selectors,
    } = useRequestSuggestions();

    const { isLoading, dateRange, suggestions, selectedItems, isSubmitting, searchTerm, classificationFilter } = state;

    if (isLoading && suggestions.length === 0) {
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

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <Layers className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Sugerencias de Compra Proactivas</h1>
                        <p className="text-muted-foreground">Analiza los pedidos del ERP con faltantes de inventario y genera solicitudes.</p>
                    </div>
                </div>
                 <Button asChild variant="outline">
                    <Link href="/dashboard/requests">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Volver a Solicitudes
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Filtros de Análisis</CardTitle>
                            <CardDescription>Selecciona los filtros para analizar los pedidos del ERP.</CardDescription>
                        </div>
                        <Button onClick={actions.handleAnalyze} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Analizar Pedidos
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full md:w-[300px] justify-start text-left font-normal",
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
                    <div className="relative flex-1 md:grow-0">
                         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por código o descripción..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="pl-8 w-full md:w-[300px]" />
                    </div>
                    <Select value={classificationFilter} onValueChange={actions.setClassificationFilter}>
                        <SelectTrigger className="w-full md:w-[240px]"><SelectValue placeholder="Filtrar por clasificación..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las Clasificaciones</SelectItem>
                            {selectors.classifications.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Button variant="ghost" onClick={actions.handleClearFilters}><FilterX className="mr-2 h-4 w-4" />Limpiar</Button>
                </CardContent>
            </Card>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Artículos con Faltantes ({selectors.filteredSuggestions.length})</CardTitle>
                    <CardDescription>
                        Esta es una lista consolidada de todos los artículos necesarios para cumplir con los pedidos seleccionados, que no tienen suficiente stock.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[50vh] border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-12">
                                         <Checkbox
                                            checked={selectors.areAllSelected}
                                            onCheckedChange={actions.toggleSelectAll}
                                            disabled={selectors.filteredSuggestions.length === 0}
                                        />
                                    </TableHead>
                                    <TableHead>Artículo</TableHead>
                                    <TableHead>Clientes Involucrados</TableHead>
                                    <TableHead>Última Fecha Entrega</TableHead>
                                    <TableHead className="text-right">Cant. Requerida</TableHead>
                                    <TableHead className="text-right">Inv. Actual (ERP)</TableHead>
                                    <TableHead className="text-right">Faltante Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : selectors.filteredSuggestions.length > 0 ? (
                                    selectors.filteredSuggestions.map(item => (
                                        <TableRow key={item.itemId}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedItems.has(item.itemId)}
                                                    onCheckedChange={() => actions.toggleItemSelection(item.itemId)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium">{item.itemDescription}</p>
                                                <p className="text-sm text-muted-foreground">{item.itemId}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-xs text-muted-foreground truncate max-w-xs" title={item.involvedClients.map(c => `${c.name} (${c.id})`).join(', ')}>
                                                    {item.involvedClients.map(c => c.name).join(', ')}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                {item.latestDueDate ? format(new Date(item.latestDueDate), 'dd/MM/yyyy') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">{item.totalRequired.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{item.currentStock.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-red-600">{item.shortage.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                                <p className="text-muted-foreground">No se encontraron faltantes para los filtros seleccionados.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                    <Button onClick={actions.handleCreateRequests} disabled={isSubmitting || selectors.selectedSuggestions.length === 0}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <FilePlus className="mr-2 h-4 w-4" />
                        Crear {selectors.selectedSuggestions.length > 0 ? `${selectors.selectedSuggestions.length} Solicitud(es)` : 'Solicitudes'}
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
