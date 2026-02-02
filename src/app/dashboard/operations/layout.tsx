/**
 * @fileoverview Layout for the new Operations module.
 * It provides a consistent structure and title context for all pages within this module.
 */
'use client';

import React from 'react';

export default function OperationsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
