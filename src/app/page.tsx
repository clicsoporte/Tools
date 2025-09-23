/**
 * @fileoverview The main login page for the application.
 * This is a Server Component that fetches request headers (IP, hostname)
 * and passes them to the client-side AuthForm component for secure logging.
 */

import { headers } from "next/headers";
import { AuthForm } from "@/components/auth/auth-form";
import { getCompanySettings } from "@/modules/core/lib/db";
import { Network } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import type { Company } from "@/modules/core/types";

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
  
  let companyData: Company | null = null;
  try {
    companyData = await getCompanySettings();
  } catch (error) {
    console.error("Failed to load company data on server:", error);
    // Provide a default object if fetching fails
    companyData = { name: "IntraTool Hub" } as Company;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Network className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">{companyData?.systemName || "IntraTool Hub"}</CardTitle>
          <CardDescription>
            Inicia sesión para acceder a tus herramientas
          </CardDescription>
        </CardHeader>
        <AuthForm clientInfo={clientInfo} />
      </Card>
    </div>
  );
}
