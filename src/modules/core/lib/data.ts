/**
 * @fileoverview This file contains the initial or default data for the application.
 * This data is used to populate the database on its first run.
 * Spanish is used for UI-facing strings like names and descriptions.
 */

import type { Tool, User, Role, Company } from "@/modules/core/types";
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
  Boxes,
  Briefcase,
  Store,
  Search,
  Wrench,
  LayoutDashboard,
  Map,
  PackagePlus,
  BookMarked,
  MessageSquare,
  BarChartBig,
  Lightbulb,
  FileText,
  Calculator,
  Mail,
  UserCheck,
} from "lucide-react";

/**
 * The default user to be created in the database.
 * This ensures there is always at least one administrator.
 * @deprecated This is no longer used. The first user is created via the setup wizard.
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
    textColor: "text-white",
  },
  {
    id: "purchase-request",
    name: "Solicitud de Compra",
    description: "Crear y gestionar solicitudes de compra internas.",
    href: "/dashboard/requests",
    icon: ShoppingCart,
    bgColor: "bg-yellow-500",
    textColor: "text-white",
  },
  {
    id: "planner",
    name: "Planificador OP",
    description: "Gestionar y visualizar la carga de producción.",
    href: "/dashboard/planner",
    icon: CalendarCheck,
    bgColor: "bg-purple-500",
    textColor: "text-white",
  },
  {
    id: 'cost-assistant',
    name: 'Asistente de Costos',
    description: 'Calcular costos y precios a partir de facturas XML.',
    href: '/dashboard/cost-assistant',
    icon: Calculator,
    bgColor: 'bg-orange-500',
    textColor: 'text-white',
  },
   {
    id: "warehouse-search",
    name: "Consulta de Almacén",
    description: "Localizar artículos y ver existencias en el almacén.",
    href: "/dashboard/warehouse",
    icon: Warehouse,
    bgColor: "bg-cyan-600",
    textColor: "text-white",
  },
  {
    id: "warehouse-assign",
    name: "Asignar Inventario",
    description: "Mover inventario entre ubicaciones físicas.",
    href: "/dashboard/warehouse/assign",
    icon: PackagePlus,
    bgColor: "bg-teal-600",
    textColor: "text-white",
  },
  {
    id: "hacienda-query",
    name: "Consultas Hacienda",
    description: "Verificar situación tributaria y exoneraciones.",
    href: "/dashboard/hacienda",
    icon: Search,
    bgColor: "bg-blue-600",
    textColor: "text-white",
  },
  {
    id: "help",
    name: "Centro de Ayuda",
    description: "Consultar la documentación y guías de uso del sistema.",
    href: "/dashboard/help",
    icon: LifeBuoy,
    bgColor: "bg-orange-500",
    textColor: "text-white",
  },
];

/**
 * Default roles and their permissions.
 */
export const initialRoles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    permissions: [
        "dashboard:access",
        "quotes:create",
        "quotes:generate",
        "quotes:drafts:create",
        "quotes:drafts:read",
        "quotes:drafts:delete",
        "requests:read",
        "requests:read:all",
        "requests:create",
        "requests:create:duplicate",
        "requests:edit:pending",
        "requests:edit:approved",
        "requests:reopen",
        "requests:notes:add",
        "requests:status:review",
        "requests:status:pending-approval",
        "requests:status:approve",
        "requests:status:ordered",
        "requests:status:received-in-warehouse",
        "requests:status:entered-erp",
        "requests:status:cancel",
        "requests:status:unapproval-request",
        "requests:status:unapproval-request:approve",
        "requests:status:revert-to-approved",
        "planner:read",
        "planner:read:all",
        "planner:create",
        "planner:edit:pending",
        "planner:edit:approved",
        "planner:reopen",
        "planner:receive",
        "planner:status:approve",
        "planner:status:in-progress",
        "planner:status:on-hold",
        "planner:status:completed",
        "planner:status:cancel",
        "planner:status:cancel-approved",
        "planner:status:unapprove-request",
        "planner:status:unapprove-request:approve",
        "planner:priority:update",
        "planner:machine:assign",
        "planner:schedule",
        "analytics:read",
        "analytics:purchase-suggestions:read",
        "analytics:production-report:read",
        "analytics:user-permissions:read",
        "cost-assistant:access",
        "cost-assistant:drafts:read-write",
        "users:create",
        "users:read",
        "users:update",
        "users:delete",
        "roles:create",
        "roles:read",
        "roles:update",
        "roles:delete",
        "admin:settings:general",
        "admin:settings:api",
        "admin:settings:planner",
        "admin:settings:requests",
        "admin:settings:warehouse",
        "admin:settings:stock",
        "admin:settings:cost-assistant",
        "admin:suggestions:read",
        "admin:import:run",
        "admin:import:files",
        "admin:import:sql",
        "admin:import:sql-config",
        "admin:logs:read",
        "admin:logs:clear",
        "admin:maintenance:backup",
        "admin:maintenance:restore",
        "admin:maintenance:reset",
        "warehouse:access",
        "warehouse:inventory:assign",
        "warehouse:locations:manage",
        "hacienda:query",
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    permissions: ["dashboard:access", "quotes:create", "quotes:drafts:read"],
  },
  {
    id: 'planner-user',
    name: 'Planificador',
    permissions: [
        "dashboard:access",
        "planner:read",
        "planner:create",
        "planner:status:approve",
        "planner:status:in-progress",
        "planner:status:on-hold",
        "planner:status:completed",
        "planner:status:cancel",
        "planner:priority:update",
        "planner:machine:assign",
        "planner:schedule",
    ]
  },
   {
    id: 'requester-user',
    name: 'Solicitante',
    permissions: [
        "dashboard:access",
        "requests:read",
        "requests:create",
        "requests:status:review",
        "requests:status:cancel",
        "requests:notes:add",
    ]
  }
];

/**
 * List of all permissions that grant access to the admin section.
 */
export const adminPermissions = [
    "users:create", "users:read", "users:update", "users:delete",
    "roles:create", "roles:read", "roles:update", "roles:delete",
    "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:requests", "admin:settings:warehouse", "admin:settings:stock", "admin:settings:cost-assistant",
    "admin:suggestions:read",
    "admin:import:run", "admin:import:files", "admin:import:sql", "admin:import:sql-config",
    "admin:logs:read", "admin:logs:clear",
    "admin:maintenance:backup", "admin:maintenance:restore", "admin:maintenance:reset",
];

/**
 * List of all permissions that grant access to the analytics section.
 */
export const analyticsPermissions = [
    "analytics:read",
    "analytics:purchase-suggestions:read",
    "analytics:production-report:read",
    "analytics:user-permissions:read",
];


/**
 * List of tools available in the admin section.
 * The 'icon' property is now the imported icon component.
 */
export const adminTools: Tool[] = [
    {
        id: "user-management",
        name: "Gestión de Usuarios",
        description: "Añadir, editar y gestionar usuarios y sus roles.",
        href: "/dashboard/admin/users",
        icon: Users,
        bgColor: "bg-blue-500",
        textColor: "text-white",
      },
      {
        id: "role-management",
        name: "Gestión de Roles",
        description: "Definir roles y asignar permisos granulares.",
        href: "/dashboard/admin/roles",
        icon: ShieldCheck,
        bgColor: "bg-green-500",
        textColor: "text-white",
      },
      {
        id: "general-settings",
        name: "Configuración General",
        description: "Gestionar los datos de la empresa y logo.",
        href: "/dashboard/admin/general",
        icon: Briefcase,
        bgColor: "bg-orange-500",
        textColor: "text-white",
      },
      {
        id: "email-settings",
        name: "Configuración de Correo",
        description: "Ajustes del servidor SMTP para enviar correos.",
        href: "/dashboard/admin/email",
        icon: Mail,
        bgColor: "bg-purple-600",
        textColor: "text-white",
      },
      {
        id: "suggestions-viewer",
        name: "Buzón de Sugerencias",
        description: "Revisar el feedback enviado por los usuarios del sistema.",
        href: "/dashboard/admin/suggestions",
        icon: MessageSquare,
        bgColor: "bg-green-600",
        textColor: "text-white",
      },
      {
        id: "quoter-settings",
        name: "Config. Cotizador",
        description: "Gestionar prefijos y consecutivos del cotizador.",
        href: "/dashboard/admin/quoter", 
        icon: BookMarked,
        bgColor: "bg-emerald-600",
        textColor: "text-white",
      },
      {
        id: "cost-assistant-settings",
        name: "Config. Asist. Costos",
        description: "Gestionar ajustes para el asistente de costos.",
        href: "/dashboard/admin/cost-assistant",
        icon: Calculator,
        bgColor: "bg-orange-500",
        textColor: "text-white",
      },
      {
        id: "import-data",
        name: "Importar Datos",
        description: "Cargar clientes, productos, exoneraciones y...",
        href: "/dashboard/admin/import",
        icon: FileUp,
        bgColor: "bg-cyan-700",
        textColor: "text-white",
      },
       {
        id: "maintenance",
        name: "Mantenimiento",
        description: "Backup, restauración y reseteo del sistema.",
        href: "/dashboard/admin/maintenance",
        icon: ServerCog,
        bgColor: "bg-red-600",
        textColor: "text-white",
      },
      {
        id: "api-settings",
        name: "Configuración de API",
        description: "Gestionar URLs y claves de APIs externas.",
        href: "/dashboard/admin/api",
        icon: Network,
        bgColor: "bg-indigo-700",
        textColor: "text-white",
      },
       {
        id: "planner-settings",
        name: "Config. Planificador",
        description: "Gestionar máquinas y otros ajustes del...",
        href: "/dashboard/admin/planner",
        icon: Factory,
        bgColor: "bg-purple-700",
        textColor: "text-white",
      },
       {
        id: "requests-settings",
        name: "Config. Compras",
        description: "Gestionar rutas y otros ajustes de compras.",
        href: "/dashboard/admin/requests",
        icon: Store,
        bgColor: "bg-amber-700",
        textColor: "text-white",
      },
      {
        id: "warehouse-settings",
        name: "Config. Almacenes",
        description: "Definir niveles y estructura de ubicaciones físicas.",
        href: "/dashboard/admin/warehouse",
        icon: Map,
        bgColor: "bg-teal-700",
        textColor: "text-white",
      },
      {
        id: "stock-settings",
        name: "Config. Inventario",
        description: "Gestionar bodegas y ajustes de existencias.",
        href: "/dashboard/admin/stock",
        icon: Boxes,
        bgColor: "bg-green-700",
        textColor: "text-white",
      },
      {
        id: "log-viewer",
        name: "Visor de Eventos",
        description: "Revisar los registros y errores del sistema.",
        href: "/dashboard/admin/logs",
        icon: FileTerminal,
        bgColor: "bg-slate-600",
        textColor: "text-white",
      }
];

export const analyticsTools: Tool[] = [
    {
        id: "purchase-suggestions",
        name: "Sugerencias de Compra",
        description: "Analizar pedidos y stock para sugerir compras proactivas.",
        href: "/dashboard/analytics/purchase-suggestions",
        icon: Lightbulb,
        bgColor: "bg-blue-600",
        textColor: "text-white",
    },
    {
        id: "production-report",
        name: "Reporte de Producción",
        description: "Analizar rendimiento y desperdicio de órdenes completadas.",
        href: "/dashboard/analytics/production-report",
        icon: BarChartBig,
        bgColor: "bg-indigo-500",
        textColor: "text-white",
    },
    {
        id: "user-permissions",
        name: "Reporte de Permisos",
        description: "Auditar los permisos asignados a cada usuario según su rol.",
        href: "/dashboard/analytics/user-permissions",
        icon: UserCheck,
        bgColor: "bg-fuchsia-600",
        textColor: "text-white",
    },
];


/**
 * A combined list of all tools for easy access.
 */
export const allTools: Tool[] = [...mainTools, ...adminTools, ...analyticsTools];
