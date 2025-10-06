/**
 * @fileoverview This file defines a central authentication context and hook.
 * It provides a single source of truth for the current user, their role, company data,
 * and loading status, preventing redundant data fetching and component re-renders.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company, Product, StockInfo, Customer } from "../types";
import { getCurrentUser as getCurrentUserClient } from '../lib/auth-client';
import { getAllRoles, getCompanySettings, getAllCustomers, getAllProducts, getAllStock } from '../lib/db';

/**
 * Defines the shape of the authentication context's value.
 */
interface AuthContextType {
  user: User | null;
  userRole: Role | null;
  companyData: Company | null;
  customers: Customer[];
  products: Product[];
  stockLevels: StockInfo[];
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<StockInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAuthData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [currentUser, allRoles, companySettings, dbCustomers, dbProducts, dbStock] = await Promise.all([
        getCurrentUserClient(),
        getAllRoles(),
        getCompanySettings(),
        getAllCustomers(),
        getAllProducts(),
        getAllStock(),
      ]);

      setUser(currentUser);
      setCompanyData(companySettings);
      setCustomers(dbCustomers);
      setProducts(dbProducts);
      setStockLevels(dbStock);

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
      setCustomers([]);
      setProducts([]);
      setStockLevels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthData();
    // Listen for storage events (like logout or settings changes) to refresh data
    const handleStorageChange = () => loadAuthData();
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    }
  }, [loadAuthData]);

  const contextValue: AuthContextType = {
    user,
    userRole,
    companyData,
    customers,
    products,
    stockLevels,
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
