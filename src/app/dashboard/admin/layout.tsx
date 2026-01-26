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
    // This layout simply passes the context of the page title to its children.
    // It inherits the PageTitleProvider from the parent /dashboard/layout.tsx.
    return children;
}
