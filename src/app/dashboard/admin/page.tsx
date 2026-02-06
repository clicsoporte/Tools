/**
 * @fileoverview The main dashboard page for the admin section.
 * It dynamically displays a grid of available administration tools.
 */
'use client';

import { adminTools } from "@/modules/core/lib/data";
import { ToolCard } from "@/components/dashboard/tool-card";
import { useEffect, useMemo } from "react";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";

export default function AdminDashboardPage() {
    const { setTitle } = usePageTitle();
    // The hook now directly gives us the hasPermission function and loading state.
    const { hasPermission, isAuthorized, isLoading } = useAuthorization(['admin:access']);
    const { unreadSuggestionsCount } = useAuth();

    useEffect(() => {
        setTitle("Configuración");
    }, [setTitle]);
    
    // Filter the tools based on the user's granular permissions.
    const visibleTools = useMemo(() => {
        if (!isAuthorized) return [];
        return adminTools.filter(tool => hasPermission(tool.id));
    }, [isAuthorized, hasPermission]);

    if (isLoading) {
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
    
    if (visibleTools.length === 0) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="text-center text-muted-foreground">
                    No tienes permiso para acceder a ninguna herramienta de administración.
                </div>
            </main>
        );
    }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Administración
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.sort((a,b) => a.name.localeCompare(b.name)).map((tool) => {
                const isSuggestionsTool = tool.id === "admin:suggestions:read";
                const badgeCount = isSuggestionsTool ? unreadSuggestionsCount : 0;
                return <ToolCard key={tool.id} tool={tool} badgeCount={badgeCount}/>
              })}
            </div>
          </div>
        </div>
      </main>
  );
}
    
