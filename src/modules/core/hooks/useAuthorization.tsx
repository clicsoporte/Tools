/**
 * @fileoverview Custom hook to handle client-side authorization checks.
 * It provides a clean, reusable interface for components to determine if the
 * current user has the necessary permissions to view a component or perform an action.
 */
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { AppPermission } from '@/modules/core/lib/permissions';

type UseAuthorizationReturn = {
  isAuthorized: boolean;
  isLoading: boolean;
  hasPermission: (permission: string | string[]) => boolean;
};

/**
 * Custom hook to determine authorization based on the current user's permissions.
 *
 * @param requiredPermissions - A permission string or an array of permission strings.
 * If an array is provided, the user is considered authorized if they have AT LEAST ONE of the permissions.
 * @returns An object containing the authorization status, loading state, and the `hasPermission` function.
 */
export function useAuthorization(requiredPermissions: AppPermission | AppPermission[] = []): UseAuthorizationReturn {
    const router = useRouter();
    // Get the centralized permission checker and auth readiness state from useAuth
    const { hasPermission, isAuthReady } = useAuth(); 

    // Memoize the string representation of the permissions to avoid re-renders.
    const depsString = JSON.stringify(requiredPermissions);

    // isAuthorized is now derived directly and memoized from the hasPermission function
    const isAuthorized = useMemo(() => {
        if (!isAuthReady) {
            return false; // Not authorized until auth state is fully loaded
        }
        
        const permissionsToCheck = Array.isArray(requiredPermissions) 
            ? requiredPermissions 
            : (requiredPermissions ? [requiredPermissions] : []);
            
        if (permissionsToCheck.length === 0) {
            return true; // No specific permissions required, just being logged in is enough.
        }

        return hasPermission(permissionsToCheck);
    }, [isAuthReady, depsString, hasPermission]); // Use the stringified dependency

    return {
        isAuthorized,
        isLoading: !isAuthReady, // Loading state is simply the inverse of auth readiness
        hasPermission, // Expose the central hasPermission function for convenience
    };
}
