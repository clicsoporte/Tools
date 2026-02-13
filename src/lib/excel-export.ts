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
    const dataForSheet: any[][] = [];
    let headerRowIndex = 0;

    // Add title row if provided
    if (title) {
        dataForSheet.push([title]);
        headerRowIndex++;
    }

    // Add metadata rows if provided
    if (meta && meta.length > 0) {
        meta.forEach(item => dataForSheet.push([item.label, item.value]));
        headerRowIndex += meta.length;
    }

    // Add a spacer row if there was a title or meta
    if (title || (meta && meta.length > 0)) {
        dataForSheet.push([]); 
        headerRowIndex++;
    }

    // Add table headers and data
    dataForSheet.push(headers);
    data.forEach(row => dataForSheet.push(row));

    const worksheet = XLSX.utils.aoa_to_sheet(dataForSheet);

    // --- Apply Styles and Merges ---
    const headerStyle = { font: { bold: true } };
    const titleStyle = { font: { bold: true, sz: 16 } };

    // Style and merge title row
    if (title) {
        const titleCellAddress = XLSX.utils.encode_cell({ r: 0, c: 0 });
        if (worksheet[titleCellAddress]) {
            worksheet[titleCellAddress].s = titleStyle;
        }
        
        const merge = { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, headers.length - 1) } };
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push(merge);
    }
    
    // Style meta labels
    if (meta && meta.length > 0) {
        for (let i = 0; i < meta.length; i++) {
            const metaCellAddress = XLSX.utils.encode_cell({ r: (title ? 1 : 0) + i, c: 0 });
            if (worksheet[metaCellAddress]) {
                worksheet[metaCellAddress].s = headerStyle;
            }
        }
    }

    // Style table headers
    for (let C = 0; C < headers.length; ++C) {
        const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        if (!worksheet[address]) continue;
        worksheet[address].s = headerStyle;
    }
    
    if (columnWidths) {
        worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};