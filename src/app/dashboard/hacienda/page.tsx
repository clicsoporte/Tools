'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { getContributorInfo, getEnrichedExemptionStatus } from '@/modules/hacienda/lib/actions';
import { getAllCustomers, getAllExemptions } from '@/modules/core/lib/db-client';
import type { Customer, Exemption, HaciendaContributorInfo, EnrichedExemptionInfo } from '@/modules/core/types';
import { Loader2, Search, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logError } from '@/modules/core/lib/logger';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';
import { useDebounce } from 'use-debounce';

const ContributorInfoCard = ({ data }: { data: HaciendaContributorInfo | null }) => {
    if (!data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Situación Tributaria (Hacienda)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No se encontró información del contribuyente.</p>
                </CardContent>
            </Card>
        )
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>Situación Tributaria (Hacienda)</CardTitle>
                 <CardDescription>{data.nombre}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-muted-foreground">Régimen</p>
                        <p>{data.regimen.descripcion}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Administración</p>
                        <p>{data.administracionTributaria}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Estado</p>
                        <Badge variant={data.situacion.estado.toLowerCase().includes('inscrito') ? 'default' : 'destructive'}>
                            {data.situacion.estado}
                        </Badge>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Moroso / Omiso</p>
                        <p>{data.situacion.moroso} / {data.situacion.omiso}</p>
                    </div>
                </div>
                <div className="space-y-2 pt-2">
                    <p className="font-medium text-muted-foreground">Actividades Económicas</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {data.actividades.map(act => (
                            <div key={act.codigo} className="p-2 bg-muted/50 rounded-md text-xs">
                                <p className="font-semibold">{act.descripcion}</p>
                                <p className="text-muted-foreground">Código: {act.codigo} - Tipo: {act.tipo}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const ErpExemptionCard = ({ erpData }: { erpData: Exemption | null }) => {
    if (!erpData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Exoneración según ERP</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Sin datos de exoneración en el ERP para este cliente.</p>
                </CardContent>
            </Card>
        );
    }
    
    const isErpValid = isValid(new Date(erpData.endDate)) && new Date(erpData.endDate) > new Date();
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Exoneración según ERP</CardTitle>
                <CardDescription>{erpData.institutionName || 'Exoneración Local'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-muted-foreground">Autorización</p>
                        <p>{erpData.authNumber}</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground">Estado</p>
                        <div className={cn("flex items-center gap-1 font-medium", isErpValid ? 'text-green-600' : 'text-red-600')}>
                            {isErpValid ? <ShieldCheck className="h-4 w-4"/> : <ShieldX className="h-4 w-4"/>}
                            <span>{isErpValid ? 'Vigente' : 'Vencida'}</span>
                        </div>
                     </div>
                     <div>
                        <p className="text-muted-foreground">Exonerado</p>
                        <p className="font-bold">{erpData.percentage}%</p>
                    </div>
                     {isValid(parseISO(erpData.endDate)) &&
                        <div>
                            <p className="text-muted-foreground">Vencimiento</p>
                            <p className="font-bold">{format(parseISO(erpData.endDate), 'dd/MM/yyyy')}</p>
                        </div>
                     }
                </div>
            </CardContent>
        </Card>
    );
};

const HaciendaExemptionCard = ({ data }: { data: EnrichedExemptionInfo | null }) => {
    if (!data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Exoneración según Hacienda</CardTitle>
                </CardHeader>
                <CardContent>
                     <p className="text-muted-foreground">No se encontró información en Hacienda.</p>
                </CardContent>
            </Card>
        );
    }
    return (
        <Card>
            <CardHeader>
                 <CardTitle>Exoneración según Hacienda</CardTitle>
                 <CardDescription>{data.tipoDocumento.descripcion}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-muted-foreground">Autorización</p>
                        <p>{data.numeroDocumento}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Identificación</p>
                        <p>{data.identificacion}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Exonerado</p>
                        <p className="font-bold">{data.porcentajeExoneracion}%</p>
                    </div>
                    <div>
                         <p className="text-muted-foreground">Vencimiento</p>
                        <p className="font-bold">{format(parseISO(data.fechaVencimiento), 'dd/MM/yyyy')}</p>
                    </div>
                </div>
                <div className="space-y-2 pt-2">
                    <p className="font-medium text-muted-foreground">Artículos CABYS Incluidos</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {data.enrichedCabys.map((item, index) => (
                            <div key={`${item.code}-${index}`} className="p-2 bg-muted/50 rounded-md text-xs">
                                <p className="font-semibold">{item.description}</p>
                                <p className="text-muted-foreground">Código: {item.code}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


export default function HaciendaQueryPage() {
    useAuthorization(['hacienda:query']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [exemptions, setExemptions] = useState<Exemption[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [isUnifiedLoading, setIsUnifiedLoading] = useState(false);
    const [unifiedContributorData, setUnifiedContributorData] = useState<HaciendaContributorInfo | null>(null);
    const [unifiedExemptionData, setUnifiedExemptionData] = useState<EnrichedExemptionInfo | null>(null);
    const [unifiedErpExemption, setUnifiedErpExemption] = useState<Exemption | null>(null);

    const [unifiedSearchInput, setUnifiedSearchInput] = useState("");
    const [isUnifiedSearchOpen, setUnifiedSearchOpen] = useState(false);
    const [debouncedUnifiedSearch] = useDebounce(unifiedSearchInput, 500);

    const [taxpayerId, setTaxpayerId] = useState('');
    const [exemptionAuth, setExemptionAuth] = useState('');
    const [isTaxpayerLoading, setIsTaxpayerLoading] = useState(false);
    const [isExemptionLoading, setIsExemptionLoading] = useState(false);
    const [contributorData, setContributorData] = useState<HaciendaContributorInfo | null>(null);
    const [exemptionData, setExemptionData] = useState<EnrichedExemptionInfo | null>(null);
    

    useEffect(() => {
        setTitle("Consultas a Hacienda");
        const loadLocalData = async () => {
            setIsLoadingData(true);
            try {
                const [customersData, exemptionsData] = await Promise.all([
                    getAllCustomers(),
                    getAllExemptions()
                ]);
                setCustomers(customersData);
                setExemptions(exemptionsData);
            } catch (error) {
                toast({ title: "Error de carga", description: "No se pudieron cargar los datos locales de clientes y exoneraciones.", variant: "destructive" });
            } finally {
                setIsLoadingData(false);
            }
        };
        loadLocalData();
    }, [setTitle, toast]);

    const customerOptions = useMemo(() => {
        if (debouncedUnifiedSearch.length < 2) return [];
        const searchLower = debouncedUnifiedSearch.toLowerCase();
        return customers
            .filter(c => c.id.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower))
            .map(c => ({ value: c.id, label: `${c.id} - ${c.name}` }));
    }, [customers, debouncedUnifiedSearch]);

    const performTaxpayerSearch = async (id: string, setData: (data: HaciendaContributorInfo | null) => void) => {
        try {
            const result = await getContributorInfo(id);
            if ('error' in result) {
                throw new Error(result.message);
            }
            setData(result as HaciendaContributorInfo);
            return result as HaciendaContributorInfo;
        } catch (error: any) {
            toast({ title: "Error en Consulta Tributaria", description: error.message, variant: "destructive" });
            setData(null);
            return null;
        }
    };

    const performExemptionSearch = async (auth: string, setData: (data: EnrichedExemptionInfo | null) => void) => {
        try {
            const result = await getEnrichedExemptionStatus(auth);
            if ('error' in result) {
                setData(null);
                return null;
            };
            setData(result as EnrichedExemptionInfo);
            return result as EnrichedExemptionInfo;
        } catch (error: any) {
            toast({ title: "Error en Consulta de Exoneración", description: error.message, variant: "destructive" });
            setData(null);
            return null;
        }
    };

    const executeUnifiedSearch = async (customerId: string) => {
        setUnifiedSearchOpen(false);
        setIsUnifiedLoading(true);
        // Reset API-dependent states, but not the ERP one initially
        setUnifiedContributorData(null);
        setUnifiedExemptionData(null);
        setUnifiedErpExemption(null);
        
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setUnifiedSearchInput(`${customer.id} - ${customer.name}`);
        }

        // Find and set ERP data first, regardless of what happens next.
        const customerExemption = customer ? exemptions.find(ex => ex.customer === customer.id) : null;
        setUnifiedErpExemption(customerExemption || null);
        
        if (!customer || !customer.taxId) {
            toast({ title: "Cliente no encontrado", description: "No se encontró cliente o no tiene cédula registrada.", variant: "destructive" });
            setIsUnifiedLoading(false);
            return;
        }
    
        const contributorPromise = performTaxpayerSearch(customer.taxId, setUnifiedContributorData);
        const exemptionPromise = customerExemption 
            ? performExemptionSearch(customerExemption.authNumber, setUnifiedExemptionData) 
            : Promise.resolve();

        await Promise.all([contributorPromise, exemptionPromise]);

        setIsUnifiedLoading(false);
    };

    const handleIndividualTaxpayerSearch = async () => {
        if (!taxpayerId) return;
        setIsTaxpayerLoading(true);
        await performTaxpayerSearch(taxpayerId, setContributorData);
        setIsTaxpayerLoading(false);
    };

    const handleIndividualExemptionSearch = async () => {
        if (!exemptionAuth) return;
        setIsExemptionLoading(true);
        await performExemptionSearch(exemptionAuth, setExemptionData);
        setIsExemptionLoading(false);
    };

    // Función wrapper para adaptar el tipo de setUnifiedSearchInput
    const handleSearchInputChange = (value: string) => {
        setUnifiedSearchInput(value);
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
            <Tabs defaultValue="unified">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="unified">Búsqueda Unificada</TabsTrigger>
                    <TabsTrigger value="taxpayer">Situación Tributaria</TabsTrigger>
                    <TabsTrigger value="exemption">Exoneraciones</TabsTrigger>
                </TabsList>
                
                <TabsContent value="unified">
                    <Card>
                        <CardHeader>
                            <CardTitle>Búsqueda Unificada de Cliente</CardTitle>
                            <CardDescription>Busca un cliente para obtener la situación tributaria y la exoneración asociada (si existe).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <SearchInput
                                    options={customerOptions}
                                    onSelect={executeUnifiedSearch}
                                    value={unifiedSearchInput}
                                    onValueChange={handleSearchInputChange}
                                    placeholder="Buscar cliente por código, nombre o cédula..."
                                    open={isUnifiedSearchOpen}
                                    onOpenChange={setUnifiedSearchOpen}
                                />
                            </div>
                            {isUnifiedLoading && <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>}
                            {!isUnifiedLoading && (
                                <div className="grid md:grid-cols-2 gap-8 pt-4 border-t">
                                    <ContributorInfoCard data={unifiedContributorData} />
                                    <div className="space-y-6">
                                        <ErpExemptionCard erpData={unifiedErpExemption} />
                                        <HaciendaExemptionCard data={unifiedExemptionData} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="taxpayer">
                    <Card>
                        <CardHeader>
                            <CardTitle>Situación Tributaria</CardTitle>
                            <CardDescription>Consulta la información de un contribuyente en el sistema de Hacienda.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    id="taxpayer-id"
                                    placeholder="Nº de identificación"
                                    value={taxpayerId}
                                    onChange={(e) => setTaxpayerId(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleIndividualTaxpayerSearch()}
                                />
                                <Button onClick={handleIndividualTaxpayerSearch} disabled={isTaxpayerLoading}>
                                    {isTaxpayerLoading ? <Loader2 className="animate-spin" /> : <Search />}
                                </Button>
                            </div>
                            {contributorData && <ContributorInfoCard data={contributorData} />}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="exemption">
                    <Card>
                        <CardHeader>
                            <CardTitle>Consulta de Exoneraciones</CardTitle>
                            <CardDescription>Verifica los detalles de una autorización de exoneración.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    id="exemption-auth"
                                    placeholder="Nº de autorización"
                                    value={exemptionAuth}
                                    onChange={(e) => setExemptionAuth(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleIndividualExemptionSearch()}
                                />
                                <Button onClick={handleIndividualExemptionSearch} disabled={isExemptionLoading}>
                                     {isExemptionLoading ? <Loader2 className="animate-spin" /> : <Search />}
                                </Button>
                            </div>
                            <HaciendaExemptionCard data={exemptionData} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    );
}
