/**
 * @fileoverview This file defines a central authentication context and hook.
 * It provides a single source of truth for the current user, their role, company data,
 * and loading status, preventing redundant data fetching and component re-renders.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company, Product, StockInfo, Customer } from "../types";
import { getCurrentUser as getCurrentUserClient } from '../lib/auth-client';
import { getAllRoles, getCompanySettings, getAllCustomers, getAllProducts, getAllStock, getAndCacheExchangeRate } from '../lib/db';
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

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
  exchangeRateData: { rate: number | null, date: string | null };
  isLoading: boolean;
  refreshAuth: () => Promise<{ isAuthenticated: boolean; } | void>;
  refreshAuthAndRedirect: (path: string) => Promise<void>;
  refreshExchangeRate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The provider component that wraps the authenticated parts of the application.
 * It handles the initial loading of all authentication-related data.
 * @param {object} props - The component props.
 * @param {ReactNode} props.children - The child components to render.
 */
export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<StockInfo[]>([]);
  const [exchangeRateData, setExchangeRateData] = useState<{ rate: number | null, date: string | null }>({ rate: null, date: null });
  const [isLoading, setIsLoading] = useState(true);

  const refreshExchangeRate = useCallback(async () => {
    const rateData = await getAndCacheExchangeRate(true);
    setExchangeRateData(rateData || { rate: null, date: null });
  }, []);

  const loadAuthData = useCallback(async (isInitialLoad = false) => {
    // Only show full loading state on the very first load
    if (isInitialLoad) {
      setIsLoading(true);
    }
    
    try {
      const [currentUser, allRoles, companySettings, dbCustomers, dbProducts, dbStock, rateData] = await Promise.all([
        getCurrentUserClient(),
        getAllRoles(),
        getCompanySettings(),
        getAllCustomers(),
        getAllProducts(),
        getAllStock(),
        getAndCacheExchangeRate(),
      ]);

      setUser(currentUser);
      setCompanyData(companySettings);
      setCustomers(dbCustomers);
      setProducts(dbProducts);
      setStockLevels(dbStock);
      setExchangeRateData(rateData || { rate: null, date: null });

      if (currentUser && allRoles.length > 0) {
        const role = allRoles.find(r => r.id === currentUser.role);
        setUserRole(role || null);
      } else {
        setUserRole(null);
      }
      return { isAuthenticated: !!currentUser };
    } catch (error) {
      console.error("Failed to load authentication context data:", error);
      setUser(null);
      setUserRole(null);
      return { isAuthenticated: false };
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, []);
  
  const refreshAuthAndRedirect = useCallback(async (path: string) => {
    await loadAuthData(false);
    router.push(path);
    router.refresh();
  }, [loadAuthData, router]);

  useEffect(() => {
    const isInitialLoad = true;
    if (!isLoading) return; // Prevent re-running if already loaded
    
    loadAuthData(isInitialLoad).then(({ isAuthenticated }) => {
        // This effect handles redirection after the initial load is complete
        if (isAuthenticated === false && pathname.startsWith('/dashboard')) {
            router.replace('/');
        }
    });
  }, [pathname, router, loadAuthData, isLoading]);

  const contextValue: AuthContextType = {
    user,
    userRole,
    companyData,
    customers,
    products,
    stockLevels,
    exchangeRateData,
    isLoading,
    refreshAuth: () => loadAuthData(false),
    refreshAuthAndRedirect,
    refreshExchangeRate,
  };

  const isDashboardRoute = pathname.startsWith('/dashboard');

  if (isLoading && isDashboardRoute) {
    return (
        <div className="flex min-h-screen bg-muted/40">
            <div className="hidden md:flex flex-col w-64 border-r p-4 gap-4">
                 <div className="flex items-center gap-2 mb-4">
                    <Skeleton className="h-10 w-10 rounded-lg"/>
                    <Skeleton className="h-6 w-32"/>
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex-1 flex flex-col">
                <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
                    <Skeleton className="h-8 w-48"/>
                    <div className="ml-auto flex items-center gap-4">
                       <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </header>
                <main className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </main>
            </div>
        </div>
    );
  }

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
