/**
 * @fileoverview The main dashboard page, which greets the user and displays available tools.
 */
'use client';

import { mainTools, analyticsTools, adminTools } from "../../modules/core/lib/data";
import { ToolCard } from "../../components/dashboard/tool-card";
import { useEffect, useMemo } from "react";
import type { Tool } from "../../modules/core/types";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle } from "../../modules/core/hooks/usePageTitle";
import { useAuth } from "@/modules/core/hooks/useAuth";

/**
 * Renders the main dashboard page.
 * It fetches the current user's data to personalize the experience and filters tools
 * based on user permissions.
 */
export default function DashboardPage() {
  const { userRole, isLoading: isAuthLoading } = useAuth();
  const { setTitle } = usePageTitle();

  useEffect(() => {
    setTitle("Panel Principal");
  }, [setTitle]);

  const visibleTools = useMemo(() => {
    if (!userRole) return [];
    
    let tools: Tool[] = [...mainTools];
    const hasAdminAccess = userRole.id === 'admin';
    const hasAnalyticsAccess = hasAdminAccess || userRole.permissions.includes('analytics:read');

    if (hasAnalyticsAccess) {
      tools.push(...analyticsTools);
    }
    
    if (hasAdminAccess) {
      tools.push(...adminTools);
    }

    // A more robust way to prevent duplicates if data definitions overlap
    const uniqueTools = Array.from(new Map(tools.map(tool => [tool.id, tool])).values());
    
    // Custom sort order if needed, for now, it's main, then analytics, then admin
    return uniqueTools;

  }, [userRole]);


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
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.map((tool) => {
                return <ToolCard key={tool.id} tool={tool} />
              })}
            </div>
          </div>
        </div>
      </main>
  );
}
