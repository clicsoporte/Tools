/**
 * @fileoverview Placeholder page for a deprecated route.
 * This page exists to prevent build errors from cached route information.
 * It should ideally not be accessed by users and can be removed in future versions
 * after ensuring all caches are cleared.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedImportPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect any traffic from this old route to the new one.
        router.replace('/dashboard/admin/import');
    }, [router]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Redirigiendo a la nueva ubicación...</p>
            </div>
        </div>
    );
}
