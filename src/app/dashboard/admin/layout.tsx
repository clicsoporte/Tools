/**
 * @fileoverview Main layout for the administration section.
 * This component establishes a context provider for the page title, allowing
 * any child page within the admin section to dynamically set the header title.
 */
'use client';

import type { ReactNode } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const adminNavLinks = [
    { href: '/dashboard/admin/general', label: 'General' },
    { href: '/dashboard/admin/users', label: 'Usuarios' },
    { href: '/dashboard/admin/roles', label: 'Roles' },
    { href: '/dashboard/admin/import', label: 'Importación' },
    { href: '/dashboard/admin/maintenance', label: 'Mantenimiento' },
    { href: '/dashboard/admin/logs', label: 'Visor de Eventos' },
    { href: '/dashboard/admin/suggestions', label: 'Buzón de Sugerencias' },
    { href: '/dashboard/admin/quoter', label: 'Cotizador' },
    { href: '/dashboard/admin/planner', label: 'Planificador' },
    { href: '/dashboard/admin/requests', label: 'Compras' },
    { href: '/dashboard/admin/consignments', label: 'Consignación' },
    { href: '/dashboard/admin/warehouse', label: 'Almacén' },
    { href: '/dashboard/admin/cost-assistant', label: 'Asist. Costos' },
    { href: '/dashboard/admin/api', label: 'API' },
    { href: '/dashboard/admin/email', label: 'Correo' },
    { href: '/dashboard/admin/analytics', label: 'Analíticas' },
];

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
    const pathname = usePathname();
    
    return (
        <div className="flex flex-col h-full">
            <div className="border-b">
                <div className="px-4 md:px-6 lg:px-8">
                     <nav className="flex items-center space-x-4 lg:space-x-6 overflow-x-auto py-2">
                        {adminNavLinks.sort((a, b) => a.label.localeCompare(b.label)).map(link => (
                            <Link 
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary whitespace-nowrap",
                                    pathname === link.href ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                {link.label}
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
