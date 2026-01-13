/**
 * @fileoverview Page for the Inventory Correction tool.
 * Allows supervisors to correct receiving errors by changing the product associated with an inventory unit.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, RotateCcw, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCorrectionTool } from '@/modules/warehouse/hooks/useCorrectionTool';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CorrectionPage() {
    const { isAuthorized } = useAuthorization(['warehouse:correction:execute']);
    usePageTitle("Administración de Ingresos");

    const { state, actions, selectors } = useCorrectionTool();
    const {
        isLoading,
        isSearching,
        isSubmitting,
        searchTerm,
        searchResult,
        unitToCorrect,
        isConfirmModalOpen,
        newProductSearch,
        isNewProductSearchOpen,
        newSelectedProduct,
        confirmStep,
        confirmText,
    } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        )
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500 text-white">
                                <RotateCcw className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>Administración de Ingresos</CardTitle>
                                <CardDescription>Busca una unidad de inventario por su ID único para corregir el producto asociado.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ingresa el ID de la unidad (ej: U00030) o Lote/ID Físico"
                                    value={searchTerm}
                                    onChange={(e) => actions.setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && actions.handleSearch()}
                                    className="pl-9 h-11 text-base"
                                />
                            </div>
                            <Button onClick={actions.handleSearch} disabled={isSearching || !searchTerm}>
                                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                                Buscar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {searchResult && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado de la Búsqueda</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>ID de Unidad</Label>
                                    <p className="font-mono text-lg font-semibold">{searchResult.unit.unitCode}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Producto Actual</Label>
                                    <p>{searchResult.product.description} <span className="text-muted-foreground">({searchResult.product.id})</span></p>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Ubicación</Label>
                                    <p className="text-sm">{selectors.renderLocationPath(searchResult.unit.locationId)}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Cantidad</Label>
                                    <p>{searchResult.unit.quantity}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Lote / ID Físico</Label>
                                    <p>{searchResult.unit.humanReadableId || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label>Fecha de Creación</Label>
                                    <p>{format(parseISO(searchResult.unit.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })} por {searchResult.unit.createdBy}</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={() => actions.setUnitToCorrect(searchResult.unit)}>
                                <RotateCcw className="mr-2 h-4 w-4"/>
                                Iniciar Corrección
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {isSearching && <div className="text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto"/></div>}
            </div>

            <Dialog open={isConfirmModalOpen} onOpenChange={actions.handleModalOpenChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive"/>
                            Confirmar Corrección de Ingreso
                        </DialogTitle>
                        <DialogDescription>
                            Estás a punto de realizar un cambio irreversible en el inventario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                            <h4 className="font-semibold">Unidad Original</h4>
                             <p className="text-sm"><strong>ID:</strong> {unitToCorrect?.unitCode}</p>
                            <p className="text-sm"><strong>Producto:</strong> {selectors.getOriginalProductName()}</p>
                            <p className="text-sm"><strong>Ubicación:</strong> {selectors.getOriginalLocationPath()}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-product-search" className="font-semibold">Producto Correcto</Label>
                            <SearchInput
                                id="new-product-search"
                                options={selectors.productOptions}
                                onSelect={actions.handleSelectNewProduct}
                                value={newProductSearch}
                                onValueChange={actions.setNewProductSearch}
                                open={isNewProductSearchOpen}
                                onOpenChange={actions.setNewProductSearchOpen}
                                placeholder="Buscar nuevo producto..."
                            />
                        </div>
                         {newSelectedProduct && (
                            <>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="confirm-step-1" onCheckedChange={(checked) => actions.setConfirmStep(checked ? 1 : 0)} />
                                    <Label htmlFor="confirm-step-1" className="font-medium text-destructive">
                                        Entiendo que esta acción es irreversible y generará nuevos movimientos de inventario.
                                    </Label>
                                </div>
                                {confirmStep >= 1 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-text">Para confirmar, escribe &quot;CORREGIR&quot;:</Label>
                                        <Input
                                            id="confirm-text"
                                            value={confirmText}
                                            onChange={(e) => {
                                                actions.setConfirmText(e.target.value.toUpperCase());
                                                if (e.target.value.toUpperCase() === 'CORREGIR') {
                                                    actions.setConfirmStep(2);
                                                } else {
                                                    actions.setConfirmStep(1);
                                                }
                                            }}
                                            className="border-destructive focus-visible:ring-destructive"
                                        />
                                    </div>
                                )}
                            </>
                         )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button
                            variant="destructive"
                            onClick={actions.handleConfirmCorrection}
                            disabled={isSubmitting || confirmStep !== 2}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <CheckCircle className="mr-2"/>}
                            Ejecutar Corrección
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}
```
  <change>
    <file>src/modules/core/lib/data.ts</file>
    <content><![CDATA[/**
 * @fileoverview This file contains the initial or default data for the application.
 * This data is used to populate the database on its first run.
 * Spanish is used for UI-facing strings like names and descriptions.
 */

import type { Tool, User, Role, Company, DatabaseModule } from "@/modules/core/types";
import {
  Users,
  Sheet,
  Network,
  ShieldCheck,
  FileTerminal,
  FileUp,
  LifeBuoy,
  ServerCog,
  CalendarCheck,
  Factory,
  ShoppingCart,
  Warehouse,
  Briefcase,
  Store,
  Search,
  Wrench,
  LayoutDashboard,
  Map,
  PackagePlus,
  MessageSquare,
  BarChartBig,
  Lightbulb,
  FileText,
  Calculator,
  Mail,
  UserCheck,
  Truck,
  QrCode,
  ClipboardCheck,
  Wand2,
  Lock,
  PackageCheck,
  ClipboardList,
  Tags,
  RotateCcw,
} from "lucide-react";
import { allAdminPermissions } from "./permissions";

/**
 * The default user to be created in the database.
 * This is no longer used. The first user is created via the setup wizard.
 */
export const initialUsers: User[] = [];

/**
 * Initial company data for the general settings.
 */
export const initialCompany: Company = {
    name: "CLIC SOPORTE Y CLIC TIENDA S.R.L",
    taxId: "3102894538",
    address: "San José, Costa Rica",
    phone: "+50640000630",
    email: "facturacion@clicsoporte.com",
    systemName: "Clic-Tools",
    publicUrl: "",
    quotePrefix: "COT-",
    nextQuoteNumber: 1,
    decimalPlaces: 2,
    quoterShowTaxId: true,
    searchDebounceTime: 500,
    syncWarningHours: 12,
    importMode: 'file',
    lastSyncTimestamp: null,
    customerFilePath: "",
    productFilePath: "",
    exemptionFilePath: "",
    stockFilePath: "",
    locationFilePath: "",
    cabysFilePath: "",
    supplierFilePath: "",
    erpPurchaseOrderHeaderFilePath: "",
    erpPurchaseOrderLineFilePath: ""
};

/**
 * List of tools available on the main dashboard.
 */
export const mainTools: Tool[] = [
  {
    id: "quoter",
    name: "Cotizador",
    description: "Crear y gestionar cotizaciones para clientes.",
    href: "/dashboard/quoter",
    icon: Sheet,
    bgColor: "bg-green-500",
  },
  {
    id: "purchase-request",
    name: "Solicitud de Compra",
    description: "Crear y gestionar solicitudes de compra internas.",
    href: "/dashboard/requests",
    icon: ShoppingCart,
    bgColor: "bg-amber-700",
  },
   {
    id: "planner",
    name: "Planificador OP",
    description: "Gestionar y visualizar la carga de producción.",
    href: "/dashboard/planner",
    icon: CalendarCheck,
    bgColor: "bg-purple-700",
  },
  {
    id: 'cost-assistant',
    name: 'Asistente de Costos',
    description: 'Calcular costos y precios a partir de facturas XML.',
    href: '/dashboard/cost-assistant',
    icon: Calculator,
    bgColor: 'bg-orange-600',
  },
   {
    id: "warehouse",
    name: "Almacén",
    description: "Consultar ubicaciones, gestionar unidades y registrar conteos.",
    href: "/dashboard/warehouse",
    icon: Warehouse,
    bgColor: "bg-cyan-600",
  },
     {
      id: "hacienda-query",
      name: "Consultas Hacienda",
      description: "Verificar situación tributaria y exoneraciones.",
      href: "/dashboard/hacienda",
      icon: Search,
      bgColor: "bg-fuchsia-600",
    },
  {
    id: "help",
    name: "Centro de Ayuda",
    description: "Consultar la documentación y guías de uso del sistema.",
    href: "/dashboard/help",
    icon: LifeBuoy,
    bgColor: "bg-blue-700",
  },
];


export const warehouseTools: Tool[] = [
    {
        id: "warehouse-search-simple",
        name: "Búsqueda Rápida",
        description: "Escanear o buscar un artículo para una consulta rápida.",
        href: "/dashboard/warehouse/search/simple",
        icon: QrCode,
        bgColor: 'bg-sky-600',
    },
    {
        id: "warehouse-search",
        name: "Consulta de Almacén",
        description: "Localizar artículos, clientes y unidades de inventario.",
        href: "/dashboard/warehouse/search",
        icon: Search,
        bgColor: 'bg-blue-600',
    },
    {
        id: 'receiving-wizard',
        name: 'Asistente de Recepción',
        description: 'Registrar producto terminado o compras y generar etiquetas.',
        href: '/dashboard/warehouse/receiving',
        icon: PackageCheck,
        bgColor: 'bg-emerald-600',
    },
    {
        id: 'population-wizard',
        name: 'Asistente de Poblado',
        description: 'Poblar masivamente las ubicaciones de un rack de forma guiada.',
        href: '/dashboard/warehouse/population-wizard',
        icon: Wand2,
        bgColor: 'bg-indigo-500',
    },
     {
        id: "assign-item",
        name: "Ubicaciones por Producto",
        description: "Asociar productos a clientes y ubicaciones de forma permanente.",
        href: "/dashboard/warehouse/assign",
        icon: PackagePlus,
        bgColor: 'bg-teal-600',
    },
    {
        id: "inventory-count",
        name: "Toma de Inventario Físico",
        description: "Registrar conteos físicos de productos en ubicaciones específicas.",
        href: "/dashboard/warehouse/inventory-count",
        icon: ClipboardCheck,
        bgColor: 'bg-lime-600',
    },
    {
        id: 'correction-tool',
        name: 'Administración de Ingresos',
        description: 'Corregir un producto mal ingresado, moviendo su unidad de inventario.',
        href: '/dashboard/warehouse/correction',
        icon: RotateCcw,
        bgColor: 'bg-red-500'
    },
    {
        id: 'label-center',
        name: 'Centro de Etiquetas',
        description: 'Generar e imprimir etiquetas de ubicación o de productos por lotes.',
        href: '/dashboard/warehouse/labels',
        icon: Tags,
        bgColor: 'bg-orange-500'
    },
    {
        id: "warehouse-units",
        name: "Gestión de Lotes/Tarimas",
        description: "Crear y etiquetar unidades de inventario (lotes/tarimas).",
        href: "/dashboard/warehouse/units",
        icon: QrCode,
        bgColor: 'bg-cyan-700',
    },
    {
        id: "warehouse-locations",
        name: "Gestionar Ubicaciones",
        description: "Definir la jerarquía y crear las ubicaciones físicas del almacén.",
        href: "/dashboard/warehouse/locations",
        icon: Map,
        bgColor: 'bg-purple-600',
    },
    {
        id: 'lock-management',
        name: 'Gestionar Bloqueos',
        description: 'Ver y liberar racks o niveles que están siendo editados.',
        href: '/dashboard/warehouse/locks',
        icon: Lock,
        bgColor: 'bg-slate-500',
    }
];

/**
 * Default roles and their permissions.
 * The 'viewer' role has been removed. Only the 'admin' role is defined by default.
 */
export const initialRoles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    permissions: allAdminPermissions,
  },
];


/**
 * List of tools available in the admin section.
 */
export const adminTools: Tool[] = [
    {
        id: "users:read",
        name: "Gestión de Usuarios",
        description: "Añadir, editar y gestionar usuarios y sus roles.",
        href: "/dashboard/admin/users",
        icon: Users,
        bgColor: 'bg-blue-500',
      },
      {
        id: "roles:read",
        name: "Gestión de Roles",
        description: "Definir roles y asignar permisos granulares.",
        href: "/dashboard/admin/roles",
        icon: ShieldCheck,
        bgColor: 'bg-green-600',
      },
      {
        id: "admin:settings:general",
        name: "Configuración General",
        description: "Gestionar los datos de la empresa y logo.",
        href: "/dashboard/admin/general",
        icon: Briefcase,
        bgColor: 'bg-orange-500',
      },
      {
        id: "admin:settings:email",
        name: "Configuración de Correo",
        description: "Ajustes del servidor SMTP para enviar correos.",
        href: "/dashboard/admin/email",
        icon: Mail,
        bgColor: 'bg-purple-600',
      },
      {
        id: "admin:suggestions:read",
        name: "Buzón de Sugerencias",
        description: "Revisar el feedback enviado por los usuarios del sistema.",
        href: "/dashboard/admin/suggestions",
        icon: MessageSquare,
        bgColor: 'bg-green-700',
      },
      {
        id: "admin:settings:quoter",
        name: "Config. Cotizador",
        description: "Gestionar prefijos y consecutivos del cotizador.",
        href: "/dashboard/admin/quoter", 
        icon: Sheet,
        bgColor: 'bg-blue-600',
      },
      {
        id: "admin:settings:cost-assistant",
        name: "Config. Asist. Costos",
        description: "Gestionar ajustes para el asistente de costos.",
        href: "/dashboard/admin/cost-assistant",
        icon: Calculator,
        bgColor: 'bg-orange-500',
      },
      {
        id: "admin:import:run",
        name: "Importar Datos",
        description: "Cargar clientes, productos, exoneraciones y...",
        href: "/dashboard/admin/import",
        icon: FileUp,
        bgColor: 'bg-cyan-700',
      },
       {
        id: "admin:maintenance:backup",
        name: "Mantenimiento",
        description: "Backup, restauración y reseteo del sistema.",
        href: "/dashboard/admin/maintenance",
        icon: ServerCog,
        bgColor: 'bg-red-600',
      },
      {
        id: "admin:settings:api",
        name: "Configuración de API",
        description: "Gestionar URLs y claves de APIs externas.",
        href: "/dashboard/admin/api",
        icon: Network,
        bgColor: 'bg-indigo-500',
      },
       {
        id: "admin:settings:planner",
        name: "Config. Planificador",
        description: "Gestionar máquinas y otros ajustes del...",
        href: "/dashboard/admin/planner",
        icon: Factory,
        bgColor: 'bg-slate-600',
      },
       {
        id: "admin:settings:requests",
        name: "Config. Compras",
        description: "Gestionar rutas y otros ajustes de compras.",
        href: "/dashboard/admin/requests",
        icon: Store,
        bgColor: 'bg-amber-700',
      },
      {
        id: "admin:settings:warehouse",
        name: "Config. Almacenes e Inventario",
        description: "Gestionar bodegas, unidades y jerarquía del almacén.",
        href: "/dashboard/admin/warehouse",
        icon: Wrench,
        bgColor: 'bg-purple-600',
      },
      {
        id: "admin:logs:read",
        name: "Visor de Eventos",
        description: "Revisar los registros y errores del sistema.",
        href: "/dashboard/admin/logs",
        icon: FileTerminal,
        bgColor: 'bg-gray-500',
      }
];

export const analyticsTools: Tool[] = [
    {
        id: "analytics:purchase-suggestions:read",
        name: "Sugerencias de Compra",
        description: "Analizar pedidos y stock para sugerir compras proactivas.",
        href: "/dashboard/analytics/purchase-suggestions",
        icon: Lightbulb,
        bgColor: "bg-blue-600",
    },
    {
        id: "analytics:purchase-report:read",
        name: "Reporte de Compras",
        description: "Visualizar y exportar un reporte histórico de compras.",
        href: "/dashboard/analytics/purchase-report",
        icon: FileText,
        bgColor: "bg-green-600",
    },
     {
        id: "analytics:transits-report:read",
        name: "Reporte de Tránsitos",
        description: "Monitorear órdenes de compra del ERP activas y en tránsito.",
        href: "/dashboard/analytics/transits-report",
        icon: Truck,
        bgColor: "bg-orange-500",
    },
    {
        id: "analytics:production-report:read",
        name: "Reporte de Producción",
        description: "Analizar rendimiento y desperdicio de órdenes completadas.",
        href: "/dashboard/analytics/production-report",
        icon: BarChartBig,
        bgColor: "bg-purple-600",
    },
    {
        id: "analytics:physical-inventory-report:read",
        name: "Reporte de Inventario Físico",
        description: "Comparar conteos físicos con el stock del ERP para encontrar diferencias.",
        href: "/dashboard/analytics/physical-inventory-report",
        icon: ClipboardCheck,
        bgColor: "bg-cyan-600",
    },
    {
        id: "analytics:receiving-report:read",
        name: "Reporte de Recepciones",
        description: "Auditar las recepciones de mercadería registradas en el sistema.",
        href: "/dashboard/analytics/receiving-report",
        icon: ClipboardList,
        bgColor: "bg-teal-600",
    },
    {
        id: "analytics:user-permissions:read",
        name: "Reporte de Permisos",
        description: "Auditar los permisos asignados a cada usuario según su rol.",
        href: "/dashboard/analytics/user-permissions",
        icon: UserCheck,
        bgColor: "bg-slate-600",
    },
];


/**
 * A combined list of all tools for easy access.
 */
export const allTools: Tool[] = [...mainTools, ...adminTools, ...analyticsTools];
```