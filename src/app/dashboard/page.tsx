/**
 * @fileoverview The main dashboard page, which greets the user and displays available tools.
 * It also features the "Smart Suggestions" component.
 */
'use client';

import { mainTools } from "../../modules/core/lib/data";
import { ToolCard } from "../../components/dashboard/tool-card";
import { getCurrentUser } from "../../modules/core/lib/auth-client";
import { useEffect, useState } from "react";
import type { User, Tool } from "../../modules/core/types";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle } from "../../modules/core/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import { importAllDataFromFiles } from "@/modules/core/lib/db-client";


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
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTitle("Panel Principal");
    
    const initializeDashboard = async () => {
      const user = await getCurrentUser();
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
                <Button onClick={handleFullSync} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sincronizar Datos del ERP
                </Button>
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
