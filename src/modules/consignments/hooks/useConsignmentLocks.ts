'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { CountingSession } from '@/modules/core/types';
import { getActiveConsignmentSessions, forceReleaseConsignmentSession } from '../lib/actions';

type Lock = CountingSession & { agreement_name: string; user_name: string };

interface State {
    isLoading: boolean;
    isReleasing: number | null;
    locks: Lock[];
}

export const useConsignmentLocks = () => {
    const { hasPermission } = useAuthorization(['consignments:locks:manage']);
    const { toast } = useToast();
    const { user } = useAuth();

    const [state, setState] = useState<State>({
        isLoading: true,
        isReleasing: null,
        locks: [],
    });

    const fetchLocks = useCallback(async () => {
        if (!hasPermission('consignments:locks:manage')) return;
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            const activeLocks = await getActiveConsignmentSessions();
            setState(prev => ({ ...prev, locks: activeLocks }));
        } catch (error: any) {
            logError("Failed to fetch active consignment sessions", { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar las sesiones activas.", variant: "destructive" });
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [toast, hasPermission]);

    useEffect(() => {
        fetchLocks();
    }, [fetchLocks]);

    const handleReleaseLock = async (sessionId: number) => {
        if (!user) return;
        setState(prev => ({ ...prev, isReleasing: sessionId }));
        try {
            await forceReleaseConsignmentSession(sessionId, user.name);
            toast({ title: "Sesión Liberada", description: "La sesión de conteo está ahora disponible." });
            await fetchLocks(); // Refresh the list
        } catch (error: any) {
            logError("Failed to force release consignment session", { error: error.message, sessionId });
            toast({ title: "Error", description: "No se pudo liberar la sesión.", variant: "destructive" });
        } finally {
            setState(prev => ({ ...prev, isReleasing: null }));
        }
    };

    return {
        state,
        actions: {
            fetchLocks,
            handleReleaseLock,
        }
    };
};
