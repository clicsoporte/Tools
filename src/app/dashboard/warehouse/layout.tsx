/**
 * @fileoverview This layout component is essential for rendering child routes
 * within the /dashboard/warehouse path. It ensures that Next.js can
 * correctly nest and display pages within this URL segment.
 */
'use client';

import type { ReactNode } from 'react';

export default function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
