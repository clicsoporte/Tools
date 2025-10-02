/**
 * @fileoverview Custom hook to handle authorization for specific pages or components.
 * It checks if the current user's role includes at least one of the required permissions.
 * If not, it denies access and can optionally redirect the user.
 */
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

type UseAuthorizationReturn = {
  isAuthorized: boolean | null;
  hasPermission: (permission: string) => boolean;
  userPermissions: string[];
};

export function useAuthorization(requiredPermissions: string[] = []): UseAuthorizationReturn {
    const router = useRouter();
    const { toast } = useToast();
    const { user, userRole, isLoading } = useAuth(); // Use the new central auth context

    const userPermissions = useMemo(() => userRole?.permissions || [], [userRole]);

    const isAuthorized = useMemo(() => {
        if (isLoading) return null; // Still loading, no decision yet
        if (!user) return false; // No user, not authorized
        
        // If no specific permissions are required, just being logged in is enough
        if (requiredPermissions.length === 0) return true;
        
        // Admin has all permissions
        if (user.role === 'admin') return true;
        
        // Check if the user has at least one of the required permissions
        return requiredPermissions.some(p => userPermissions.includes(p));
    }, [isLoading, user, requiredPermissions, userPermissions]);

    useEffect(() => {
        if (isAuthorized === false) {
            toast({
                title: 'Acceso Denegado',
                description: 'No tienes los permisos necesarios para ver esta página.',
                variant: 'destructive'
            });
            // Redirect to the main dashboard page if unauthorized, not the login page,
            // because the user is logged in, just not permitted for this specific route.
            router.replace('/dashboard');
        }
    }, [isAuthorized, router, toast]);

    const hasPermission = (permission: string) => {
        if (isLoading || !userRole) return false;
        if (userRole.id === 'admin') return true;
        return userPermissions.includes(permission);
    };

    return { isAuthorized, hasPermission, userPermissions };
}
