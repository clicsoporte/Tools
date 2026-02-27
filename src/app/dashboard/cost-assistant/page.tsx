/**
 * @fileoverview This page is a redirect to the new location of the Cost Assistant module.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedCostAssistantPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/invoices/cost-assistant');
    }, [router]);

    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Redirigiendo a la nueva ubicación...</p>
            </div>
        </div>
    );
}
