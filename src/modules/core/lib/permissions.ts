/**
 * @fileoverview This file centralizes all permission-related constants and logic.
 * Separating this from data.ts breaks a problematic dependency cycle.
 */

export const allAdminPermissions = [
    "admin:access",
    "dashboard:access", "quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete",
    "requests:read", "requests:read:all", "requests:create", "requests:create:duplicate", "requests:edit:pending", "requests:edit:approved", "requests:reopen", "requests:notes:add",
    "requests:view:sale-price", "requests:view:cost", "requests:view:margin",
    "requests:status:review", "requests:status:pending-approval", "requests:status:approve", "requests:status:ordered", "requests:status:received-in-warehouse", "requests:status:entered-erp", "requests:status:cancel", "requests:status:unapproval-request", "requests:status:unapproval-request:approve", "requests:status:revert-to-approved",
    "planner:read", "planner:read:all", "planner:create", "planner:edit:pending", "planner:edit:approved", "planner:reopen", "planner:receive", "planner:status:review", "planner:status:approve", "planner:status:in-progress", "planner:status:on-hold", 
    "planner:status:completed", "planner:status:cancel", "planner:status:cancel-approved", "planner:status:unapprove-request", "planner:status:unapprove-request:approve",
    "planner:priority:update", "planner:machine:assign", "planner:schedule",
    "cost-assistant:access", "cost-assistant:drafts:read-write",
    "consignments:access", "consignments:setup", "consignments:count", "consignments:boletas:read", "consignments:boletas:read:all", "consignments:boleta:approve", "consignments:boleta:send", "consignments:boleta:invoice", "consignments:boleta:cancel", "consignments:boleta:revert", "consignments:reports:read", "consignments:locks:manage",
    "warehouse:access", "warehouse:search:full", "warehouse:search:simple", 
    "warehouse:receiving-wizard:use", "warehouse:population-wizard:use", "warehouse:inventory-count:create",
    "warehouse:item-assignment:create", "warehouse:item-assignment:delete",
    "warehouse:locations:create", "warehouse:locations:update", "warehouse:locations:delete",
    "warehouse:units:create", "warehouse:units:delete", "warehouse:locks:manage",
    "warehouse:correction:execute", "warehouse:correction:apply", "warehouse:labels:generate",
    "hacienda:query",
    "operations:access", "operations:create", "operations:read:all", "operations:approve", "operations:sign",
    "it-tools:access", "it-tools:notes:read", "it-tools:notes:create", "it-tools:notes:update", "it-tools:notes:delete",
    "analytics:read", "analytics:purchase-suggestions:read", "analytics:purchase-report:read", "analytics:production-report:read", "analytics:transits-report:read", "analytics:user-permissions:read", "analytics:physical-inventory-report:read", "analytics:receiving-report:read", "analytics:item-assignments-report:read", "analytics:occupancy-report:read", "analytics:consignments-report:read",
    "users:create", "users:read", "users:update", "users:delete",
    "roles:create", "roles:read", "roles:update", "roles:delete", "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:requests", "admin:settings:warehouse", "admin:settings:stock", "admin:settings:cost-assistant", "admin:settings:analytics", "admin:settings:consignments",
    "admin:suggestions:read",
    "admin:import:run", "admin:import:files", "admin:import:sql", "admin:import:sql-config",
    "admin:logs:read", "admin:logs:clear",
    "admin:maintenance:backup", "admin:maintenance:restore", "admin:maintenance:reset"
];

export const permissionGroups = {
    "Acceso General": ["dashboard:access"],
    "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
    "Solicitud de Compra (Lectura y Creación)": ["requests:read", "requests:read:all", "requests:create", "requests:create:duplicate", "requests:notes:add"],
    "Solicitud de Compra (Edición y Flujo)": ["requests:edit:pending", "requests:edit:approved", "requests:status:review", "requests:status:pending-approval"],
    "Solicitud de Compra (Acciones de Aprobador)": ["requests:reopen", "requests:status:approve", "requests:status:ordered", "requests:status:received-in-warehouse", "requests:status:entered-erp", "requests:status:cancel", "requests:status:revert-to-approved", "requests:status:unapproval-request", "requests:status:unapproval-request:approve"],
    "Solicitud de Compra (Finanzas)": ["requests:view:sale-price", "requests:view:cost", "requests:view:margin"],
    "Planificador de Producción (Lectura y Creación)": ["planner:read", "planner:read:all", "planner:create"],
    "Planificador de Producción (Edición y Acciones)": ["planner:edit:pending", "planner:edit:approved", "planner:reopen", "planner:receive", "planner:status:review", "planner:status:approve", "planner:status:in-progress", "planner:status:on-hold", 
    "planner:status:completed", "planner:status:cancel", "planner:status:cancel-approved", "planner:status:unapprove-request", "planner:status:unapprove-request:approve", "planner:priority:update", "planner:machine:assign", "planner:schedule"],
    "Asistente de Costos": ["cost-assistant:access", "cost-assistant:drafts:read-write"],
    "Consignación (General)": ["consignments:access", "consignments:setup", "consignments:count", "consignments:reports:read", "consignments:locks:manage"],
    "Consignación (Flujo de Boletas)": ["consignments:boletas:read", "consignments:boletas:read:all", "consignments:boleta:approve", "consignments:boleta:send", "consignments:boleta:invoice", "consignments:boleta:cancel", "consignments:boleta:revert"],
    "Centro de Operaciones y Trazabilidad (Nuevo)": ["operations:access", "operations:create", "operations:read:all", "operations:approve", "operations:sign"],
    "Herramientas de TI (Nuevo)": ["it-tools:access", "it-tools:notes:read", "it-tools:notes:create", "it-tools:notes:update", "it-tools:notes:delete"],
    "Gestión de Almacenes": [
        "warehouse:access", "warehouse:search:full", "warehouse:search:simple",
        "warehouse:receiving-wizard:use", "warehouse:population-wizard:use", "warehouse:inventory-count:create",
        "warehouse:item-assignment:create", "warehouse:item-assignment:delete",
        "warehouse:locations:create", "warehouse:locations:update", "warehouse:locations:delete",
        "warehouse:units:create", "warehouse:units:delete", "warehouse:locks:manage",
        "warehouse:correction:execute", "warehouse:correction:apply", "warehouse:labels:generate"
    ],
    "Consultas Hacienda": ["hacienda:query"],
    "Analíticas y Reportes": ["analytics:read", "analytics:purchase-suggestions:read", "analytics:purchase-report:read", "analytics:production-report:read", "analytics:transits-report:read", "analytics:user-permissions:read", "analytics:physical-inventory-report:read", "analytics:receiving-report:read", "analytics:item-assignments-report:read", "analytics:occupancy-report:read", "analytics:consignments-report:read"],
    "Gestión de Usuarios": ["users:create", "users:read", "users:update", "users:delete"],
    "Gestión de Roles": ["roles:create", "roles:read", "roles:update", "roles:delete"],
    "Administración del Sistema": [
        "admin:access",
        "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:requests", "admin:settings:warehouse", "admin:settings:stock", "admin:settings:cost-assistant", "admin:settings:analytics", "admin:settings:consignments",
        "admin:suggestions:read",
        "admin:import:run", "admin:import:files", "admin:import:sql", "admin:import:sql-config",
        "admin:logs:read", "admin:logs:clear",
        "admin:maintenance:backup", "admin:maintenance:restore", "admin:maintenance:reset"
    ],
};

export const analyticsPermissions = permissionGroups["Analíticas y Reportes"];

export const permissionTranslations: { [key: string]: string } = {
    "admin:access": "Acceso a Configuración",
    "dashboard:access": "Acceso al Panel", "quotes:create": "Cotizador: Crear", "quotes:generate": "Cotizador: Generar PDF", "quotes:drafts:create": "Borradores: Crear", "quotes:drafts:read": "Borradores: Cargar", "quotes:drafts:delete": "Borradores: Eliminar",
    "requests:read": "Compras: Leer", "requests:read:all": "Compras: Leer Todo", "requests:create": "Compras: Crear", "requests:create:duplicate": "Compras: Crear Duplicados", "requests:notes:add": "Compras: Añadir Notas",
    "requests:edit:pending": "Compras: Editar (Pendientes)", "requests:edit:approved": "Compras: Editar (Aprobadas)", "requests:status:review": "Compras: Enviar a Revisión", "requests:status:pending-approval": "Compras: Enviar a Aprobación", "requests:reopen": "Compras: Reabrir", "requests:status:approve": "Compras: Aprobar", "requests:status:ordered": "Compras: Marcar como Ordenada", "requests:status:received-in-warehouse": "Compras: Recibir en Bodega", "requests:status:entered-erp": "Compras: Ingresar a ERP", "requests:status:cancel": "Compras: Cancelar", "requests:status:revert-to-approved": "Compras: Revertir a Aprobada", "requests:status:unapproval-request": "Compras: Solicitar Desaprobación", "requests:status:unapproval-request:approve": "Compras: Aprobar Desaprobación",
    "requests:view:sale-price": "Compras: Ver Precio Venta", "requests:view:cost": "Compras: Ver Costo", "requests:view:margin": "Compras: Ver Margen",
    "planner:read": "Plan.: Leer Órdenes", "planner:read:all": "Plan.: Leer Todas las Órdenes", "planner:create": "Plan.: Crear Órdenes",
    "planner:edit:pending": "Plan.: Editar (Pendientes)", "planner:edit:approved": "Plan.: Editar (Aprobadas)", "planner:reopen": "Plan.: Reabrir Órdenes", "planner:receive": "Plan.: Recibir en Bodega", "planner:status:review": "Plan.: Enviar a Revisión", "planner:status:approve": "Plan.: Cambiar a Aprobada", "planner:status:in-progress": "Plan.: Cambiar a En Progreso", "planner:status:on-hold": "Plan.: Cambiar a En Espera", 
    "planner:status:completed": "Plan.: Cambiar a Completada", "planner:status:cancel": "Plan.: Cancelar (Pendientes)", "planner:status:cancel-approved": "Plan.: Cancelar (Aprobadas)", "planner:priority:update": "Plan.: Cambiar Prioridad", "planner:machine:assign": "Plan.: Asignar Máquina", "planner:status:unapprove-request": "Plan.: Solicitar Desaprobación", "planner:status:unapprove-request:approve": "Plan.: Aprobar Desaprobación", "planner:schedule": "Plan.: Programar Fechas",
    "cost-assistant:access": "Asist. Costos: Acceso", "cost-assistant:drafts:read-write": "Asist. Costos: Guardar Borradores",
    "consignments:access": "Consignación: Acceso General", "consignments:setup": "Consignación: Configurar Acuerdos", "consignments:count": "Consignación: Realizar Conteos", "consignments:reports:read": "Consignación: Ver Reportes", "consignments:locks:manage": "Consignación: Gestionar Bloqueos",
    "consignments:boletas:read": "Consignación: Ver Lista de Boletas", "consignments:boletas:read:all": "Consignación: Ver Todas las Boletas", "consignments:boleta:approve": "Consignación: Aprobar Boletas", "consignments:boleta:send": "Consignación: Marcar como Enviada", "consignments:boleta:invoice": "Consignación: Marcar como Facturada", "consignments:boleta:cancel": "Consignación: Cancelar Boletas", "consignments:boleta:revert": "Consignación: Revertir Estados de Boleta",
    "operations:access": "Operaciones: Acceso General", "operations:create": "Operaciones: Crear Documentos", "operations:read:all": "Operaciones: Ver Todos", "operations:approve": "Operaciones: Aprobar Documentos", "operations:sign": "Operaciones: Firmar Entregas/Recibos",
    "it-tools:access": "TI: Acceso General", "it-tools:notes:read": "TI: Ver Notas", "it-tools:notes:create": "TI: Crear Notas", "it-tools:notes:update": "TI: Editar Notas", "it-tools:notes:delete": "TI: Eliminar Notas",
    "warehouse:access": "Almacén: Acceso General", "warehouse:search:full": "Almacén: Consulta Completa", "warehouse:search:simple": "Almacén: Búsqueda Rápida", 
    "warehouse:receiving-wizard:use": "Almacén: Usar Asist. Recepción", "warehouse:population-wizard:use": "Almacén: Usar Asist. Poblado", "warehouse:inventory-count:create": "Almacén: Registrar Conteo",
    "warehouse:item-assignment:create": "Almacén: Asignar Ubic./Prod.", "warehouse:item-assignment:delete": "Almacén: Eliminar Asignación",
    "warehouse:locations:create": "Almacén: Crear Ubicaciones", "warehouse:locations:update": "Almacén: Editar Ubicaciones", "warehouse:locations:delete": "Almacén: Eliminar Ubicaciones",
    "warehouse:units:create": "Almacén: Crear Lotes/QR", "warehouse:units:delete": "Almacén: Eliminar Lotes/QR", "warehouse:locks:manage": "Almacén: Gestionar Bloqueos",
    "warehouse:correction:execute": "Almacén: Corregir Ingreso", "warehouse:correction:apply": "Almacén: Aplicar Ingreso", "warehouse:labels:generate": "Almacén: Generar Etiquetas",
    "hacienda:query": "Hacienda: Realizar Consultas",
    "analytics:read": "Analíticas: Acceso", "analytics:purchase-suggestions:read": "Analíticas: Sugerencias Compra", "analytics:purchase-report:read": "Analíticas: Reporte Compras", "analytics:production-report:read": "Analíticas: Reporte Producción", "analytics:transits-report:read": "Analíticas: Reporte Tránsitos", "analytics:user-permissions:read": "Analíticas: Reporte Permisos", "analytics:physical-inventory-report:read": "Analíticas: Reporte Inv. Físico", "analytics:receiving-report:read": "Analíticas: Reporte Recepciones", "analytics:item-assignments-report:read": "Analíticas: Reporte Catálogo", "analytics:occupancy-report:read": "Analíticas: Reporte Ocupación", "analytics:consignments-report:read": "Analíticas: Reporte Consignación",
    "users:create": "Usuarios: Crear", "users:read": "Usuarios: Leer", "users:update": "Usuarios: Actualizar", "users:delete": "Usuarios: Eliminar",
    "roles:create": "Roles: Crear", "roles:read": "Roles: Leer", "roles:update": "Roles: Actualizar", "roles:delete": "Roles: Eliminar",
    "admin:settings:general": "Admin: Config. General", "admin:settings:api": "Admin: Config. de API", "admin:settings:planner": "Admin: Config. Planificador", "admin:settings:requests": "Admin: Config. Compras", "admin:settings:warehouse": "Admin: Config. Almacenes", "admin:settings:stock": "Admin: Config. Inventario", "admin:settings:cost-assistant": "Admin: Config. Asist. Costos", "admin:settings:analytics": "Admin: Config. Analíticas", "admin:settings:consignments": "Admin: Config. Consignación",
    "admin:suggestions:read": "Admin: Leer Sugerencias",
    "admin:import:run": "Admin: Ejecutar Sincronización ERP", "admin:import:files": "Admin: Importar (Archivos)", "admin:import:sql": "Admin: Importar (SQL)", "admin:import:sql-config": "Admin: Configurar SQL",
    "admin:logs:read": "Admin: Ver Registros (Logs)", "admin:logs:clear": "Admin: Limpiar Registros (Logs)",
    "admin:maintenance:backup": "Admin: Mantenimiento (Backup)", "admin:maintenance:restore": "Admin: Mantenimiento (Restaurar)", "admin:maintenance:reset": "Admin: Mantenimiento (Resetear)",
};

export const permissionTree: Record<string, string[]> = {
    // Top-level Access
    "admin:access": ["users:read", "roles:read", "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:requests", "admin:settings:warehouse", "admin:settings:stock", "admin:settings:cost-assistant", "admin:settings:analytics", "admin:settings:consignments", "admin:suggestions:read", "admin:import:run", "admin:logs:read", "admin:maintenance:backup"],
    "analytics:read": ["analytics:purchase-suggestions:read", "analytics:purchase-report:read", "analytics:production-report:read", "analytics:transits-report:read", "analytics:user-permissions:read", "analytics:physical-inventory-report:read", "analytics:receiving-report:read", "analytics:item-assignments-report:read", "analytics:occupancy-report:read", "analytics:consignments-report:read"],
    "warehouse:access": ["warehouse:search:full", "warehouse:search:simple", "warehouse:receiving-wizard:use", "warehouse:population-wizard:use", "warehouse:inventory-count:create", "warehouse:item-assignment:create", "warehouse:locations:create", "warehouse:units:create", "warehouse:locks:manage", "warehouse:correction:execute", "warehouse:labels:generate"],
    "consignments:access": ["consignments:setup", "consignments:count", "consignments:boletas:read", "consignments:reports:read", "consignments:locks:manage"],
    "operations:access": ["operations:create", "operations:read:all", "operations:approve", "operations:sign"],
    "it-tools:access": ["it-tools:notes:read"],
    "quotes:create": ["quotes:generate", "quotes:drafts:read"],

    // Second-level dependencies
    "requests:read:all": ["requests:read"],
    "planner:read:all": ["planner:read"],
    "consignments:boletas:read:all": ["consignments:boletas:read"],

    "users:read": ["users:create", "users:update", "users:delete"],
    "roles:read": ["roles:create", "roles:update", "roles:delete"],
    "admin:import:run": ["admin:import:files", "admin:import:sql", "admin:import:sql-config"],
    "admin:logs:read": ["admin:logs:clear"],
    "admin:maintenance:backup": ["admin:maintenance:restore", "admin:maintenance:reset"],
    "it-tools:notes:read": ["it-tools:notes:create"],
    "it-tools:notes:create": ["it-tools:notes:update"],
    "it-tools:notes:update": ["it-tools:notes:delete"],
    "quotes:drafts:read": ["quotes:drafts:create"],
    "quotes:drafts:create": ["quotes:drafts:delete"],
    "warehouse:correction:execute": ["warehouse:correction:apply"],

    "requests:create": ["requests:notes:add", "requests:edit:pending", "requests:create:duplicate"],
    "requests:edit:pending": ["requests:status:review"],
    "requests:status:review": ["requests:status:pending-approval"],
    "requests:status:pending-approval": ["requests:status:approve"],
    "requests:status:approve": ["requests:edit:approved", "requests:status:ordered", "requests:status:cancel", "requests:status:unapproval-request"],
    "requests:status:ordered": ["requests:status:received-in-warehouse", "requests:status:revert-to-approved"],
    "requests:status:received-in-warehouse": ["requests:status:entered-erp"],
    "requests:status:unapproval-request": ["requests:status:unapproval-request:approve"],

    "requests:view:margin": ["requests:view:cost"],
    "requests:view:cost": ["requests:view:sale-price"],
    
    "planner:create": ["planner:edit:pending", "planner:status:review"],
    "planner:status:review": ["planner:status:approve"],
    "planner:status:approve": ["planner:edit:approved", "planner:status:in-progress", "planner:status:on-hold", "planner:status:completed", "planner:status:cancel-approved", "planner:status:unapprove-request", "planner:priority:update", "planner:machine:assign", "planner:schedule"],
    "planner:status:on-hold": ["planner:status:in-progress"], 
    "planner:status:completed": ["planner:receive", "planner:reopen"],
    "planner:status:cancel-approved": ["planner:reopen"],
    "planner:status:unapprove-request": ["planner:status:unapprove-request:approve"],

    "warehouse:locations:create": ["warehouse:locations:update", "warehouse:locations:delete"],
    "warehouse:item-assignment:create": ["warehouse:item-assignment:delete"],
    "warehouse:units:create": ["warehouse:units:delete"],
};
