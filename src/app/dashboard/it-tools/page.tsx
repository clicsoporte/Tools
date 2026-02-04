/**
 * @fileoverview Main dashboard page for the IT Tools module.
 * It displays a grid of available IT management tools.
 */
'use client';

import { ToolCard } from "@/components/dashboard/tool-card";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { itTools } from "@/modules/core/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";

export default function ItToolsDashboardPage() {
    const { setTitle } = usePageTitle();
    const { isAuthorized, hasPermission } = useAuthorization();
    const { isAuthReady } = useAuth();

    useEffect(() => {
        setTitle("Herramientas de TI");
    }, [setTitle]);

    const visibleTools = useMemo(() => {
        if (!isAuthorized) return [];
        return itTools.filter(tool => hasPermission(tool.id));
    }, [isAuthorized, hasPermission]);

    if (!isAuthReady) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="grid gap-8">
                <div>
                    <h2 className="mb-4 text-2xl font-bold tracking-tight">
                        <Skeleton className="h-8 w-96" />
                    </h2>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Tecnologías de la Información
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.length > 0 ? visibleTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              )) : (
                <p className="text-muted-foreground col-span-full">No tienes permiso para ver ninguna herramienta de TI.</p>
              )}
            </div>
          </div>
        </div>
      </main>
  );
}
