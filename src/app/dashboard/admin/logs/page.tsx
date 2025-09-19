
"use client";

import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { getLogs, clearLogs, logWarn } from "../../../../modules/core/lib/logger";
import type { LogEntry } from "../../../../modules/core/types";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";

export default function LogViewerPage() {
  useAuthorization(['admin:logs:read', 'admin:logs:clear']);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const { setTitle } = usePageTitle();

  const fetchLogs = async () => {
    const fetchedLogs = await getLogs();
    setLogs(fetchedLogs);
  };

  useEffect(() => {
    setTitle("Visor de Eventos");
    fetchLogs();
    setMounted(true);
  }, [setTitle]);

  const handleClearLogs = async () => {
    await logWarn("System logs cleared by an administrator.");
    await clearLogs();
    await fetchLogs();
  };

  const getBadgeVariant = (type: LogEntry['type']) => {
    switch (type) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      default: return 'outline';
    }
  };
  
  if (!mounted) {
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
                <Button variant="outline" onClick={fetchLogs} className="flex-1 sm:flex-initial">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refrescar
                </Button>
                <Button variant="destructive" onClick={handleClearLogs} className="flex-1 sm:flex-initial">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpiar Registros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.timestamp ? format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(log.type)}>{log.type}</Badge>
                        </TableCell>
                        <TableCell>
                            {log.message}
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
                        No hay registros para mostrar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
  );
}
