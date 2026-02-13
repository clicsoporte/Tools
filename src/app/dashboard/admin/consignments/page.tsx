
/**
 * @fileoverview Page for managing consignments settings.
 */
'use client';

import React from 'react';
import { useConsignmentsSettings } from '@/modules/consignments/hooks/useConsignmentsSettings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Users } from 'lucide-react';
import { DialogColumnSelector } from '@/components/ui/dialog-column-selector';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Textarea } from '@/components/ui/textarea';

export default function ConsignmentsSettingsPage() {
    const { state, actions, selectors, isAuthorized } = useConsignmentsSettings();

    if (selectors.isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-96 w-full max-w-4xl mx-auto" />
            </main>
        );
    }
    
    if (!isAuthorized) {
        return null; // Or a permission denied component
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Consignaciones</CardTitle>
                        <CardDescription>
                            Ajustes para los consecutivos y el formato de los documentos del módulo de consignaciones.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <Label htmlFor="pdf-top-legend">Leyenda Superior del PDF (Opcional)</Label>
                            <Input
                                id="pdf-top-legend"
                                value={state.settings.pdfTopLegend || ''}
                                onChange={(e) => actions.updateSetting('pdfTopLegend', e.target.value)}
                                placeholder="Ej: Documento Controlado - ISO9001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Columnas en Boleta de Reposición (PDF)</Label>
                            <DialogColumnSelector
                                allColumns={selectors.availableColumns}
                                visibleColumns={state.settings.pdfExportColumns || []}
                                onColumnChange={actions.handleColumnVisibilityChange}
                                onSave={actions.handleSave}
                                className="w-full"
                            />
                             <p className="text-sm text-muted-foreground">
                                Selecciona las columnas que aparecerán en el PDF de la boleta de reposición.
                            </p>
                        </div>
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-semibold text-lg">Notificaciones por Correo</h3>
                            <div className="space-y-2">
                                <Label>Usuarios a Notificar para Aprobación</Label>
                                <MultiSelectFilter
                                    title="Seleccionar Usuarios"
                                    options={selectors.userOptions}
                                    selectedValues={(state.settings.notificationUserIds || []).map(String)}
                                    onSelectedChange={(ids) => actions.updateSetting('notificationUserIds', ids.map(Number))}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Selecciona los usuarios del sistema que recibirán un correo cuando una boleta requiera aprobación.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="additional-emails">Correos Adicionales (separados por coma)</Label>
                                <Textarea
                                    id="additional-emails"
                                    value={state.settings.additionalNotificationEmails || ''}
                                    onChange={(e) => actions.updateSetting('additionalNotificationEmails', e.target.value)}
                                    placeholder="ejemplo@correo.com, otro@correo.com"
                                />
                                 <p className="text-sm text-muted-foreground">
                                    Añade buzones de grupo o correos que no sean usuarios del sistema.
                                </p>
                            </div>
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
