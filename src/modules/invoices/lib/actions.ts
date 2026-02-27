/**
 * @fileoverview Server Actions for the new Invoice Reporter module.
 * These functions handle server-side logic like processing XML files.
 */
'use server';

import { XMLParser } from 'fast-xml-parser';
import type { InvoiceReportLine, ProcessedInvoiceInfo } from '@/modules/core/types';
import { logError } from '@/modules/core/lib/logger';

// Helper to get a value from a potentially nested object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : defaultValue, obj);
};

const parseDecimal = (str: any): number => {
    if (str === null || str === undefined || str === '') return 0;
    const s = String(str).trim();
    
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    
    return parseFloat(s);
};

interface InvoiceParseResult {
    lines: Omit<InvoiceReportLine, 'id' | 'isSelected'>[];
    invoiceInfo: Omit<ProcessedInvoiceInfo, 'status' | 'errorMessage'>;
}

async function parseInvoice(xmlContent: string, fileIndex: number): Promise<InvoiceParseResult | { error: string, details: Partial<ProcessedInvoiceInfo> }> {
    
    if (xmlContent.includes('MensajeHacienda')) {
        return { error: 'El archivo es una respuesta de Hacienda, no una factura.', details: {} };
    }

    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true, 
        parseTagValue: false, 
        isArray: (tagName) => ['LineaDetalle', 'CodigoComercial'].includes(tagName),
    });

    let json;
    try {
        json = parser.parse(xmlContent);
    } catch (e: any) {
        logError('XML parsing failed', { error: e.message, content: xmlContent.substring(0, 500) });
        return { error: 'XML malformado o ilegible.', details: {} };
    }
    
    const rootNode = json.FacturaElectronica || json.TiqueteElectronico;
    
    if (!rootNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        logError('Invalid XML structure for invoice', { detectedRoot });
        if (detectedRoot === 'html' || detectedRoot.startsWith('?xml')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado: ${detectedRoot}`, details: {} };
    }
    
    const clave = getValue(rootNode, ['Clave'], `unknown-key-${fileIndex}`);
    const numeroConsecutivo = getValue(rootNode, ['NumeroConsecutivo'], clave.substring(21, 41));
    const fechaEmision = getValue(rootNode, ['FechaEmision'], new Date().toISOString());
    const emisorNombre = getValue(rootNode, ['Emisor', 'Nombre'], 'Desconocido');

    const invoiceInfo = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };

    const detalleServicio = getValue(rootNode, ['DetalleServicio']);
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], invoiceInfo };
    }

    const lineasDetalle = Array.isArray(detalleServicio.LineaDetalle) ? detalleServicio.LineaDetalle : [detalleServicio.LineaDetalle];
    
    const lines: Omit<InvoiceReportLine, 'id' | 'isSelected'>[] = [];
    for (const linea of lineasDetalle) {
        const cantidad = parseDecimal(getValue(linea, ['Cantidad'], '0'));
        if (cantidad === 0) continue;

        const codigosComerciales = linea.CodigoComercial || [];
        const supplierCodeNode = codigosComerciales.find((c: any) => c.Tipo === '01');
        const itemCode = supplierCodeNode ? supplierCodeNode.Codigo : (codigosComerciales[0]?.Codigo || 'N/A');

        const montoTotalLinea = parseDecimal(getValue(linea, ['MontoTotalLinea'], '0'));
        const subTotal = parseDecimal(getValue(linea, ['SubTotal'], '0'));
        const unitPrice = parseDecimal(getValue(linea, ['PrecioUnitario'], '0'));
        
        // Robust calculation for unit price with tax
        const unitPriceWithTax = cantidad > 0 ? montoTotalLinea / cantidad : 0;
        
        lines.push({
            invoiceKey: numeroConsecutivo,
            invoiceNumber: numeroConsecutivo,
            supplierName: emisorNombre,
            issueDate: fechaEmision,
            itemCode: itemCode,
            itemDescription: getValue(linea, ['Detalle']),
            unitPrice: unitPrice,
            unitPriceWithTax: unitPriceWithTax,
            totalLine: subTotal,
            totalLineWithTax: montoTotalLinea,
        });
    }

    return { lines, invoiceInfo };
}

export async function processInvoicesForReport(xmlContents: string[]): Promise<{ lines: InvoiceReportLine[], processedInvoices: ProcessedInvoiceInfo[] }> {
    let allLines: InvoiceReportLine[] = [];
    const processedInvoices: ProcessedInvoiceInfo[] = [];

    for (const [index, xmlContent] of xmlContents.entries()) {
        try {
            const result = await parseInvoice(xmlContent, index);
            if ('lines' in result) {
                const newLines = result.lines.map((line, lineIndex) => ({
                    ...line,
                    id: `${result.invoiceInfo.invoiceNumber}-${lineIndex}`,
                    isSelected: true, // Default to true
                }));
                allLines = [...allLines, ...newLines];
                if (result.invoiceInfo.supplierName) {
                    processedInvoices.push({ ...result.invoiceInfo, status: 'success' });
                }
            } else {
                 processedInvoices.push({
                    supplierName: result.details.supplierName || 'Desconocido',
                    invoiceNumber: result.details.invoiceNumber || `Archivo ${index + 1}`,
                    invoiceDate: result.details.invoiceDate || new Date().toISOString(),
                    status: 'error',
                    errorMessage: result.error,
                });
            }
        } catch (error: any) {
            processedInvoices.push({
                supplierName: 'Desconocido',
                invoiceNumber: `Archivo ${index + 1}`,
                invoiceDate: new Date().toISOString(),
                status: 'error',
                errorMessage: 'XML malformado o ilegible',
            });
        }
    }
    
    return JSON.parse(JSON.stringify({ lines: allLines, processedInvoices }));
}
