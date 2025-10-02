/**
 * @fileoverview The main dashboard page, which greets the user and displays available tools.
 * It also features the "Smart Suggestions" component.
 */
'use client';

import { mainTools } from "../../modules/core/lib/data";
import { ToolCard } from "../../components/dashboard/tool-card";
import { useEffect, useState } from "react";
import type { Tool } from "../../modules/core/types";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle } from "../../modules/core/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wrench, Clock, DollarSign, Send, MessageSquare } from "lucide-react";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import { importAllDataFromFiles } from "@/modules/core/lib/db";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { format, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addSuggestion } from "@/modules/core/lib/suggestions-actions";

/**
 * Renders the main dashboard page.
 * It fetches the current user's data to personalize the experience and filters tools
 * based on user permissions.
 */
export default function DashboardPage() {
  const { user, userRole, companyData, isLoading: isAuthLoading, refreshAuth, exchangeRateData, refreshExchangeRate, unreadSuggestionsCount } = useAuth();
  const [visibleTools, setVisibleTools] = useState<Tool[]>([]);
  const { setTitle } = usePageTitle();
  const { hasPermission } = useAuthorization(['admin:import:run']);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRateRefreshing, setIsRateRefreshing] = useState(false);
  const { toast } = useToast();
  const [isSyncOld, setIsSyncOld] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isSuggestionDialogOpen, setSuggestionDialogOpen] = useState(false);

  useEffect(() => {
    setTitle("Panel Principal");
    
    if (user && userRole) {
      let tools = [...mainTools];
      const hasAdminAccess = userRole.id === 'admin' || userRole.permissions?.some(p => p.startsWith('admin:'));

      if (hasAdminAccess) {
        tools.push({
          id: "admin",
          name: "Configuración",
          description: "Gestionar usuarios, roles y sistema.",
          href: "/dashboard/admin",
          icon: Wrench,
          bgColor: "bg-slate-600",
          textColor: "text-white",
        });
      }
      setVisibleTools(tools);
    }
  }, [setTitle, user, userRole]);

  useEffect(() => {
    if (companyData?.lastSyncTimestamp && companyData?.syncWarningHours) {
        const isOld = (new Date().getTime() - parseISO(companyData.lastSyncTimestamp).getTime()) > (companyData.syncWarningHours * 60 * 60 * 1000);
        setIsSyncOld(isOld);
    }
  }, [companyData]);

  const handleFullSync = async () => {
    setIsSyncing(true);
    toast({ title: "Iniciando Sincronización Completa", description: "Importando todos los datos desde el ERP..." });
    try {
        const results = await importAllDataFromFiles();
        toast({
            title: "Sincronización Completa Exitosa",
            description: `Se han procesado ${results.length} tipos de datos desde el ERP. Los datos se reflejarán automáticamente.`,
        });
        await logInfo("Full ERP data synchronization completed via dashboard button.", { results });
        // No need to call refreshAuth here, as it causes a full page flicker.
        // The useAuth hook will eventually get the new data on a full page reload, 
        // but for immediate use, individual modules' data is what matters.
    } catch (error: any) {
         toast({
            title: "Error en Sincronización",
            description: error.message,
            variant: "destructive"
        });
        await logError(`Error durante la sincronización completa desde el dashboard`, { error: error.message });
    } finally {
        setIsSyncing(false);
    }
  }

  const handleRateRefresh = async () => {
      setIsRateRefreshing(true);
      await refreshExchangeRate();
      toast({ title: "Tipo de Cambio Actualizado", description: "Se ha obtenido el valor más reciente de la API." });
      setIsRateRefreshing(false);
  }
  
  const handleSuggestionSubmit = async () => {
      if (!suggestion.trim() || !user) return;
      setIsSubmittingSuggestion(true);
      try {
          await addSuggestion(suggestion, user.id, user.name);
          toast({
              title: "¡Gracias por tu Sugerencia!",
              description: "Hemos recibido tu idea y la revisaremos pronto.",
          });
          setSuggestion("");
          setSuggestionDialogOpen(false);
      } catch (error: any) {
          toast({
              title: "Error al Enviar",
              description: `No se pudo enviar tu sugerencia: ${error.message}`,
              variant: "destructive"
          });
      } finally {
          setIsSubmittingSuggestion(false);
      }
  };

  if (isAuthLoading) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </main>
    )
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Todas las Herramientas
              </h2>
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                  {exchangeRateData.rate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-lg">
                        <DollarSign className="h-4 w-4"/>
                        <span>TC Venta: <strong>{exchangeRateData.rate.toLocaleString('es-CR')}</strong></span>
                        <span className="text-xs">({exchangeRateData.date})</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRateRefresh} disabled={isRateRefreshing}>
                           {isRateRefreshing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                        </Button>
                    </div>
                  )}
                  {hasPermission('admin:import:run') && (
                    <div className="flex items-center gap-2">
                        {companyData?.lastSyncTimestamp && (
                            <div className={cn(
                                "flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-lg", 
                                isSyncOld && "text-red-500 font-medium border-red-500/50 bg-red-50"
                            )}>
                                <Clock className="h-4 w-4" />
                                <span>Última Sinc: <strong>{format(parseISO(companyData.lastSyncTimestamp), 'dd/MM/yy HH:mm')}</strong></span>
                            </div>
                        )}
                        <Button onClick={handleFullSync} disabled={isSyncing}>
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Sincronizar ERP
                        </Button>
                    </div>
                  )}
                  <Dialog open={isSuggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
                        <DialogTrigger asChild>
                           <Button variant="default" className="bg-green-600 hover:bg-green-700">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Sugerencias y Mejoras
                           </Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>Buzón de Sugerencias y Mejoras</DialogTitle>
                                <DialogDescription>
                                    ¿Tienes una idea para mejorar la aplicación? ¿Encontraste algo que no funciona como esperabas? Déjanos tu sugerencia aquí.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-4">
                                <Label htmlFor="suggestion-box" className="sr-only">Tu sugerencia</Label>
                                <Textarea
                                    id="suggestion-box"
                                    placeholder="Describe tu idea o el problema que encontraste..."
                                    rows={4}
                                    value={suggestion}
                                    onChange={(e) => setSuggestion(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSuggestionSubmit} disabled={isSubmittingSuggestion || !suggestion.trim()}>
                                    {isSubmittingSuggestion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Enviar Sugerencia
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                  </Dialog>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.map((tool) => {
                const isAdminTool = tool.id === 'admin';
                const badgeCount = isAdminTool ? unreadSuggestionsCount : 0;
                return <ToolCard key={tool.id} tool={tool} badgeCount={badgeCount} />
              })}
            </div>
          </div>
        </div>

         {(isSyncing || isRateRefreshing) && (
            <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando...</span>
            </div>
        )}
      </main>
  );
}
