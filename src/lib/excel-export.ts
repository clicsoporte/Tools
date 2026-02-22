/**
 * @fileoverview Utility function for exporting data to an Excel (.xlsx) file.
 * This module uses the 'xlsx' library (SheetJS) to create and download Excel files
 * on the client-side.
 */
'use client';

import * as XLSX from 'xlsx';

interface ExportToExcelOptions {
    fileName: string;
    sheetName?: string;
    title?: string;
    meta?: { label: string; value: any }[];
    headers: string[];
    data: (string | number | null | undefined)[][];
    columnWidths?: number[];
}

/**
 * Creates and downloads an Excel (.xlsx) file from the provided data.
 * Can include a title and metadata rows before the main table.
 * 
 * @param {ExportToExcelOptions} options - The configuration for the Excel file.
 */
export const exportToExcel = ({
    fileName,
    sheetName = 'Datos',
    title,
    meta,
    headers,
    data,
    columnWidths,
}: ExportToExcelOptions) => {
    
    // Create worksheet from the array of arrays
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    let currentRow = 0;

    // Add title row if provided
    if (title) {
        XLSX.utils.sheet_add_aoa(worksheet, [[title]], { origin: `A${currentRow + 1}` });
        const titleCellAddress = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
        if (worksheet[titleCellAddress]) {
            worksheet[titleCellAddress].s = { font: { bold: true, sz: 16 } };
        }
        const merge = { s: { r: currentRow, c: 0 }, e: { r: currentRow, c: Math.max(0, (headers.length > 0 ? headers.length : data[0]?.length || 1) - 1) } };
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push(merge);
        currentRow++;
    }
    
    // Add metadata rows if provided
    if (meta && meta.length > 0) {
        meta.forEach(item => {
            XLSX.utils.sheet_add_aoa(worksheet, [[item.label, item.value]], { origin: `A${currentRow + 1}` });
            const metaCellAddress = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
            if (worksheet[metaCellAddress]) {
                worksheet[metaCellAddress].s = { font: { bold: true } };
            }
            currentRow++;
        });
    }
    
    // Add a spacer row if there was a title or meta
    if (title || (meta && meta.length > 0)) {
        currentRow++;
    }
    
    // Add table headers and data
    const dataForSheet = headers.length > 0 ? [headers, ...data] : data;
    XLSX.utils.sheet_add_aoa(worksheet, dataForSheet, { origin: `A${currentRow + 1}` });

    // Style table headers if they were provided
    if (headers.length > 0) {
        const headerStyle = { font: { bold: true } };
        for (let C = 0; C < headers.length; ++C) {
            const address = XLSX.utils.encode_cell({ r: currentRow, c: C });
            if (!worksheet[address]) continue;
            worksheet[address].s = headerStyle;
        }
    }
    
    if (columnWidths) {
        worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};