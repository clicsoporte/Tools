
"use client";

import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "../../../../components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../../../../components/ui/accordion";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { useToast } from "../../../../modules/core/hooks/use-toast";
import type { Company } from "../../../../modules/core/types";
import { Skeleton } from "../../../../components/ui/skeleton";
import { logInfo } from "../../../../modules/core/lib/logger";
import { getCompanySettings, saveCompanySettings } from "../../../../modules/core/lib/db-client";
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";


export default function GeneralSettingsPage() {
  useAuthorization(['admin:settings:general']);
  const { toast } = useToast();
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  useEffect(() => {
    setTitle("Configuración General");
    const loadData = async () => {
        setIsLoading(true);
        const data = await getCompanySettings();
        setCompanyData(data);
        setIsLoading(false);
    }
    loadData();
  }, [setTitle]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!companyData) return;
    const { id, value, type } = e.target;
    const isNumber = type === 'number';
    setCompanyData(prev => prev ? ({...prev, [id]: isNumber ? parseInt(value, 10) : value}) : null);
  }

  const handleSubmit = async () => {
    if (!companyData) return;
    await saveCompanySettings(companyData);
    toast({
      title: "Configuración Guardada",
      description: "Los datos de la empresa han sido actualizados.",
    });
    // This is a workaround to force a re-render of components using the company data
    window.dispatchEvent(new Event("storage"));
    await logInfo("Configuración general guardada", { companyName: companyData.name });
  };

  if (isLoading || !companyData) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Datos de la Empresa</CardTitle>
                    <CardDescription>
                    Esta información se usará en los encabezados de los documentos y en la interfaz.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button disabled>Guardar Cambios</Button>
                </CardFooter>
            </Card>
        </div>
        </main>
    )
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Empresa</CardTitle>
                <CardDescription>
                  Esta información se usará en los encabezados de los documentos y en la interfaz. El logo se debe colocar en la carpeta `public/logo/` con el nombre `logo.png` o `logo.jpg`.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Datos Principales de la Empresa</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="systemName">Nombre del Sistema</Label>
                          <Input 
                            id="systemName" 
                            value={companyData.systemName || ''}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Nombre de la Empresa</Label>
                          <Input 
                            id="name" 
                            value={companyData.name}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="taxId">ID de Contribuyente / Cédula Jurídica</Label>
                          <Input 
                            id="taxId" 
                            value={companyData.taxId}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Dirección</Label>
                          <Textarea 
                            id="address" 
                            rows={3}
                            value={companyData.address}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input 
                                id="phone" 
                                value={companyData.phone}
                                onChange={handleChange}
                            />
                            </div>
                            <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input 
                                id="email" 
                                type="email"
                                value={companyData.email}
                                onChange={handleChange}
                            />
                            </div>
                        </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Configuración de Cotizaciones</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="quotePrefix">Prefijo de Cotización</Label>
                              <Input 
                                  id="quotePrefix" 
                                  value={companyData.quotePrefix || ''}
                                  onChange={handleChange}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="nextQuoteNumber">Próximo Número</Label>
                              <Input 
                                  id="nextQuoteNumber"
                                  type="number"
                                  value={companyData.nextQuoteNumber || 1}
                                  onChange={handleChange}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="decimalPlaces">Decimales</Label>
                              <Input 
                                  id="decimalPlaces"
                                  type="number"
                                  value={companyData.decimalPlaces || 2}
                                  onChange={handleChange}
                              />
                          </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button>Guardar Cambios</Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </main>
  );
}
