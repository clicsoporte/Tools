/**
 * @fileoverview This layout component is essential for rendering child routes
 * within the /dashboard/analytics path. It sets up a sub-navigation for the reports.
 */
'use client';

import type { ReactNode } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { analyticsTools } from '@/modules/core/lib/data';
import { useMemo } from 'react';

export default function AnalyticsLayout({
  children,
}: {
  children: ReactNode;
}) {
    const pathname = usePathname();
    const { hasPermission } = useAuthorization();

    const visibleLinks = useMemo(() => 
        analyticsTools.filter(tool => hasPermission(tool.id)).sort((a, b) => a.name.localeCompare(b.name)),
        [hasPermission]
    );

    return (
        <div className="flex flex-col h-full">
            <div className="border-b">
                <div className="px-4 md:px-6 lg:px-8">
                     <nav className="hidden md:flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                        {visibleLinks.map(link => (
                            <Link 
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    pathname === link.href ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
    