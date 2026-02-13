
/**
 * @fileoverview Main dashboard page for the Consignments module.
 * It displays a grid of available consignment management tools.
 */
'use client';

import { ToolCard } from "@/components/dashboard/tool-card";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { ListChecks, ClipboardCheck, Lock } from "lucide-react";
import type { Tool } from "@/modules/core/types";

export default function ConsignmentsDashboardPage() {
    const { setTitle } = usePageTitle();
    const { isAuthorized, hasPermission } = useAuthorization();
    const { isAuthReady } = useAuth();
    
    const consignmentsTools: Tool[] = [
        {
            id: "consignments:setup",
            name: "Acuerdos de Consignación",
            description: "Crear y gestionar los acuerdos de productos en consignación por cliente.",
            href: "/dashboard/consignments/agreements",
            icon: ListChecks,
            bgColor: "bg-teal-600",
        },
        {
            id: "consignments:count",
            name: "Toma de Inventario",
            description: "Realizar el conteo físico de productos en las instalaciones del cliente.",
            href: "/dashboard/consignments/inventory-count",
            icon: ClipboardCheck,
            bgColor: "bg-blue-600",
        },
        {
            id: "consignments:approve",
            name: "Gestión de Boletas",
            description: "Aprobar, imprimir y dar seguimiento a las boletas de reposición.",
            href: "/dashboard/consignments/boletas",
            icon: ListChecks,
            bgColor: "bg-orange-600",
        },
        {
            id: "consignments:locks:manage",
            name: "Bloqueos de Conteo",
            description: "Ver y liberar sesiones de conteo de consignación activas.",
            href: "/dashboard/consignments/locks",
            icon: Lock,
            bgColor: "bg-slate-500",
        }
    ];

    useEffect(() => {
        setTitle("Gestión de Consignaciones");
    }, [setTitle]);

    const visibleTools = useMemo(() => {
        if (!isAuthorized) return [];
        return consignmentsTools.filter(tool => hasPermission(tool.id));
    }, [isAuthorized, hasPermission]);

    if (!isAuthReady) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="grid gap-8">
                    <div>
                        <Skeleton className="h-8 w-80 mb-4" />
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </div>
                </div>
            </main>
        );
    }
    
    if (isAuthorized === false) {
        return null;
    }

    if (visibleTools.length === 0) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="text-center text-muted-foreground">
                    No tienes permiso para acceder a ninguna herramienta de consignaciones.
                </div>
            </main>
        );
    }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Consignación
            </h2>
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
