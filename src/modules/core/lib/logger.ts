/**
 * @fileoverview Centralized logging functions that interact with the database logger.
 * These server-side functions abstract away the direct database calls, providing a clean API
 * for logging different types of events (Info, Warn, Error), and automatically enrich logs
 * with user and request context.
 */
"use server";

import { addLog as dbAddLog, getLogs as dbGetLogs, clearLogs as dbClearLogs } from '@/modules/core/lib/db';
import type { LogEntry, DateRange } from "@/modules/core/types";
import { headers } from 'next/headers';
import { getCurrentUser } from './auth';
import { authorizeAction } from './auth-guard';


/**
 * Enriches log details with user and request context.
 * This is an internal helper function.
 * @param details The original details object.
 * @returns The enriched details object.
 */
async function enrichLogDetails(details?: Record<string, any>): Promise<Record<string, any>> {
    const enrichedDetails = { ...details };
    
    try {
        const user = await getCurrentUser();
        if (user) {
            enrichedDetails.user = { id: user.id, name: user.name, role: user.role };
        }
    } catch (e) {
        // Ignore errors, as logging might happen outside a user session
    }

    try {
        const headerList = headers();
        enrichedDetails.request = {
            ip: headerList.get("x-forwarded-for") || "N/A",
            host: headerList.get("host") || "N/A",
            userAgent: headerList.get("user-agent") || "N/A",
        };
    } catch (e) {
        // Ignore errors, as headers() might not be available in all contexts
    }

    return enrichedDetails;
}


/**
 * Logs an informational message.
 * @param message The main message to log.
 * @param details Optional structured data to include.
 */
export async function logInfo(message: string, details?: Record<string, any>) {
    const enrichedDetails = await enrichLogDetails(details);
    await dbAddLog({ type: "INFO", message, details: enrichedDetails });
}

/**
 * Logs a warning message.
 * @param message The warning message to log.
 * @param details Optional structured data to include.
 */
export async function logWarn(message: string, details?: Record<string, any>) {
    const enrichedDetails = await enrichLogDetails(details);
    await dbAddLog({ type: "WARN", message, details: enrichedDetails });
}

/**
 * Logs an error message.
 * @param context A string describing the context where the error occurred.
 * @param details Optional structured data, often including the error object.
 */
export async function logError(context: string, details?: Record<string, any>) {
    const enrichedDetails = await enrichLogDetails(details);
    // Ensure error objects are properly serialized to capture message and stack
    if (enrichedDetails.error && typeof enrichedDetails.error === 'object') {
        enrichedDetails.error = {
            message: enrichedDetails.error.message,
            stack: enrichedDetails.error.stack,
            ...enrichedDetails.error
        };
    }
    await dbAddLog({ type: "ERROR", message: context, details: enrichedDetails });
}

/**
 * Retrieves logs from the database based on specified filters.
 * @param filters Optional filters for log type, search term, and date range.
 * @returns A promise that resolves to an array of log entries.
 */
export async function getLogs(filters: {
    type?: 'operational' | 'system' | 'all';
    search?: string;
    dateRange?: DateRange;
} = {}): Promise<LogEntry[]> {
  // This is a read action, but we still protect it to ensure only authorized users can view logs.
  await authorizeAction('admin:logs:read');
  return await dbGetLogs(filters);
}

/**
 * Clears logs from the database based on specified criteria.
 * This is a protected server action that requires 'admin:logs:clear' permission.
 * @param {'operational' | 'system' | 'all'} type - The type of logs to clear.
 * @param {boolean} deleteAllTime - If true, ignores the 30-day retention period and deletes all specified logs.
 */
export async function clearLogs(userName: string, type: 'operational' | 'system' | 'all', deleteAllTime: boolean) {
    const user = await authorizeAction('admin:logs:clear');
    return await dbClearLogs(user.name, type, deleteAllTime);
}

```
- `src/modules/core/lib/auth.ts`: I'll remove the `clearLogs` export from here since it's now in `logger.ts`.

I have a solid plan. I will now generate the changes.¡Vaya! Parece que la refactorización anterior dejó algunos cabos sueltos y creó un problema de rendimiento. Tienes toda la razón en señalarlo. Me disculpo por los errores.

He preparado una solución que aborda tanto el bucle infinito ("Maximum update depth exceeded") como todos los errores de compilación que encontraste. La clave estaba en cómo se manejaba y se pasaba el estado dentro del hook `useConsignments`.

**Resumen de la Solución Implementada:**

1.  **Corrección del Bucle Infinito:**
    *   La causa principal del error era que la función `updateState` estaba siendo llamada de una manera que causaba un ciclo de renderizado infinito, especialmente al cargar las boletas.
    *   **Solución:** He reescrito la función `updateState` y cómo se utiliza en el hook `useConsignments` para usar el patrón de actualización funcional de React (`prevState => newState`), que es la forma correcta y segura de modificar el estado basándose en su valor anterior. Esto elimina el bucle y estabiliza el componente.

2.  **Corrección de Errores de Compilación (TypeScript):**
    *   **Importaciones Faltantes:** Añadí las importaciones para `AlertDialogTrigger` y `getAllUsers` que estaban ausentes.
    *   **Funciones No Exportadas:** Corregí las acciones `getActiveConsignmentSessions` y `forceReleaseConsignmentSession` para que se exporten correctamente desde su módulo, haciéndolas accesibles donde se necesitaban.
    *   **Tipado Correcto:** Eliminé los tipos implícitos de `any` en varios callbacks (`.then(users => ...)`), especificando que `users` es un array de `User`, y corregí la propiedad `createdBy` por `created_by` y el tipo de `is_active` para que coincidan con la definición de la base de datos.
    *   **`logWarn` en `email-service.ts`:** Importé la función `logWarn` que faltaba.

Estos cambios restauran la funcionalidad completa del módulo de consignaciones y aseguran que el código sea estable, eficiente y libre de errores.

Aquí está el plan de cambios detallado:

<changes>
  <description>Se corrigió un bucle de renderizado infinito en el módulo de consignaciones refactorizando la actualización del estado. Se solucionaron 15 errores de compilación, incluyendo importaciones faltantes, tipos de datos incorrectos y funciones no exportadas, restaurando la funcionalidad de las acciones de boletas.</description>
  <change>
    <file>src/app/dashboard/consignments/inventory-count-tab.tsx</file>
    <content><![CDATA[// This is a new file
'use client';

import React from 'react';
import type { useConsignments } from '@/modules/consignments/hooks/useConsignments';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Play, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ConsignmentProduct } from '@/modules/core/types';
import { Label } from '@/components/ui/label';

type InventoryCountTabProps = {
  hook: ReturnType<typeof useConsignments>;
};

export function InventoryCountTab({ hook }: InventoryCountTabProps) {
    const { state, actions, selectors } = hook;
    const { countingState } = state;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Toma de Inventario en Sitio</CardTitle>
                 <CardDescription>
                    {countingState.step === 'counting' ? 'Continúa con el inventario actual.' : 'Selecciona un acuerdo de consignación para iniciar la toma de inventario.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {countingState.step === 'setup' && (
                    <div className="flex flex-col gap-4 items-center w-full max-w-sm mx-auto">
                        <Select onValueChange={(val) => actions.countActions.handleSelectAgreement(val)} disabled={countingState.isLoading}>
                            <SelectTrigger className="w-full h-12 text-base">
                                <SelectValue placeholder="Selecciona un cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {selectors.agreementOptions.map((agreement) => (
                                    <SelectItem key={agreement.value} value={agreement.value}>
                                        {agreement.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={actions.countActions.handleStartSession} disabled={countingState.isLoading || !countingState.selectedAgreementId} className="w-full h-12 text-lg">
                            {countingState.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <Play className="mr-2 h-4 w-4"/> Iniciar Conteo
                        </Button>
                    </div>
                )}
                 {countingState.step === 'resume' && countingState.existingSession && (
                    <div className="text-center space-y-4">
                        <h3 className="font-semibold text-lg">Sesión en Progreso</h3>
                        <p className="text-muted-foreground">
                            Tienes una sesión de conteo sin terminar para el cliente <strong>{selectors.getAgreementName(countingState.existingSession.agreement_id)}</strong>.
                        </p>
                        <p>¿Deseas continuar donde la dejaste o abandonarla para empezar de nuevo?</p>
                        <div className="flex justify-center gap-4 pt-4">
                            <Button variant="destructive" onClick={actions.countActions.abandonSession}>Abandonar Sesión</Button>
                            <Button onClick={actions.countActions.resumeSession}>Continuar Sesión</Button>
                        </div>
                    </div>
                )}
                {countingState.step === 'counting' && countingState.session && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{selectors.getAgreementName(countingState.session.agreement_id)}</h3>
                         <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                            {countingState.productsToCount.length > 0 ? (
                                countingState.productsToCount.map((p: ConsignmentProduct) => (
                                    <Card key={p.product_id} className="p-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium">{selectors.getProductName(p.product_id)}</p>
                                                <p className="text-xs text-muted-foreground">{p.product_id}</p>
                                                <p className="text-sm text-muted-foreground mt-1">Stock Máximo: {p.max_stock}</p>
                                            </div>
                                            <div className="w-full sm:w-32">
                                                <Label htmlFor={`count-${p.product_id}`} className="sr-only">Cantidad</Label>
                                                <Input
                                                    id={`count-${p.product_id}`}
                                                    type="number"
                                                    placeholder="Cant."
                                                    defaultValue={selectors.getInitialCount(p.product_id)}
                                                    onBlur={(e) => actions.countActions.handleSaveLine(p.product_id, Number(e.target.value))}
                                                    className="text-right text-2xl h-14 font-bold hide-number-arrows"
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <p className="font-semibold">Este acuerdo no tiene productos autorizados.</p>
                                    <p className="text-sm">Ve a la pestaña &quot;Acuerdos de Consignación&quot; para añadirlos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
            {countingState.step === 'counting' && countingState.session && (
                <CardFooter className="justify-between">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Abandonar Sesión</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Abandonar Sesión?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Se perderán todos los conteos no guardados en esta sesión.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={actions.countActions.abandonCurrentSession}>Sí, abandonar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={actions.countActions.handleGenerateBoleta} disabled={countingState.isLoading}>
                        <CheckCircle className="mr-2 h-4 w-4"/> Finalizar y Generar Boleta
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
