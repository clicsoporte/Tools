/**
 * @fileoverview Custom hook for managing the state and logic of the Invoice Reporter page.
 */
'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import type { InvoiceReportLine, ProcessedInvoiceInfo } from '@/modules/core/types';
import { processInvoicesForReport } from '../lib/actions';
import { logError } from '@/modules/core/lib/logger';
import { exportToExcel } from '@/lib/excel-export';
import { format, parseISO } from 'date-fns';

const initialState = {
    isProcessing: false,
    lines: [] as InvoiceReportLine[],
    processedInvoices: [] as ProcessedInvoiceInfo[],
};

export const useInvoiceReporter = () => {
    usePageTitle().setTitle("Reporteador de Facturas");
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState(initialState);

    const onFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        
        const acceptedFiles = Array.from(event.target.files);
        setState(prevState => ({ ...prevState, isProcessing: true }));
        
        try {
            const fileContents = await Promise.all(
                acceptedFiles.map(file => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsText(file);
                }))
            );
            
            const { lines: processedLines, processedInvoices } = await processInvoicesForReport(fileContents);
            
            setState(prevState => ({ 
                ...prevState, 
                lines: [...prevState.lines, ...processedLines],
                processedInvoices: [...prevState.processedInvoices, ...processedInvoices]
            }));
            const successCount = processedInvoices.filter(p => p.status === 'success').length;
            toast({ title: "Facturas Procesadas", description: `Se agregaron ${processedLines.length} líneas de ${successCount} factura(s).` });

        } catch (error: any) {
            logError("Error processing invoice XMLs for reporter", { error: error.message });
            toast({ title: "Error al Procesar Archivos", description: error.message, variant: "destructive" });
        } finally {
            setState(prevState => ({ ...prevState, isProcessing: false }));
        }
    }, [toast]);
    
    const openFileDialog = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const updateLine = (id: string, updatedFields: Partial<InvoiceReportLine>) => {
        setState(prevState => ({
            ...prevState,
            lines: prevState.lines.map(line => 
                line.id === id ? { ...line, ...updatedFields } : line
            ),
        }));
    };

    const toggleExpense = (id: string, isChecked: boolean) => {
        updateLine(id, { isExpense: isChecked });
    };
    
    const toggleAllExpenses = (isChecked: boolean) => {
         setState(prevState => ({
            ...prevState,
            lines: prevState.lines.map(line => ({ ...line, isExpense: isChecked })),
        }));
    };

    const handleClear = () => {
        setState(initialState);
        toast({ title: "Limpiado", description: "Se han borrado todos los datos del reporteador." });
    };

    const handleExport = () => {
        const expenseLines = state.lines.filter(line => line.isExpense);
        if (expenseLines.length === 0) {
            toast({ title: "Sin Gastos Seleccionados", description: "Marca las líneas que deseas exportar como gastos.", variant: "destructive" });
            return;
        }

        const headers = ["Nº Factura", "Proveedor", "Fecha Emisión", "Código Artículo", "Descripción", "Precio Unitario (s/IVA)", "Precio Unitario (c/IVA)", "Total Línea (s/IVA)", "Total Línea (c/IVA)"];
        const dataToExport = expenseLines.map(line => [
            line.invoiceNumber,
            line.supplierName,
            format(parseISO(line.issueDate), 'dd/MM/yyyy'),
            line.itemCode,
            line.itemDescription,
            line.unitPrice,
            line.unitPriceWithTax,
            line.totalLine,
            line.totalLineWithTax,
        ]);

        exportToExcel({
            fileName: 'reporte_gastos_facturas',
            sheetName: 'Gastos',
            title: 'Reporte de Gastos de Facturas',
            data: [headers, ...dataToExport],
            headers: [], // Headers are part of the data
            columnWidths: [25, 30, 15, 20, 40, 20, 20, 20, 20],
        });
    };
    
    const actions = {
        openFileDialog,
        onFileSelected,
        updateLine,
        toggleExpense,
        toggleAllExpenses,
        handleClear,
        handleExport,
    };

    const selectors = {
        areAllSelected: useMemo(() => state.lines.length > 0 && state.lines.every(l => l.isExpense), [state.lines])
    };

    return {
        state: { ...state, fileInputRef },
        actions,
        selectors,
    };
};
