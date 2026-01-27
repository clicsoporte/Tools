/**
 * @fileoverview New settings page for Analytics.
 * Allows configuration of aliases for transit report statuses.
 */
'use client';

import React from 'react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAnalyticsSettings } from '@/modules/analytics/hooks/useAnalyticsSettings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Save, PlusCircle, Trash2, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const defaultColors = [ '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#22c55e', '#3b82f6', '#ef4444', '#14b8a6', '#64748b' ];

export default function AnalyticsSettingsPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:analytics']);
    const { setTitle } = usePageTitle();
    const { state, actions } = useAnalyticsSettings();

    React.useEffect(() => {
        setTitle("Configuración de Analíticas");
    }, [setTitle]);

    if (!isAuthorized) {
        return null; // Or a permission denied component
    }

    if (state.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Reportes de Analíticas</CardTitle>
                        <CardDescription>
                            Personaliza los alias y colores para los estados utilizados en los reportes, como el Reporte de Tránsitos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <h3 className="font-semibold text-lg">Alias de Estados para Reporte de Tránsitos</h3>
                        <div className="border rounded-md">
                            <Table>
                                <TableBody>
                                    {state.settings.transitStatusAliases.map((alias, index) => (
                                        <TableRow key={alias.id}>
                                            <TableCell className="w-20 font-mono">{alias.id}</TableCell>
                                            <TableCell>
                                                <Input value={alias.name} onChange={(e) => actions.handleAliasChange(index, 'name', e.target.value)} />
                                            </TableCell>
                                            <TableCell className="w-32">
                                                <div className="flex items-center gap-2">
                                                    <Input value={alias.color} onChange={(e) => actions.handleAliasChange(index, 'color', e.target.value)} />
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" size="icon" style={{ backgroundColor: alias.color }} className="h-8 w-8">
                                                                <Palette className="h-4 w-4 text-white mix-blend-difference" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-48 p-2">
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {defaultColors.map(color => (
                                                                    <button
                                                                        key={color}
                                                                        className={cn("h-8 w-8 rounded-full border", color === alias.color && "ring-2 ring-ring")}
                                                                        style={{ backgroundColor: color }}
                                                                        onClick={() => actions.handleAliasChange(index, 'color', color)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => actions.handleDeleteAlias(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-end gap-2 pt-4 border-t">
                            <div className="space-y-1">
                                <Label htmlFor="new-alias-id">ID Estado (Letra)</Label>
                                <Input id="new-alias-id" value={state.newAlias.id} onChange={(e) => actions.setNewAlias({ ...state.newAlias, id: e.target.value.toUpperCase() })} className="w-20 font-mono" maxLength={1} />
                            </div>
                            <div className="space-y-1 flex-1">
                                <Label htmlFor="new-alias-name">Nombre Descriptivo</Label>
                                <Input id="new-alias-name" value={state.newAlias.name} onChange={(e) => actions.setNewAlias({ ...state.newAlias, name: e.target.value })} />
                            </div>
                            <Button size="icon" onClick={actions.handleAddAlias}>
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={actions.handleSave}>
                            <Save className="mr-2 h-4 w-4"/>
                            Guardar Cambios
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    );
}
    