
/**
 * @fileoverview Hook for managing the state and logic of the Consignments settings page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getConsignmentSettings, saveConsignmentSettings } from '../lib/actions';
import type { ConsignmentSettings } from '@/modules/core/types';

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

    const [state, setState] = useState({
        isLoading: true,
        settings: {
            pdfTopLegend: '',
            pdfExportColumns: availableColumns.map(c => c.id),
        } as ConsignmentSettings,
    });

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    useEffect(() => {
        setTitle('Configuración de Consignaciones');
        if (isAuthorized) {
            getConsignmentSettings().then(settingsData => {
                updateState({ settings: settingsData, isLoading: false });
            });
        }
    }, [setTitle, isAuthorized, updateState]);

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
    
    const updateSetting = (key: keyof ConsignmentSettings, value: string) => {
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
