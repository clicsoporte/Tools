/**
 * @fileoverview Custom hook for managing the state and logic of the CostAssistantPage component.
 */
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import type { CostAssistantLine, ProcessedInvoiceInfo, CostAnalysisDraft, CostAssistantSettings } from '@/modules/core/types';
import { processInvoiceXmls, getCostAssistantSettings, saveCostAssistantSettings, getAllDrafts, saveDraft, deleteDraft, exportForERP, cleanupExportFile } from '../lib/actions';
import { logError } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';

const parseDecimal = (str: any): number => {
    if (str === null || str === undefined || str === '') return 0;
    const s = String(str).trim();
    
    // If a comma exists, it is the decimal separator. Remove dots, replace comma.
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    
    // If no comma exists, treat as a standard float, respecting the dot as decimal separator
    return parseFloat(s);
};


const initialColumnVisibility: CostAssistantSettings['columnVisibility'] = {
    cabysCode: true,
    supplierCode: true,
    description: true,
    quantity: true,
    unitCostWithoutTax: true,
    unitCostWithTax: false,
    taxRate: true,
    margin: true,
    sellPriceWithoutTax: true,
    finalSellPrice: true,
    profitPerLine: true,
};

type ColumnVisibility = typeof initialColumnVisibility;

type ExportStatus = 'idle' | 'generating' | 'ready';

const initialState = {
    isProcessing: false,
    lines: [] as CostAssistantLine[],
    processedInvoices: [] as ProcessedInvoiceInfo[],
    drafts: [] as CostAnalysisDraft[],
    transportCost: 0,
    otherCosts: 0,
    columnVisibility: initialColumnVisibility as ColumnVisibility,
    exportStatus: 'idle' as ExportStatus,
    exportFileName: null as string | null,
};

export const useCostAssistant = () => {
    useAuthorization(['dashboard:access']); // Basic access permission
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user } = useAuth();

    const [state, setState] = useState(initialState);

    useEffect(() => {
        setTitle("Asistente de Costos");
        const loadSettings = async () => {
            if (user) {
                const settings = await getCostAssistantSettings(user.id);
                const completeVisibility = { ...initialColumnVisibility, ...settings.columnVisibility };
                setState(prevState => ({ ...prevState, columnVisibility: completeVisibility }));
            }
        };
        loadSettings();
    }, [setTitle, user]);

    const updateLine = (id: string, updatedFields: Partial<CostAssistantLine>) => {
        setState(prevState => ({
            ...prevState,
            lines: prevState.lines.map(line => 
                line.id === id ? { ...line, ...updatedFields } : line
            ),
        }));
    };
    
    const handleFilesDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        
        setState(prevState => ({ ...prevState, isProcessing: true }));
        
        try {
            const fileContents = await Promise.all(
                acceptedFiles.map(file => 
                    new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    })
                )
            );
            
            const { lines: processedLines, processedInvoices } = await processInvoiceXmls(fileContents);

            const newLines = processedLines.map((line) => ({
                ...line,
                displayMargin: "20",
                margin: 0.20,
                displayTaxRate: (line.taxRate * 100).toFixed(0),
                displayUnitCost: line.unitCostWithoutTax.toFixed(4),
                isCostEdited: false,
                finalSellPrice: 0, // Will be calculated by useMemo
                profitPerLine: 0, // Will be calculated by useMemo
                sellPriceWithoutTax: 0,
            }));
            
            setState(prevState => ({ 
                ...prevState, 
                lines: [...prevState.lines, ...newLines],
                processedInvoices: [...prevState.processedInvoices, ...processedInvoices]
            }));
            const successCount = processedInvoices.filter(p => p.status === 'success').length;
            toast({ title: "Facturas Procesadas", description: `Se agregaron ${newLines.length} artículos de ${successCount} factura(s).` });

        } catch (error: any) {
            logError("Error processing invoice XMLs", { error: error.message });
            toast({ title: "Error al Procesar Archivos", description: error.message, variant: "destructive" });
        } finally {
            setState(prevState => ({ ...prevState, isProcessing: false }));
        }
    }, [toast]);
    
    const removeLine = (id: string) => {
        setState(prevState => ({
            ...prevState,
            lines: prevState.lines.filter(line => line.id !== id)
        }));
    };

    const handleMarginBlur = (lineId: string, displayValue: string) => {
        const numericValue = parseDecimal(displayValue);
        updateLine(lineId, {
            margin: numericValue / 100,
            displayMargin: String(numericValue)
        });
    };

    const handleTaxRateBlur = (lineId: string, displayValue: string) => {
        const numericValue = parseDecimal(displayValue);
        updateLine(lineId, {
            taxRate: numericValue / 100,
            displayTaxRate: String(numericValue)
        });
    };

    const handleUnitCostBlur = (lineId: string, displayValue: string) => {
        const numericValue = parseDecimal(displayValue);
        updateLine(lineId, {
            unitCostWithoutTax: numericValue,
            displayUnitCost: String(numericValue),
            isCostEdited: true, // Mark as manually edited
        });
    };

    const formatCurrency = (amount: number) => {
        return `¢${amount.toLocaleString("es-CR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
    };

    const setColumnVisibility = (column: keyof ColumnVisibility, isVisible: boolean) => {
        setState(prevState => ({
            ...prevState,
            columnVisibility: {
                ...prevState.columnVisibility,
                [column]: isVisible,
            }
        }));
    };

    const handleSaveColumnVisibility = async () => {
        if (!user) return;
        try {
            await saveCostAssistantSettings(user.id, { columnVisibility: state.columnVisibility });
            toast({ title: "Preferencia Guardada", description: "La visibilidad de las columnas ha sido guardada." });
        } catch (error: any) {
            logError("Failed to save column visibility", { error: error.message });
            toast({ title: "Error", description: "No se pudo guardar la configuración de las columnas.", variant: "destructive" });
        }
    };

    const handleClear = () => {
        setState(prevState => ({
            ...initialState, 
            columnVisibility: prevState.columnVisibility,
            drafts: prevState.drafts, // Keep drafts loaded
        }));
        toast({ title: "Operación Limpiada", description: "Se han borrado todos los datos para iniciar un nuevo análisis." });
    };

    const handleExportToERP = async () => {
        if (state.lines.length === 0) {
            toast({ title: 'No hay datos', description: 'No hay artículos para exportar.', variant: 'destructive' });
            return;
        }
        setState(prevState => ({ ...prevState, exportStatus: 'generating' }));
        try {
            const fileName = await exportForERP(state.lines);
            setState(prevState => ({ ...prevState, exportStatus: 'ready', exportFileName: fileName }));
            toast({ title: 'Exportación Lista', description: 'Tu archivo está listo para ser descargado.' });
        } catch (error: any) {
            logError("Failed to export for ERP", { error: error.message });
            setState(prevState => ({ ...prevState, exportStatus: 'idle' }));
            toast({ title: "Error de Exportación", description: error.message, variant: "destructive" });
        }
    };

     const handleFinalizeExport = async () => {
        if (!state.exportFileName) return;
        try {
            await cleanupExportFile(state.exportFileName);
            setState(prevState => ({ ...prevState, exportStatus: 'idle', exportFileName: null }));
            toast({ title: 'Exportación Finalizada', description: 'El archivo temporal ha sido eliminado del servidor.' });
        } catch (error: any) {
            logError("Failed to cleanup export file", { error: error.message });
            // Even if cleanup fails, reset UI state
            setState(prevState => ({ ...prevState, exportStatus: 'idle', exportFileName: null }));
            toast({ title: "Error de Limpieza", description: `No se pudo eliminar el archivo del servidor. ${error.message}`, variant: "destructive" });
        }
    };
    
    // --- Drafts ---
    const loadDrafts = async () => {
        if (!user) return;
        try {
            const draftsFromDb = await getAllDrafts(user.id);
            setState(prevState => ({ ...prevState, drafts: draftsFromDb }));
        } catch (error: any) {
            logError("Failed to load drafts", { error: error.message });
            toast({ title: "Error", description: "No se pudieron cargar los borradores.", variant: "destructive" });
        }
    };

    const saveDraftAction = async (draftName: string) => {
        if (!user || !draftName) return;

        const newDraft: Omit<CostAnalysisDraft, 'id' | 'createdAt'> = {
            userId: user.id,
            name: draftName,
            lines: state.lines,
            globalCosts: {
                transportCost: state.transportCost,
                otherCosts: state.otherCosts,
            },
            processedInvoices: state.processedInvoices
        };

        try {
            await saveDraft(newDraft);
            toast({ title: "Borrador Guardado", description: `El análisis "${draftName}" ha sido guardado.` });
        } catch (error: any) {
            logError("Failed to save draft", { error: error.message });
            toast({ title: "Error", description: "No se pudo guardar el borrador.", variant: "destructive" });
        }
    };
    
    const loadDraft = (draftToLoad: CostAnalysisDraft) => {
        setState(prevState => ({
            ...prevState,
            lines: draftToLoad.lines,
            transportCost: draftToLoad.globalCosts.transportCost,
            otherCosts: draftToLoad.globalCosts.otherCosts,
            processedInvoices: draftToLoad.processedInvoices
        }));
        toast({ title: "Borrador Cargado", description: `Se ha cargado el análisis "${draftToLoad.name}".` });
    };

    const deleteDraftAction = async (draftId: string) => {
        try {
            await deleteDraft(draftId);
            setState(prevState => ({
                ...prevState,
                drafts: prevState.drafts.filter(d => d.id !== draftId)
            }));
            toast({ title: "Borrador Eliminado", variant: "destructive" });
        } catch (error: any) {
            logError("Failed to delete draft", { error: error.message });
            toast({ title: "Error", description: "No se pudo eliminar el borrador.", variant: "destructive" });
        }
    };

    const linesWithCalculatedCosts = useMemo(() => {
        const totalItems = state.lines.reduce((sum, line) => sum + line.quantity, 0);
        const totalAdditionalCosts = state.transportCost + state.otherCosts;

        return state.lines.map(line => {
            const proportionalAdditionalCostPerUnit = (totalItems > 0 && line.quantity > 0) ? (totalAdditionalCosts / totalItems) : 0;
            const finalUnitCost = line.isCostEdited ? line.unitCostWithoutTax : line.xmlUnitCost + proportionalAdditionalCostPerUnit;
            
            const sellPriceWithoutTax = finalUnitCost / (1 - line.margin);
            const finalSellPrice = sellPriceWithoutTax * (1 + line.taxRate);
            const profitPerLine = (sellPriceWithoutTax - finalUnitCost) * line.quantity;

            return {
                ...line,
                unitCostWithoutTax: finalUnitCost,
                displayUnitCost: String(finalUnitCost.toFixed(4)),
                finalSellPrice,
                sellPriceWithoutTax,
                profitPerLine,
            };
        });
    }, [state.lines, state.transportCost, state.otherCosts]);
    
    // This effect synchronizes the calculated costs back into the main state.
    useEffect(() => {
        // We compare to avoid an infinite loop. Only update if there's a difference in calculated values.
        if (JSON.stringify(state.lines) !== JSON.stringify(linesWithCalculatedCosts)) {
             setState(prevState => ({...prevState, lines: linesWithCalculatedCosts }));
        }
    }, [linesWithCalculatedCosts, state.lines]);

    const totals = useMemo(() => {
        const totalPurchaseCost = state.lines.reduce((sum, line) => sum + (line.unitCostWithTax * line.quantity), 0);
        const totalAdditionalCosts = state.transportCost + state.otherCosts;
        const totalFinalCost = state.lines.reduce((sum, line) => sum + (line.unitCostWithoutTax * line.quantity), 0);
        const totalSellValue = state.lines.reduce((sum, line) => sum + (line.finalSellPrice * line.quantity), 0);
        const estimatedGrossProfit = totalSellValue - totalFinalCost;

        return { totalPurchaseCost, totalAdditionalCosts, totalFinalCost, totalSellValue, estimatedGrossProfit };
    }, [state.lines, state.transportCost, state.otherCosts]);


    const actions = {
        handleFilesDrop,
        removeLine,
        updateLine,
        handleMarginBlur,
        handleTaxRateBlur,
        handleUnitCostBlur,
        formatCurrency,
        handleClear,
        setTransportCost: (cost: number) => setState(prevState => ({ ...prevState, transportCost: cost })),
        setOtherCosts: (cost: number) => setState(prevState => ({ ...prevState, otherCosts: cost })),
        setColumnVisibility,
        handleSaveColumnVisibility,
        handleExportToERP,
        loadDrafts,
        saveDraft: saveDraftAction,
        loadDraft,
        deleteDraft: deleteDraftAction,
        handleFinalizeExport,
    };

    return {
        state: { ...state, totals },
        actions,
    };
};
