/**
 * @fileoverview This layout component is essential for rendering child routes
 * within the /dashboard/analytics path. It sets up a sub-navigation for the reports.
 */
'use client';

import type { ReactNode } from "react";

export default function AnalyticsLayout({
  children,
}: {
  children: ReactNode;
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
    