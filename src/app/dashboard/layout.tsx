/**
 * @fileoverview Main layout for the authenticated dashboard section of the application.
 * It handles session verification, ensuring only logged-in users can access this area.
 * It also provides the main structure including the sidebar, header, and content area,
 * and wraps the content in a PageTitleProvider for dynamic header titles.
 */
'use client';

import { AppSidebar } from "../../components/layout/sidebar";
import { Header } from "../../components/layout/header";
import { SidebarInset, SidebarProvider } from "../../components/ui/sidebar";
import { AuthProvider, useAuth } from "../../modules/core/hooks/useAuth"; // Import AuthProvider and useAuth
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle, PageTitleProvider } from "../../modules/core/hooks/usePageTitle";


function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !user) {
        router.push('/');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-32 w-32 rounded-full" />
                <Skeleton className="h-8 w-48" />
            </div>
        </div>
    )
  }

  return <>{children}</>;
}


/**
 * Inner component that consumes the PageTitleContext to display the current page title
 * in the header.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The child components to render.
 * @returns {JSX.Element} The rendered layout content.
 */
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { title } = usePageTitle();
  return (
    <>
      <Header title={title} />
      {children}
    </>
  );
}

/**
 * Main layout component for the dashboard.
 * It wraps pages in providers, verifies user authentication, and sets up the
 * main UI structure.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The page content to render inside the layout.
 * @returns {JSX.Element} The dashboard layout.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
        <AuthWrapper>
            <PageTitleProvider initialTitle="Panel">
                <SidebarProvider>
                    <div className="flex">
                        <AppSidebar />
                        <SidebarInset>
                            <DashboardContent>{children}</DashboardContent>
                        </SidebarInset>
                    </div>
                </SidebarProvider>
            </PageTitleProvider>
        </AuthWrapper>
    </AuthProvider>
  );
}
