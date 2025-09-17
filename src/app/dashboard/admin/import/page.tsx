
/**
 * @fileoverview Admin page for managing data imports from external sources (files or SQL DB).
 * This component allows administrators to configure import paths, connection strings,
 * and SQL queries, and to trigger the import processes.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../modules/core/hooks/use-toast";
import { logError, logInfo } from "../../../../modules/core/lib/logger";
import { Loader2, FileUp, Database, Save } from "lucide-react";
import type { Company, SqlConfig, ImportQuery } from '../../../../modules/core/types';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { importData, getCompanySettings, saveCompanySettings, testSqlConnection, saveSqlConfig, getSqlConfig, saveImportQueries, getImportQueries, importAllDataFromFiles } from '../../../../modules/core/lib/db-client';
import { useAuthorization } from '../../../../modules/core/hooks/useAuthorization';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Textarea } from '../../../../components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ImportType = 'customers' | 'products' | 'exemptions' | 'stock' | 'locations' | 'cabys';
const importTypes: ImportType[] = ['customers', 'products', 'exemptions', 'stock', 'locations', 'cabys'];

const importTypeTranslations: { [key in ImportType]: string } = {
    customers: 'Clientes',
    products: 'Artículos',
    exemptions: 'Exoneraciones',
    stock: 'Existencias',
    locations: 'Ubicaciones',
    cabys: 'Catálogo CABYS'
};

const importTypeFieldMapping: { [key in ImportType]: keyof Company } = {
    customers: 'customerFilePath',
    products: 'productFilePath',
    exemptions: 'exemptionFilePath',
    stock: 'stockFilePath',
    locations: 'locationFilePath',
    cabys: 'cabysFilePath',
};

/**
 * Renders the data import management page.
 * It provides UI for switching between import modes (file vs. SQL), configuring settings
 * for each mode, and executing import jobs.
 */
export default function ImportDataPage() {
    const { hasPermission } = useAuthorization(['admin:import:files', 'admin:import:sql', 'admin:import:sql-config']);
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingType, setProcessingType] = useState<string | null>(null);
    const [companyData, setCompanyData] = useState<Company | null>(null);
    const [sqlConfig, setSqlConfig] = useState<SqlConfig>({});
    const [importQueries, setImportQueries] = useState<ImportQuery[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const { setTitle } = usePageTitle();

    useEffect(() => {
        setTitle("Importar Datos");
        const loadConfig = async () => {
            const [company, sql, queries] = await Promise.all([
                getCompanySettings(),
                getSqlConfig(),
                getImportQueries()
            ]);
            setCompanyData(company);
            setSqlConfig(sql || {});
            setImportQueries(queries || []);
        };
        loadConfig();
    }, [setTitle]);

    /**
     * Handles the import of a single data type (e.g., customers).
     * @param {ImportType} type The type of data to import.
     */
    const handleImport = async (type: ImportType) => {
        setProcessingType(type);
        setIsProcessing(true);
        try {
            const result = await importData(type);
            let itemType = 'registros';
            if (type === 'customers') itemType = 'clientes';
            if (type === 'products') itemType = 'artículos';
            if (type === 'exemptions') itemType = 'exoneraciones';
            if (type === 'stock') itemType = 'existencias';
            if (type === 'locations') itemType = 'ubicaciones de almacén';
            if (type === 'cabys') itemType = 'códigos CABYS';

            toast({
                title: `Importación de ${importTypeTranslations[type]} Exitosa`,
                description: `Se han cargado ${result.count} ${itemType} desde ${result.source}.`,
            });
            await logInfo(`Importación de datos: ${result.count} ${type} cargados desde ${result.source}.`);
        } catch (error: any) {
            toast({
                title: "Error de Importación",
                description: error.message,
                variant: "destructive"
            });
            await logError(`Error al importar ${type}`, { error: error.message });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };
    
    /**
     * Triggers a full data synchronization from the configured source (file or SQL).
     */
    const handleFullSqlImport = async () => {
        setProcessingType('full-sql-import');
        setIsProcessing(true);
        toast({ title: "Iniciando Sincronización Completa", description: "Importando todos los datos desde el ERP..." });
        try {
            const results = await importAllDataFromFiles(); // This function now handles both file and SQL modes based on config.
            toast({
                title: "Sincronización Completa Exitosa",
                description: `Se han procesado ${results.length} tipos de datos desde el ERP.`,
            });
            await logInfo("Full ERP data synchronization completed.", { results });
        } catch (error: any) {
             toast({
                title: "Error en Sincronización",
                description: error.message,
                variant: "destructive"
            });
            await logError(`Error durante la sincronización completa desde el ERP`, { error: error.message });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    }
    
    const handleCompanyDataChange = (field: keyof Company, value: any) => {
        if (!companyData) return;
        setCompanyData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    const handleSqlConfigChange = (field: keyof SqlConfig, value: string) => {
        setSqlConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleQueryChange = (type: ImportType, query: string) => {
        const existingQuery = importQueries.find(q => q.type === type);
        if (existingQuery) {
            setImportQueries(importQueries.map(q => q.type === type ? { ...q, query } : q));
        } else {
            setImportQueries([...importQueries, { type, query }]);
        }
    };
    
    /**
     * Saves all configuration changes made on the page to the database.
     */
    const handleSaveAllConfigs = async () => {
        setIsSaving(true);
        try {
            if (companyData) await saveCompanySettings(companyData);
            if (hasPermission('admin:import:sql-config')) {
                await saveSqlConfig(sqlConfig);
                await saveImportQueries(importQueries);
            }
            toast({ title: "Configuración Guardada", description: "Todos los ajustes de importación han sido guardados." });
            logInfo("Import settings saved.");
        } catch (error: any) {
            logError("Failed to save import settings", { error: error.message });
            toast({ title: "Error al Guardar", description: `No se pudieron guardar los ajustes. ${error.message}`, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Tests the connection to the SQL Server database with the provided credentials.
     */
    const handleTestConnection = async () => {
        setIsSaving(true);
        try {
            await testSqlConnection();
            toast({ title: "Conexión Exitosa", description: "Se pudo conectar a la base de datos SQL Server correctamente." });
        } catch (error: any) {
            toast({ title: "Error de Conexión", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Renders a card for a single file import type.
     * @param {ImportType} type The type of data this card is for.
     * @returns {JSX.Element} A card component for file import.
     */
    const renderFileImportCard = (type: ImportType) => {
        const fieldName = importTypeFieldMapping[type];
        return (
            <Card key={type} className="flex flex-col">
                <CardHeader>
                    <Label htmlFor={`${type}-path`}>{importTypeTranslations[type]}</Label>
                    <Input 
                        id={`${type}-path`}
                        placeholder={`Ej: C:\\import\\${type}.txt`}
                        value={companyData?.[fieldName] as string || ''}
                        onChange={(e) => handleCompanyDataChange(fieldName, e.target.value)} 
                    />
                </CardHeader>
                <CardFooter>
                    <Button type="button" onClick={() => handleImport(type)} disabled={isProcessing}>
                        {isProcessing && processingType === type ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        Procesar Archivo
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>Configuración de Importación de Datos</CardTitle>
                    <CardDescription>
                        Elige cómo el sistema obtiene los datos del ERP. Puedes usar archivos de texto o conectar directamente a una base de datos SQL Server.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="import-mode">Importar desde Archivos</Label>
                        <Switch
                          id="import-mode"
                          checked={companyData?.importMode === 'sql'}
                          onCheckedChange={(checked) => handleCompanyDataChange('importMode', checked ? 'sql' : 'file')}
                        />
                        <Label htmlFor="import-mode">Importar desde SQL Server</Label>
                    </div>
                </CardContent>
             </Card>
            
            {companyData?.importMode === 'file' && hasPermission('admin:import:files') && (
                <Card>
                    <CardHeader>
                        <CardTitle>Importación desde Archivos</CardTitle>
                        <CardDescription>
                           Procesa los archivos de datos (`.txt` o `.csv`) desde una ruta completa en el servidor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {importTypes.map(type => renderFileImportCard(type))}
                    </CardContent>
                </Card>
            )}

            {companyData?.importMode === 'sql' && hasPermission('admin:import:sql') && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Importación desde SQL Server</CardTitle>
                        <CardDescription>
                           Ejecuta todas las consultas SQL configuradas para traer los datos directamente desde el ERP a la base de datos local.
                        </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <Button type="button" onClick={handleFullSqlImport} disabled={isProcessing} size="lg">
                             {isProcessing && processingType === 'full-sql-import' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Database className="mr-2 h-5 w-5" />}
                            Importar Todos los Datos desde ERP
                        </Button>
                     </CardContent>
                </Card>
            )}

            {companyData?.importMode === 'sql' && hasPermission('admin:import:sql-config') && (
                <Accordion type="single" collapsible className="w-full" defaultValue="sql-config">
                    <AccordionItem value="sql-config">
                        <AccordionTrigger>
                            <CardTitle>Configuración de Conexión a SQL Server</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none">
                                <CardHeader className="pt-0">
                                    <CardDescription>
                                        Introduce los datos para conectar con la base de datos de tu ERP. Estos datos se guardan de forma segura en el archivo .env del servidor.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="sql-host">Servidor (Host o IP)</Label>
                                            <Input id="sql-host" value={sqlConfig.host || ''} onChange={e => handleSqlConfigChange('host', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sql-port">Puerto</Label>
                                            <Input id="sql-port" type="number" value={sqlConfig.port || ''} onChange={e => handleSqlConfigChange('port', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="sql-database">Nombre de Base de Datos</Label>
                                            <Input id="sql-database" value={sqlConfig.database || ''} onChange={e => handleSqlConfigChange('database', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="sql-user">Usuario</Label>
                                            <Input id="sql-user" value={sqlConfig.user || ''} onChange={e => handleSqlConfigChange('user', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="sql-password">Contraseña</Label>
                                            <Input id="sql-password" type="password" value={sqlConfig.password || ''} onChange={e => handleSqlConfigChange('password', e.target.value)} />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="button" onClick={handleTestConnection} disabled={isSaving} variant="secondary">
                                        {isSaving && processingType !== 'test-connection' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Probar Conexión
                                    </Button>
                                </CardFooter>
                             </Card>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="query-manager">
                        <AccordionTrigger>
                            <CardTitle>Gestión de Consultas SQL</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none">
                                 <CardHeader className="pt-0">
                                    <CardDescription>
                                        Define la consulta SELECT para cada tipo de dato. El sistema mapeará las columnas automáticamente según los nombres definidos en la documentación.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {importTypes.map(type => (
                                        <div key={type} className="space-y-2">
                                            <Label htmlFor={`query-${type}`}>Consulta para {importTypeTranslations[type]}</Label>
                                            <Textarea
                                                id={`query-${type}`}
                                                value={importQueries.find(q => q.type === type)?.query || ''}
                                                onChange={e => handleQueryChange(type, e.target.value)}
                                                placeholder={`SELECT ... FROM tu_tabla_de_${type}`}
                                                rows={4}
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                             </Card>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}

            <Card>
                <CardFooter>
                    <Button type="button" onClick={handleSaveAllConfigs} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Toda la Configuración
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}

    