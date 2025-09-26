

"use client";

import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { getLogs, clearLogs, logWarn } from "../../../../modules/core/lib/logger";
import type { LogEntry, DateRange } from "../../../../modules/core/types";
import { RefreshCw, Trash2, Calendar as CalendarIcon, FilterX, Download } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useDebounce } from "use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";

type LogTypeFilter = 'operational' | 'system' | 'all';

export default function LogViewerPage() {
  const { isAuthorized, hasPermission } = useAuthorization(['admin:logs:read']);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { setTitle } = usePageTitle();
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('operational');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

  const fetchLogs = async () => {
    setIsLoading(true);
    const fetchedLogs = await getLogs({
        type: logTypeFilter,
        search: debouncedSearchTerm,
        dateRange: dateFilter
    });
    setLogs(fetchedLogs);
    setIsLoading(false);
  };

  useEffect(() => {
    setTitle("Visor de Eventos");
    if (isAuthorized) {
        fetchLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTitle, isAuthorized, logTypeFilter, debouncedSearchTerm, dateFilter]);

  const handleClearLogs = async () => {
    await logWarn("System logs cleared by an administrator.");
    await clearLogs();
    await fetchLogs();
  };
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setDateFilter({ from: new Date(), to: new Date() });
    setLogTypeFilter('operational');
  };

  const handleDownloadLogs = () => {
    const logContent = logs
      .map(log => {
        const detailsString = log.details ? `\nDETAILS: ${JSON.stringify(log.details, null, 2)}` : '';
        return `[${log.type}] ${format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: es })} - ${log.message}${detailsString}`;
      })
      .join('\n\n' + '-'.repeat(80) + '\n\n');
    
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getBadgeVariant = (type: LogEntry['type']) => {
    switch (type) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      default: return 'outline';
    }
  };
  
  if (!isAuthorized) {
    return null; // or a skeleton loader
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Registros del Sistema</CardTitle>
                <CardDescription>
                  Eventos, advertencias y errores registrados en la aplicación.
                </CardDescription>
              </div>
               <div className="flex w-full sm:w-auto gap-2">
                <Button variant="outline" onClick={fetchLogs} className="flex-1 sm:flex-initial" disabled={isLoading}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                  Refrescar
                </Button>
                {hasPermission('admin:logs:clear') && (
                    <Button variant="destructive" onClick={handleClearLogs} className="flex-1 sm:flex-initial">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpiar
                    </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex flex-col gap-4">
                <Tabs value={logTypeFilter} onValueChange={(value) => setLogTypeFilter(value as LogTypeFilter)}>
                    <TabsList className="flex flex-wrap md:grid md:grid-cols-3 w-full">
                        <TabsTrigger value="operational">Operativo</TabsTrigger>
                        <TabsTrigger value="system">Sistema</TabsTrigger>
                        <TabsTrigger value="all">Todos</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex flex-col md:flex-row flex-wrap gap-4">
                    <Input 
                        placeholder="Buscar por mensaje o detalles..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full md:w-[300px] justify-start text-left font-normal",
                                !dateFilter && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateFilter?.from ? (
                                dateFilter.to ? (
                                    <>
                                    {format(dateFilter.from, "LLL dd, y", { locale: es })} -{" "}
                                    {format(dateFilter.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(dateFilter.from, "LLL dd, y", { locale: es })
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
                                defaultMonth={dateFilter?.from}
                                selected={dateFilter}
                                onSelect={setDateFilter}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={handleDownloadLogs} disabled={logs.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                    </Button>
                    <Button variant="ghost" onClick={handleClearFilters}>
                        <FilterX className="mr-2 h-4 w-4" />
                        Limpiar Filtros
                    </Button>
                </div>
            </div>
            <ScrollArea className="h-[60vh] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                           Cargando registros...
                        </TableCell>
                    </TableRow>
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.timestamp ? format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(log.type)}>{log.type}</Badge>
                        </TableCell>
                        <TableCell>
                            <span className="font-medium">{log.message}</span>
                            {log.details && (
                                <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded-md overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No hay registros para mostrar con los filtros actuales.
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
