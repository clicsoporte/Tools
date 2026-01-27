/**
 * @fileoverview Hook for managing the analytics settings page.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { getAnalyticsSettings, saveAnalyticsSettings } from '../lib/actions';
import type { AnalyticsSettings, TransitStatusAlias } from '@/modules/core/types';

const defaultSettings: AnalyticsSettings = {
    transitStatusAliases: [],
};

const emptyAlias: TransitStatusAlias = { id: '', name: '', color: '#CCCCCC' };

export const useAnalyticsSettings = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState<AnalyticsSettings>(defaultSettings);
    const [newAlias, setNewAlias] = useState<TransitStatusAlias>(emptyAlias);

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const savedSettings = await getAnalyticsSettings();
            setSettings(savedSettings);
        } catch (error: any) {
            logError("Failed to load analytics settings", { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar los ajustes.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleAliasChange = (index: number, field: keyof TransitStatusAlias, value: string) => {
        const updatedAliases = [...settings.transitStatusAliases];
        updatedAliases[index] = { ...updatedAliases[index], [field]: value };
        setSettings({ ...settings, transitStatusAliases: updatedAliases });
    };

    const handleAddAlias = () => {
        if (!newAlias.id || !newAlias.name) {
            toast({ title: "Datos incompletos", description: "El ID y el Nombre son requeridos.", variant: "destructive" });
            return;
        }
        if (settings.transitStatusAliases.some(a => a.id.toUpperCase() === newAlias.id.toUpperCase())) {
            toast({ title: "ID Duplicado", description: "Ya existe un estado con ese ID.", variant: "destructive" });
            return;
        }
        setSettings(prev => ({
            ...prev,
            transitStatusAliases: [...prev.transitStatusAliases, { ...newAlias, color: newAlias.color || '#CCCCCC' }]
        }));
        setNewAlias(emptyAlias);
    };

    const handleDeleteAlias = (index: number) => {
        const updatedAliases = settings.transitStatusAliases.filter((_, i) => i !== index);
        setSettings({ ...settings, transitStatusAliases: updatedAliases });
    };

    const handleSave = async () => {
        try {
            await saveAnalyticsSettings(settings);
            toast({ title: "Configuración Guardada", description: "Los ajustes de analíticas han sido actualizados." });
            logInfo("Analytics settings updated", { settings });
        } catch (error: any) {
            logError("Failed to save analytics settings", { error: error.message });
            toast({ title: "Error al Guardar", description: error.message, variant: "destructive" });
        }
    };

    return {
        state: {
            isLoading,
            settings,
            newAlias,
        },
        actions: {
            handleAliasChange,
            handleAddAlias,
            handleDeleteAlias,
            handleSave,
            setNewAlias,
        }
    };
};
    