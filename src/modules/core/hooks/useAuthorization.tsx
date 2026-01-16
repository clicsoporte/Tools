/**
 * @fileoverview Custom hook to handle authorization for specific pages or components.
 * It checks if the current user's role includes at least one of the required permissions.
 * If not, it denies access and can optionally redirect the user.
 */
'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { logInfo } from '../lib/logger';

type UseAuthorizationReturn = {
  isAuthorized: boolean | null;
  hasPermission: (permission: string) => boolean;
  userPermissions: string[];
};

export function useAuthorization(requiredPermissions: string[] = []): UseAuthorizationReturn {
    const router = useRouter();
    const { user, userRole, isAuthReady } = useAuth(); // Use isAuthReady from the central auth context

    const userPermissions = useMemo(() => userRole?.permissions || [], [userRole]);

    const hasPermission = useCallback((permission: string): boolean => {
        if (!isAuthReady || !userRole) return false;
        if (userRole.id === 'admin') return true;
        return userPermissions.includes(permission);
    }, [isAuthReady, userRole, userPermissions]);

    const isAuthorized = useMemo(() => {
        if (!isAuthReady) return null; // Wait until all auth data is ready before making a decision.
        if (!user || !userRole) return false; // No user or role, not authorized.
        
        // If no specific permissions are required, being logged in and ready is enough.
        if (requiredPermissions.length === 0) return true;
        
        // Use the memoized hasPermission function for checking.
        return requiredPermissions.some(p => hasPermission(p));
    }, [isAuthReady, user, userRole, requiredPermissions, hasPermission]);

    useEffect(() => {
        // This effect is now simplified. The main redirect logic is in DashboardLayout.
        // It's kept in case specific pages need to react to authorization changes in the future,
        // but it no longer handles the primary redirection responsibility.
        if (isAuthReady && isAuthorized && user) {
            // This is a good place to log module access if needed.
        }
    }, [isAuthorized, isAuthReady, user]);

    return { isAuthorized, hasPermission, userPermissions };
}
