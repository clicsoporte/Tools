/**
 * @fileoverview The main dashboard page for the analytics section.
 * It displays a grid of available analysis and reporting tools.
 */
'use client';

import { ToolCard } from "@/components/dashboard/tool-card";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { analyticsTools } from "@/modules/core/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";

export default function AnalyticsDashboardPage() {
    const { setTitle } = usePageTitle();
    const { isAuthorized, hasPermission } = useAuthorization(['analytics:read']);
    const { isAuthReady } = useAuth();

    useEffect(() => {
        setTitle("Analíticas y Reportes");
    }, [setTitle]);

    const visibleTools = useMemo(() => {
        if (!isAuthorized) return [];
        // Filter tools based on specific sub-permissions for analytics
        const permittedTools = analyticsTools.filter(tool => hasPermission(tool.id));
        return permittedTools.sort((a, b) => a.name.localeCompare(b.name));
        
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

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Análisis
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
    
