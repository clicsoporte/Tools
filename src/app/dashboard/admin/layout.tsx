/**
 * @fileoverview Main layout for the administration section.
 * This component establishes a context provider for the page title, allowing
 * any child page within the admin section to dynamically set the header title.
 */
'use client';

import type { ReactNode } from "react";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
    // This layout used to have a redundant PageTitleProvider.
    // It has been removed to allow child pages to correctly update the
    // title in the main DashboardLayout's header.
    return <>{children}</>;
}
