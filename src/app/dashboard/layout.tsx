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
import { usePageTitle, PageTitleProvider } from "../../modules/core/hooks/usePageTitle";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { title } = usePageTitle();
  return (
    <>
      <Header title={title} />
      <div className="flex-1 overflow-auto">{children}</div>
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
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // This effect is the single source of truth for session verification.
    // It waits until the auth state is fully resolved (isLoading is false).
    if (!isLoading) {
      if (user) {
        // If there's a user, we can safely show the dashboard.
        setIsVerified(true);
      } else {
        // If there's no user after loading, it means the session is invalid.
        // Redirect to the login page. This is the only place this redirect happens.
        router.replace('/');
      }
    }
  }, [isLoading, user, router]);

  // While waiting for the initial check, show a global loading screen.
  // We use `!isVerified` which covers both the initial `isLoading` state
  // and the brief moment before the redirect happens if the user is not authenticated.
  if (!isVerified) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Once verified, render the full dashboard layout.
  return (
      <PageTitleProvider initialTitle="Panel">
        <SidebarProvider>
          <div className="flex h-screen bg-muted/40">
            <AppSidebar />
            <SidebarInset className="flex flex-1 flex-col overflow-hidden">
                <DashboardContent>{children}</DashboardContent>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </PageTitleProvider>
  );
}
