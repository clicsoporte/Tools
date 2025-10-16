
'use client';

import type { ReactNode } from 'react';

// This layout component ensures that child routes can be rendered within this segment.
export default function RequestsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
