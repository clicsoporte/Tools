
/**
 * @fileoverview Hook for managing the state and logic of the Consignments settings page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getConsignmentSettings, saveConsignmentSettings } from '../lib/actions';
import type { ConsignmentSettings, User } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';

const availableColumns = [
    { id: 'product_id', label: 'Código Producto' },
    { id: 'product_description', label: 'Descripción' },
    { id: 'counted_quantity', label: 'Inv. Físico' },
    { id: 'max_stock', label: 'Stock Máximo' },
    { id: 'replenish_quantity', label: 'A Reponer' },
];

export const useConsignmentsSettings = () => {
    const { setTitle } = usePageTitle();
    const { isAuthorized } = useAuthorization(['admin:settings:consignments']);
    const { toast } = useToast();
    const { allUsers } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        settings: {
            pdfTopLegend: '',
            pdfExportColumns: availableColumns.map(c => c.id),
            notificationUserIds: [],
            additionalNotificationEmails: '',
        } as ConsignmentSettings,
    });

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        setTitle('Configuración de Consignaciones');
        if (isAuthorized) {
            getConsignmentSettings().then(settingsData => {
                const completeSettings = {
                    ...state.settings,
                    ...settingsData,
                    notificationUserIds: settingsData.notificationUserIds || [],
                    additionalNotificationEmails: settingsData.additionalNotificationEmails || '',
                };
                updateState({ settings: completeSettings, isLoading: false });
            });
        }
    }, [setTitle, isAuthorized, updateState, state.settings]);

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        updateState({
            settings: {
                ...state.settings,
                pdfExportColumns: checked
                    ? [...(state.settings.pdfExportColumns || []), columnId]
                    : (state.settings.pdfExportColumns || []).filter(id => id !== columnId),
            },
        });
    };
    
    const updateSetting = (key: keyof ConsignmentSettings, value: any) => {
        updateState({
            settings: {
                ...state.settings,
                [key]: value,
            },
        });
    };

    const handleSave = async () => {
        try {
            await saveConsignmentSettings(state.settings);
            toast({ title: 'Configuración Guardada', description: 'Los ajustes de consignaciones han sido actualizados.' });
        } catch (error: any) {
            toast({ title: 'Error', description: 'No se pudieron guardar los ajustes.', variant: 'destructive' });
        }
    };
    
    const selectors = {
        availableColumns,
        isLoading: state.isLoading,
        userOptions: allUsers.map((u: User) => ({ value: String(u.id), label: u.name })),
    };

    const actions = {
        updateSetting,
        handleColumnVisibilityChange,
        handleSave,
    };

    return {
        state,
        actions,
        selectors,
        isAuthorized,
    };
};
