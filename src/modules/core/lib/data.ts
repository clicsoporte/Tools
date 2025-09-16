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
  Building,
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
} from "lucide-react";

/**
 * The default user to be created in the database.
 * This ensures there is always at least one administrator.
 */
export const initialUsers: User[] = [
  {
    id: 1,
    name: "Jonathan Ugalde G",
    email: "jonathan@clicsoporte.com",
    password: "LGnexus4*",
    phone: "+(506) 1111-2222",
    whatsapp: "+(506) 1111-2222",
    avatar: "", // Intentionally blank, will use fallback
    role: "admin",
    recentActivity: "Usuario administrador principal.",
    securityQuestion: "¿Cuál es el nombre de mi primera mascota?",
    securityAnswer: "fido",
  },
];

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
    customerFilePath: "",
    productFilePath: "",
    exemptionFilePath: "",
    stockFilePath: "",
    locationFilePath: "",
    importMode: "file",
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
    description: "Mover y asignar artículos a ubicaciones físicas.",
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
        "requests:create",
        "requests:edit:pending",
        "requests:edit:approved",
        "requests:reopen",
        "requests:status:approve",
        "requests:status:ordered",
        "requests:status:received",
        "requests:status:cancel",
        "planner:read",
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
        "planner:priority:update",
        "planner:machine:assign",
        "analytics:read",
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
    ]
  },
   {
    id: 'requester-user',
    name: 'Solicitante',
    permissions: [
        "dashboard:access",
        "requests:read",
        "requests:create",
    ]
  }
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
        description: "Gestionar los datos de la empresa y consecutivos.",
        href: "/dashboard/admin/general",
        icon: Briefcase,
        bgColor: "bg-orange-500",
        textColor: "text-white",
      },
      {
        id: "import-data",
        name: "Importar Datos",
        description: "Cargar clientes, productos, exoneraciones y existencias.",
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
        description: "Gestionar máquinas y otros ajustes del planificador.",
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


/**
 * A combined list of all tools for easy access.
 */
export const allTools: Tool[] = [...mainTools, ...adminTools];

    
