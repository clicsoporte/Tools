/**
 * @fileoverview Layout for the data import page.
 * This layout file is intentionally left to ensure that any child routes
 * within this path segment can be rendered correctly by Next.js.
 */
'use client';

import type { ReactNode } from 'react';

export default function DeprecatedImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    // This layout remains to prevent build errors from cached routes,
    // but ideally, this directory should be removed once the cache is fully cleared
    // across environments.
    return <>{children}</>;
}
