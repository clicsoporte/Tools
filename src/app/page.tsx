/**
 * @fileoverview The main login page for the application.
 * This is a Server Component that fetches request headers (IP, hostname)
 * and passes them to the client-side AuthForm component for secure logging.
 */

import { headers } from "next/headers";
import { AuthForm } from "@/components/auth/auth-form";
import { getCompanySettings } from "@/modules/core/lib/db";
import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Network } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

async function CompanyInfo() {
  const companyData = await getCompanySettings();
  return (
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Network className="h-8 w-8" />
      </div>
      <CardTitle className="text-3xl font-bold">{companyData?.systemName || "Clic-Tools"}</CardTitle>
      <CardDescription>
        Inicia sesión para acceder a tus herramientas
      </CardDescription>
    </CardHeader>
  );
}

function CompanyInfoSkeleton() {
    return (
        <CardHeader className="text-center">
            <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
        </CardHeader>
    )
}

/**
 * Renders the login page.
 * It fetches server-side data (company info, request headers) and passes it
 * to the client component responsible for handling user interaction.
 */
export default async function LoginPage() {
  const requestHeaders = headers();
  const clientIp = requestHeaders.get('x-forwarded-for') ?? 'Unknown IP';
  const clientHost = requestHeaders.get('host') ?? 'Unknown Host';
  const clientInfo = { ip: clientIp, host: clientHost };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <Suspense fallback={<CompanyInfoSkeleton />}>
            <CompanyInfo />
        </Suspense>
        <CardContent>
             <AuthForm clientInfo={clientInfo} />
        </CardContent>
      </Card>
    </div>
  );
}
