/**
 * @fileoverview Server-side "guardian" functions for robust authorization.
 * These functions are the single source of truth for permission checking on the server,
 * protecting both API-like actions and page renders.
 */
'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission as hasPermissionServer } from './auth';
import { logWarn } from './logger';
import type { User } from '@/modules/core/types';

/**
 * Custom error class for authorization failures.
 * This allows for specific error handling in try/catch blocks.
 */
export class AuthError extends Error {
  constructor(message = "Acceso Denegado") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Memoized function to get the current user's data from the session.
 * This utilizes React's `cache` to prevent multiple database queries for the user
 * within a single server-side render cycle.
 */
const getCachedUser = cache(async () => {
    const user = await getCurrentUser();
    if (!user) {
        return null;
    }
    return user;
});

/**
 * Verifies if the current user in session has a specific permission.
 * Throws an AuthError if the check fails. This is the primary guard
 * for all Server Actions that modify data.
 *
 * @param requiredPermission The permission string to check for.
 * @returns {Promise<User>} The full user object if authorized, allowing for reuse in the action.
 * @throws {AuthError} If the user is not authenticated or lacks permission.
 */
export async function authorizeAction(requiredPermission: string): Promise<User> {
    const user = await getCachedUser();
    if (!user) {
        throw new AuthError("No autenticado. Inicia sesión para continuar.");
    }
    
    const isAuthorized = await hasPermissionServer(user.id, requiredPermission);

    if (!isAuthorized) {
        await logWarn('Intento de acción no autorizada', { user: user.name, requiredPermission });
        throw new AuthError("No tienes permiso para realizar esta acción.");
    }

    return user;
}


/**
 * Verifies if the current user in session can access a specific page.
 * If the check fails, it redirects the user to the main dashboard.
 * This should be used at the top of Server Components (pages) to protect routes.
 *
 * @param requiredPermission The permission string to check for.
 */
export async function authorizePage(requiredPermission: string): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
        return redirect('/'); // If no user, redirect to login
    }
    
    const isAuthorized = await hasPermissionServer(user.id, requiredPermission);

    if (!isAuthorized) {
        // Redirect to a safe default page if unauthorized.
        // No warning is logged for page access attempts to avoid log spam.
        return redirect('/dashboard');
    }
}
