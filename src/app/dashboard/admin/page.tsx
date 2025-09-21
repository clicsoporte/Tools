
/**
 * @fileoverview The main dashboard page for the admin section.
 * It dynamically displays a grid of available administration tools.
 */
'use client';
import { adminTools } from "../../../modules/core/lib/data";
import { ToolCard } from "../../../components/dashboard/tool-card";
import { useEffect } from "react";
import { usePageTitle } from "../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
    const { setTitle } = usePageTitle();
    const { isAuthorized } = useAuthorization(['admin:settings:general']);

    useEffect(() => {
        setTitle("Configuración del Sistema");
    }, [setTitle]);

    if (!isAuthorized) {
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

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Herramientas de Administración
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {adminTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        </div>
      </main>
  );
}

    
