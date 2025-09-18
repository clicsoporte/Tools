/**
 * @fileoverview The main dashboard page, which greets the user and displays available tools.
 * It also features the "Smart Suggestions" component.
 */
'use client';

import { mainTools } from "../../modules/core/lib/data";
import { ToolCard } from "../../components/dashboard/tool-card";
import { useEffect, useState } from "react";
import type { User, Tool, Company } from "../../modules/core/types";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle } from "../../modules/core/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wrench, Clock } from "lucide-react";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import { importAllDataFromFiles, saveCompanySettings } from "@/modules/core/lib/db";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { format, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";

/**
 * Renders the main dashboard page.
 * It fetches the current user's data to personalize the experience and filters tools
 * based on user permissions.
 */
export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [visibleTools, setVisibleTools] = useState<Tool[]>([]);
  const { setTitle } = usePageTitle();
  const { hasPermission } = useAuthorization(['admin:import:run']);
  const { companyData, refreshAuth } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTitle("Panel Principal");
    
    const initializeDashboard = async () => {
      const { user } = useAuth.getState();
      setCurrentUser(user);
      if (user) {
        // Start with the main tools
        let tools = [...mainTools];
        
        // Add the admin tool if the user is an admin
        if (user.role === 'admin') {
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
    };

    initializeDashboard();
  }, [setTitle]);

  const handleFullSync = async () => {
    setIsSyncing(true);
    toast({ title: "Iniciando Sincronización Completa", description: "Importando todos los datos desde el ERP..." });
    try {
        const results = await importAllDataFromFiles();
        
        if (companyData) {
            const newCompanyData = { ...companyData, lastSyncTimestamp: new Date().toISOString() };
            await saveCompanySettings(newCompanyData);
            await refreshAuth(); // Refresh the auth context to get the new timestamp
        }

        toast({
            title: "Sincronización Completa Exitosa",
            description: `Se han procesado ${results.length} tipos de datos desde el ERP.`,
        });
        await logInfo("Full ERP data synchronization completed via dashboard button.", { results });
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

  // Display a skeleton loader while the user data is being fetched.
  if (!currentUser) {
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Todas las Herramientas
              </h2>
              {hasPermission('admin:import:run') && (
                <div className="flex items-center gap-2">
                    {companyData?.lastSyncTimestamp && (
                        <span className={cn(
                            "text-xs text-muted-foreground", 
                            (new Date().getTime() - new Date(companyData.lastSyncTimestamp).getTime()) > 12 * 60 * 60 * 1000 && "text-red-500 font-medium"
                        )}>
                            <Clock className="inline h-3 w-3 mr-1" />
                            Última Sinc: {format(new Date(companyData.lastSyncTimestamp), 'dd/MM/yy HH:mm')}
                        </span>
                    )}
                    <Button onClick={handleFullSync} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sincronizar Datos del ERP
                    </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        </div>
      </main>
  );
}
