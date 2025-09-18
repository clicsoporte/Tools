
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "../../../../components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDropzone } from "react-dropzone";
import { Camera } from "lucide-react";
import { useAuth } from "@/modules/core/hooks/useAuth";

const getInitials = (name: string) => {
    if (!name) return "CL";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};


export default function GeneralSettingsPage() {
  useAuthorization(['admin:settings:general']);
  const { toast } = useToast();
  const { refreshAuth } = useAuth();
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && companyData) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCompanyData(prev => prev ? ({...prev, logoUrl: base64String}) : null);
      };
      reader.readAsDataURL(file);
    }
  }, [companyData]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
    multiple: false,
  });

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
    // Refresh the auth context to update UI elements like the sidebar
    await refreshAuth();
    await logInfo("Configuración general guardada", { companyName: companyData.name });
  };

  if (isLoading || !companyData) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
        </main>
    )
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-6">
                    <div {...getRootProps()} className="relative group cursor-pointer">
                        <input {...getInputProps()} />
                        <Avatar className="h-24 w-24 text-4xl">
                            <AvatarImage src={companyData.logoUrl} alt={companyData.name} />
                            <AvatarFallback>{getInitials(companyData.name)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <div>
                        <CardTitle>Datos de la Empresa</CardTitle>
                        <CardDescription>
                        Esta información se usará en los encabezados de los documentos. Haz clic en el logo para cambiarlo.
                        </CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Ajustes de Módulos</CardTitle>
                    <CardDescription>Configuración específica para los módulos de la aplicación.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Cotizador</h3>
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
                          <Label htmlFor="decimalPlaces">Decimales en Precios</Label>
                          <Input 
                              id="decimalPlaces"
                              type="number"
                              value={companyData.decimalPlaces ?? 2}
                              onChange={handleChange}
                          />
                      </div>
                  </div>
                   <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Interfaz y Rendimiento</h3>
                       <div className="space-y-2">
                          <Label htmlFor="searchDebounceTime">Retraso de Búsqueda (ms)</Label>
                          <Input 
                              id="searchDebounceTime"
                              type="number"
                              value={companyData.searchDebounceTime ?? 500}
                              onChange={handleChange}
                          />
                           <p className="text-xs text-muted-foreground pt-1">
                              Tiempo en milisegundos que el sistema espera antes de buscar (ej: 500 = 0.5s).
                           </p>
                      </div>
                   </div>
                </CardContent>
            </Card>

            <Card className="mt-6">
                <CardFooter className="border-t px-6 py-4">
                  <Button>Guardar Todos los Cambios</Button>
                </CardFooter>
            </Card>
          </form>
        </div>
      </main>
  );
}
