/**
 * @fileoverview This file defines a central authentication context and hook.
 * It provides a single source of truth for the current user, their role, company data,
 * and loading status, preventing redundant data fetching and component re-renders.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company } from "../types";
import { getCurrentUser as getCurrentUserClient } from '../lib/auth-client';
import { getAllRoles, getCompanySettings } from '../lib/db';

/**
 * Defines the shape of the authentication context's value.
 */
interface AuthContextType {
  user: User | null;
  userRole: Role | null;
  companyData: Company | null;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The provider component that wraps the authenticated parts of the application.
 * It handles the initial loading of all authentication-related data.
 * @param {object} props - The component props.
 * @param {ReactNode} props.children - The child components to render.
 */
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAuthData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [currentUser, allRoles, companySettings] = await Promise.all([
        getCurrentUserClient(),
        getAllRoles(),
        getCompanySettings(),
      ]);

      setUser(currentUser);
      setCompanyData(companySettings);

      if (currentUser && allRoles.length > 0) {
        const role = allRoles.find(r => r.id === currentUser.role);
        setUserRole(role || null);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      console.error("Failed to load authentication context data:", error);
      setUser(null);
      setUserRole(null);
      setCompanyData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthData();
    // Listen for storage events (like logout or settings changes) to refresh data
    window.addEventListener('storage', loadAuthData);
    return () => {
        window.removeEventListener('storage', loadAuthData);
    }
  }, [loadAuthData]);

  const contextValue: AuthContextType = {
    user,
    userRole,
    companyData,
    isLoading,
    refreshAuth: loadAuthData,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * A custom hook to easily access the central authentication context.
 * Throws an error if used outside of an AuthProvider.
 * @returns {AuthContextType} The authentication context value.
 */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
