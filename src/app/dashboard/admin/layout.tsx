/**
 * @fileoverview Main layout for the administration section.
 * This component establishes a context provider for the page title, allowing
 * any child page within the admin section to dynamically set the header title.
 */
'use client';

import { PageTitleProvider } from "../../../modules/core/hooks/usePageTitle";
import type { ReactNode } from "react";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
    return (
        <PageTitleProvider initialTitle="Configuración">
            {children}
        </PageTitleProvider>
    )
}
