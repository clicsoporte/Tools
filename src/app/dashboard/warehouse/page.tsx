/**
 * @fileoverview The main dashboard page for the warehouse section.
 * It displays a grid of available warehouse management tools.
 */
'use client';

import { ToolCard } from "@/components/dashboard/tool-card";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { warehouseTools } from "@/modules/core/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";

export default function WarehouseDashboardPage() {
    const { setTitle } = usePageTitle();
    // Get authorization status and permission checker for the main warehouse module
    const { isAuthorized, hasPermission } = useAuthorization(['warehouse:access']);
    const { isAuthReady } = useAuth();

    useEffect(() => {
        setTitle("Almacén");
    }, [setTitle]);

    const visibleTools = useMemo(() => {
        if (!isAuthorized) return [];
        // Filter tools based on specific sub-permissions for warehouse
        return warehouseTools.filter(tool => hasPermission(tool.id));
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
    
    if (!isAuthorized) {
        return null;
    }

    if (visibleTools.length === 0) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="text-center text-muted-foreground">
                    No tienes permiso para acceder a ninguna herramienta de almacén.
                </div>
            </main>
        );
    }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Almacén
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
