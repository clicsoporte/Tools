
"use client";

import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
  } from "../../../../components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../../components/ui/alert-dialog";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Label } from "../../../../components/ui/label";
import { Input } from "../../../../components/ui/input";
import { Badge } from "../../../../components/ui/badge";
import { useToast } from "../../../../modules/core/hooks/use-toast";
import { logInfo, logWarn } from "../../../../modules/core/lib/logger";
import type { Role } from "../../../../modules/core/types";
import { PlusCircle, Trash2, RefreshCw } from "lucide-react";
import { getAllRoles, saveAllRoles, resetDefaultRoles } from "../../../../modules/core/lib/db-client";
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { Skeleton } from "../../../../components/ui/skeleton";
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../../../../components/ui/accordion";
import { ScrollArea } from "../../../../components/ui/scroll-area";

const permissionGroups = {
    "Acceso General": ["dashboard:access"],
    "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
    "Solicitud de Compra (Lectura y Creación)": ["requests:read", "requests:create"],
    "Solicitud de Compra (Edición)": ["requests:edit:pending", "requests:edit:approved"],
    "Solicitud de Compra (Acciones)": ["requests:reopen", "requests:status:approve", "requests:status:ordered", "requests:status:received", "requests:status:cancel"],
    "Planificador de Producción (Lectura y Creación)": ["planner:read", "planner:create"],
    "Planificador de Producción (Edición)": ["planner:edit:pending", "planner:edit:approved"],
    "Planificador de Producción (Acciones)": [
        "planner:reopen", "planner:receive", "planner:status:approve", "planner:status:in-progress", "planner:status:on-hold", 
        "planner:status:completed", "planner:status:cancel", "planner:status:cancel-approved",
        "planner:priority:update", "planner:machine:assign"
    ],
    "Gestión de Almacenes": ["warehouse:access", "warehouse:inventory:assign", "warehouse:locations:manage"],
    "Consultas Hacienda": ["hacienda:query"],
    "Analíticas": ["analytics:read"],
    "Gestión de Usuarios": ["users:create", "users:read", "users:update", "users:delete"],
    "Gestión de Roles": ["roles:create", "roles:read", "roles:update", "roles:delete"],
    "Administración del Sistema": [
        "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:requests", "admin:settings:warehouse", "admin:settings:stock", 
        "admin:import:run", "admin:import:files", "admin:import:sql", "admin:import:sql-config",
        "admin:logs:read", "admin:logs:clear", "admin:maintenance:backup", "admin:maintenance:restore", "admin:maintenance:reset"
    ],
}

const permissionTranslations: { [key: string]: string } = {
    "dashboard:access": "Acceso al Panel",
    "quotes:create": "Cotizador: Acceder y Crear",
    "quotes:generate": "Cotizador: Generar PDF Final",
    "quotes:drafts:create": "Borradores: Crear",
    "quotes:drafts:read": "Borradores: Cargar",
    "quotes:drafts:delete": "Borradores: Eliminar",
    "requests:read": "Compras: Leer",
    "requests:create": "Compras: Crear",
    "requests:edit:pending": "Compras: Editar (Pendientes)",
    "requests:edit:approved": "Compras: Editar (Aprobadas)",
    "requests:reopen": "Compras: Reabrir",
    "requests:status:approve": "Compras: Aprobar",
    "requests:status:ordered": "Compras: Marcar como Ordenada",
    "requests:status:received": "Compras: Marcar como Recibida",
    "requests:status:cancel": "Compras: Cancelar",
    "planner:read": "Plan.: Leer Órdenes",
    "planner:create": "Plan.: Crear Órdenes",
    "planner:edit:pending": "Plan.: Editar (Pendientes)",
    "planner:edit:approved": "Plan.: Editar (Aprobadas)",
    "planner:reopen": "Plan.: Reabrir Órdenes",
    "planner:receive": "Plan.: Recibir en Bodega",
    "planner:status:approve": "Plan.: Cambiar a Aprobada",
    "planner:status:in-progress": "Plan.: Cambiar a En Progreso",
    "planner:status:on-hold": "Plan.: Cambiar a En Espera",
    "planner:status:completed": "Plan.: Cambiar a Completada",
    "planner:status:cancel": "Plan.: Cancelar (Pendientes)",
    "planner:status:cancel-approved": "Plan.: Cancelar (Aprobadas)",
    "planner:priority:update": "Plan.: Cambiar Prioridad",
    "planner:machine:assign": "Plan.: Asignar Máquina",
    "warehouse:access": "Almacén: Acceso General",
    "warehouse:inventory:assign": "Almacén: Asignar Inventario",
    "warehouse:locations:manage": "Almacén: Gestionar Ubicaciones",
    "hacienda:query": "Hacienda: Realizar Consultas",
    "analytics:read": "Analíticas: Leer",
    "users:create": "Usuarios: Crear",
    "users:read": "Usuarios: Leer",
    "users:update": "Usuarios: Actualizar",
    "users:delete": "Usuarios: Eliminar",
    "roles:create": "Roles: Crear",
    "roles:read": "Roles: Leer",
    "roles:update": "Roles: Actualizar",
    "roles:delete": "Roles: Eliminar",
    "admin:settings:general": "Admin: Config. General",
    "admin:settings:api": "Admin: Config. de API",
    "admin:settings:planner": "Admin: Config. Planificador",
    "admin:settings:requests": "Admin: Config. Compras",
    "admin:settings:warehouse": "Admin: Config. Almacenes",
    "admin:settings:stock": "Admin: Config. Inventario",
    "admin:import:run": "Admin: Ejecutar Sincronización ERP",
    "admin:import:files": "Admin: Importar (Archivos)",
    "admin:import:sql": "Admin: Importar (SQL)",
    "admin:import:sql-config": "Admin: Configurar SQL",
    "admin:logs:read": "Admin: Ver Registros (Logs)",
    "admin:logs:clear": "Admin: Limpiar Registros (Logs)",
    "admin:maintenance:backup": "Admin: Mantenimiento (Backup)",
    "admin:maintenance:restore": "Admin: Mantenimiento (Restaurar)",
    "admin:maintenance:reset": "Admin: Mantenimiento (Resetear)",
};

const emptyRole: Role = {
    id: "",
    name: "",
    permissions: [],
}

export default function RolesPage() {
    useAuthorization(['roles:read', 'roles:create', 'roles:update', 'roles:delete']);
    const { toast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
    const [newRole, setNewRole] = useState<Role>(emptyRole);
    const { setTitle } = usePageTitle();
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

    const fetchRoles = async () => {
        setIsLoading(true);
        const savedRoles = await getAllRoles();
        setRoles(savedRoles);
        setIsLoading(false);
    };

    useEffect(() => {
        setTitle("Gestión de Roles");
        fetchRoles();
    }, [setTitle]);
    
    const handlePermissionChange = (roleId: string, permission: string, checked: boolean) => {
        setRoles(currentRoles => 
            currentRoles.map(role => {
                if (role.id === roleId) {
                    const newPermissions = checked
                        ? [...role.permissions, permission]
                        : role.permissions.filter(p => p !== permission);
                    return { ...role, permissions: newPermissions };
                }
                return role;
            })
        );
    }
    
    const handleNewRolePermissionChange = (permission: string, checked: boolean) => {
        setNewRole(currentRole => {
            const newPermissions = checked
                ? [...currentRole.permissions, permission]
                : currentRole.permissions.filter(p => p !== permission);
            return { ...currentRole, permissions: newPermissions };
        })
    }

    const handleSave = async () => {
        await saveAllRoles(roles);
        toast({
            title: "Roles Guardados",
            description: "Los permisos de los roles han sido actualizados.",
        });
        await logInfo("Roles y permisos guardados.", { roles: roles.map(r => r.id) });
    }

    const handleAddRole = async () => {
        if (!newRole.id || !newRole.name) {
            toast({ title: "Error", description: "ID y Nombre son requeridos.", variant: "destructive" });
            return;
        }
        if (roles.some(role => role.id === newRole.id)) {
             toast({ title: "Error", description: "El ID del rol ya existe.", variant: "destructive" });
            return;
        }

        const updatedRoles = [...roles, newRole];
        setRoles(updatedRoles);
        await saveAllRoles(updatedRoles);
        toast({ title: "Rol Creado", description: `El rol "${newRole.name}" ha sido añadido.` });
        await logInfo("Nuevo rol creado", { role: newRole.name });
        setNewRole(emptyRole);
        setAddRoleDialogOpen(false);
    }

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;

        const updatedRoles = roles.filter(role => role.id !== roleToDelete.id);
        setRoles(updatedRoles);
        await saveAllRoles(updatedRoles);

        toast({ title: "Rol Eliminado", description: `El rol "${roleToDelete.name}" ha sido eliminado.`, variant: 'destructive'});
        await logWarn("Rol eliminado", { role: roleToDelete.name });
        setRoleToDelete(null);
    }

    const handleResetRoles = async () => {
        await resetDefaultRoles();
        await fetchRoles(); // Refresca la lista de roles desde la DB
        toast({ title: "Roles Reiniciados", description: "Los roles por defecto han sido restaurados." });
        await logWarn("Los roles por defecto han sido reiniciados por un administrador.");
    }

    if (isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-64"/>
                        <Skeleton className="h-4 w-96 mt-2"/>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                       <Skeleton className="h-40 w-full" />
                       <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
            </main>
        )
    }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Roles y Permisos</CardTitle>
                    <CardDescription>
                    Define qué acciones puede realizar cada rol dentro del sistema.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Restablecer Roles
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Restablecer Roles por Defecto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción restaurará los roles por defecto ('admin', 'viewer', 'planner-user', 'requester-user') a sus permisos originales.
                                    Los roles personalizados que hayas creado no se verán afectados.
                                    Esto es útil si los permisos por defecto se han corrompido.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetRoles}>Sí, restablecer</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Dialog open={isAddRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Crear Rol
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Crear Nuevo Rol Personalizado</DialogTitle>
                                <DialogDescription>
                                    Define un ID, un nombre y asigna los permisos para el nuevo rol.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="role-id">ID del Rol (sin espacios)</Label>
                                        <Input 
                                            id="role-id"
                                            value={newRole.id}
                                            onChange={e => setNewRole({...newRole, id: e.target.value.toLowerCase().replace(/\s/g, '-')})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="role-name">Nombre para mostrar</Label>
                                        <Input 
                                            id="role-name"
                                            value={newRole.name}
                                            onChange={e => setNewRole({...newRole, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-medium">Permisos</h4>
                                    <ScrollArea className="h-72 w-full rounded-md border p-4">
                                        <Accordion type="multiple" className="w-full">
                                            {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                                                <AccordionItem value={groupName} key={groupName}>
                                                    <AccordionTrigger>{groupName}</AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-2">
                                                            {permissions.map((permission) => (
                                                            <div key={`new-${permission}`} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                id={`new-${permission}`}
                                                                checked={newRole.permissions.includes(permission)}
                                                                onCheckedChange={(checked) => handleNewRolePermissionChange(permission, checked === true)}
                                                                />
                                                                <Label htmlFor={`new-${permission}`} className="font-normal text-sm">
                                                                {permissionTranslations[permission] || permission}
                                                                </Label>
                                                            </div>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </ScrollArea>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                <Button onClick={handleAddRole}>Crear Rol</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{role.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">{role.id}</Badge>
                  </div>
                  {role.id !== 'admin' && role.id !== 'viewer' && role.id !== 'planner-user' && role.id !== 'requester-user' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar el rol "{role.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Los usuarios asignados a este rol perderán sus permisos.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteRole}>Sí, eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                            <AccordionItem value={`${role.id}-${groupName}`} key={`${role.id}-${groupName}`}>
                                <AccordionTrigger>{groupName}</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-2">
                                        {permissions.map((permission) => (
                                            <div key={`${role.id}-${permission}`} className="flex items-center space-x-2">
                                                <Checkbox
                                                id={`${role.id}-${permission}`}
                                                checked={role.permissions.includes(permission)}
                                                onCheckedChange={(checked) => handlePermissionChange(role.id, permission, checked === true)}
                                                disabled={role.id === 'admin'}
                                                />
                                                <Label htmlFor={`${role.id}-${permission}`} className={`font-normal text-sm ${role.id === 'admin' ? 'text-muted-foreground' : ''}`}>
                                                {permissionTranslations[permission] || permission}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
              </Card>
            ))}
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button onClick={handleSave}>Guardar Cambios</Button>
          </CardFooter>
        </Card>
      </main>
  );
}
