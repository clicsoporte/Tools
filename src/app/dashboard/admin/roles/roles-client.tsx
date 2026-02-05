'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logInfo, logError } from '@/modules/core/lib/logger';
import {
  permissionGroups,
  permissionTranslations,
  permissionTree,
  allAdminPermissions,
} from '@/modules/core/lib/permissions';
import { getAllRoles, saveAllRoles, resetDefaultRoles } from '@/modules/core/lib/db';
import type { Role } from '@/modules/core/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Save, Trash2, ShieldQuestion } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

export default function RolesClient() {
  const { hasPermission } = useAuthorization();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const rolesData = await getAllRoles();
      setRoles(rolesData);
    } catch (error) {
      logError('Error fetching roles', { error });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los roles.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    setTitle('Gestión de Roles');
    fetchRoles();
  }, [setTitle, fetchRoles]);

  const handleOpenDialog = (role?: Role) => {
    setCurrentRole(role ? { ...role } : { id: '', name: '', permissions: [] });
    setDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!currentRole || !currentRole.name.trim()) {
      toast({
        title: 'Error de Validación',
        description: 'El nombre del rol no puede estar vacío.',
        variant: 'destructive',
      });
      return;
    }

    let updatedRoles;
    const isNew = !currentRole.id;
    if (isNew) {
      const newRoleId = currentRole.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      if (roles.some((r) => r.id === newRoleId)) {
        toast({
          title: 'Error',
          description: 'Ya existe un rol con un ID similar.',
          variant: 'destructive',
        });
        return;
      }
      updatedRoles = [...roles, { ...currentRole, id: newRoleId }];
    } else {
      updatedRoles = roles.map((r) =>
        r.id === currentRole.id ? currentRole : r
      );
    }

    try {
      await saveAllRoles(updatedRoles);
      setRoles(updatedRoles);
      toast({
        title: 'Roles Guardados',
        description: `El rol "${currentRole.name}" ha sido ${
          isNew ? 'creado' : 'actualizado'
        }.`,
      });
      await logInfo('Roles saved', { role: currentRole.name });
    } catch (err: any) {
      logError('Failed to save roles', { error: err.message });
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los roles.',
        variant: 'destructive',
      });
    }

    setDialogOpen(false);
  };

  const handleDeleteRole = async (roleId: string) => {
    if (roleId === 'admin') {
      toast({
        title: 'Acción no permitida',
        description: 'No se puede eliminar el rol de Administrador.',
        variant: 'destructive',
      });
      return;
    }
    const updatedRoles = roles.filter((r) => r.id !== roleId);
    await saveAllRoles(updatedRoles);
    setRoles(updatedRoles);
    toast({
      title: 'Rol Eliminado',
      description: 'El rol ha sido eliminado.',
      variant: 'destructive',
    });
    await logInfo('Role deleted', { roleId });
  };

  const handleResetAdmin = async () => {
    await resetDefaultRoles();
    await fetchRoles(); // Re-fetch all roles to get the updated admin role
    toast({
      title: 'Rol de Administrador Restablecido',
      description:
        'Todos los permisos han sido re-asignados al rol de Administrador.',
    });
    await logInfo('Admin role reset to default');
  };

  const handlePermissionChange = (
    permission: string,
    isChecked: boolean,
    role: Role
  ) => {
    let newPermissions = new Set(role.permissions);

    const updateChildren = (perm: string, add: boolean) => {
      if (permissionTree[perm]) {
        for (const child of permissionTree[perm]) {
          if (add) newPermissions.add(child);
          else newPermissions.delete(child);
          updateChildren(child, add);
        }
      }
    };

    const updateParents = (perm: string) => {
      for (const parent in permissionTree) {
        if (permissionTree[parent].includes(perm)) {
          newPermissions.add(parent);
          updateParents(parent);
        }
      }
    };

    if (isChecked) {
      newPermissions.add(permission);
      updateChildren(permission, true);
      updateParents(permission);
    } else {
      newPermissions.delete(permission);
      updateChildren(permission, false);
    }

    setCurrentRole({ ...role, permissions: Array.from(newPermissions) });
  };

  const renderPermissionGroup = (
    groupName: string,
    permissions: string[],
    role: Role
  ) => {
    const parentPermission = Object.keys(permissionTree).find(p => permissionTree[p].includes(permissions[0]));

    return (
      <details key={groupName} open className="space-y-2">
        <summary className="cursor-pointer font-medium">{groupName}</summary>
        <div className="pl-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-l-2 ml-2 pl-4">
          {permissions.map((permission) => {
            const isDisabled =
              role.id === 'admin' ||
              (!!parentPermission &&
                role.permissions.includes(parentPermission));
            return (
              <div key={permission} className="flex items-center space-x-2">
                <Checkbox
                  id={`${role.id}-${permission}`}
                  checked={role.permissions.includes(permission)}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission, !!checked, role)
                  }
                  disabled={isDisabled}
                />
                <Label
                  htmlFor={`${role.id}-${permission}`}
                  className="font-normal text-sm"
                >
                  {(permissionTranslations as any)[permission] || permission}
                </Label>
              </div>
            );
          })}
        </div>
      </details>
    );
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Roles</h1>
            <p className="text-muted-foreground">
              Define roles de usuario y asigna permisos específicos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetAdmin}
              disabled={!hasPermission('roles:update')}
            >
              <ShieldQuestion className="mr-2 h-4 w-4" />
              Restablecer Rol Admin
            </Button>
            <Button
              onClick={() => handleOpenDialog()}
              disabled={!hasPermission('roles:create')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Rol
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{role.name}</CardTitle>
                    <CardDescription>ID: {role.id}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenDialog(role)}
                      disabled={
                        role.id === 'admin' || !hasPermission('roles:update')
                      }
                    >
                      Editar Permisos
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteRole(role.id)}
                      disabled={
                        role.id === 'admin' || !hasPermission('roles:delete')
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {currentRole?.id ? 'Editar Rol' : 'Nuevo Rol'}
            </DialogTitle>
            <DialogDescription>
              {currentRole?.id
                ? `Editando permisos para "${currentRole?.name}"`
                : 'Crea un nuevo rol y asigna sus permisos.'}
            </DialogDescription>
          </DialogHeader>
          {currentRole && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Nombre del Rol</Label>
                <Input
                  id="role-name"
                  value={currentRole.name}
                  onChange={(e) =>
                    setCurrentRole({ ...currentRole, name: e.target.value })
                  }
                  disabled={currentRole.id === 'admin'}
                />
              </div>
              <ScrollArea className="h-[50vh] rounded-md border p-4">
                <div className="space-y-6">
                  {Object.entries(permissionGroups).map(([groupName, perms]) =>
                    renderPermissionGroup(groupName, perms, currentRole)
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSaveRole}
              disabled={currentRole?.id === 'admin'}
            >
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
