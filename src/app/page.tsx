/**
 * @fileoverview The main entry point of the application.
 * This page now acts as a Server Component, fetching initial data on the server
 * to prevent client-side flickering and layout shifts.
 */

import { AuthForm } from "@/components/auth/auth-form";
import {
  Card,
} from "@/components/ui/card";
import React from "react";
import { getInitialPageData } from "@/app/actions";

// This is the critical fix for the production cache issue.
export const dynamic = 'force-dynamic';

export default async function InitialPage() {
  const { hasUsers, companyName, systemVersion } = await getInitialPageData();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        {/* Pass initial data as props to the client component */}
        <AuthForm 
          initialHasUsers={hasUsers} 
          initialCompanyName={companyName}
          initialSystemVersion={systemVersion}
        />
      </Card>
    </div>
  );
}
