/**
 * @fileoverview Centralized PDF generation service for the entire application.
 * This module provides a single, configurable function to create consistent and
 * professional-looking PDF documents for quotes, production orders, and purchase requests.
 */
'use server';

import jsPDF from "jspdf";
import autoTable, { CellDef, RowInput, UserOptions } from "jspdf-autotable";
import { format, parseISO } from 'date-fns';
import type { Company } from '../types';

interface DocumentData {
    docTitle: string;
    docId: string;
    companyData: Company;
    logoDataUrl?: string | null;
    meta: { label: string; value: string }[];
    sellerInfo?: {
        name: string;
        email?: string;
        phone?: string;
        whatsapp?: string;
    };
    blocks: {
        title: string;
        content: string;
    }[];
    table: {
        columns: any[];
        rows: RowInput;
        columnStyles: { [key: string]: any };
    };
    notes?: string;
    paymentInfo?: string;
    totals: { label: string; value: string }[];
}

/**
 * Adds a consistent header to each page of the PDF document.
 * @param doc - The jsPDF instance.
 * @param data - The document data containing header information.
 */
const addHeader = (doc: jsPDF, data: DocumentData) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // --- Left Side: Company Info & Logo ---
    let textStartX = margin;
    if (data.logoDataUrl) {
        try {
            const imgProps = doc.getImageProperties(data.logoDataUrl);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgHeight = 15;
            const imgWidth = imgHeight * aspectRatio;
            doc.addImage(data.logoDataUrl, 'PNG', margin, 15, imgWidth, imgHeight);
            textStartX = margin + imgWidth + 5;
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }
    
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text(data.companyData.name, textStartX, 22);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Cédula: ${data.companyData.taxId}`, textStartX, 28);
    doc.text(data.companyData.address, textStartX, 33);
    doc.text(`Tel: ${data.companyData.phone}`, textStartX, 38);
    doc.text(`Email: ${data.companyData.email}`, textStartX, 43);

    // --- Center: Document Title ---
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text(data.docTitle, pageWidth / 2, 22, { align: 'center' });

    // --- Right Side: Document Meta Info & Seller ---
    let rightY = 22;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`${data.docId}`, pageWidth - margin, rightY, { align: 'right' });
    
    doc.setFontSize(10);
    data.meta.forEach(item => {
        rightY += 6;
        doc.text(`${item.label}: ${item.value}`, pageWidth - margin, rightY, { align: 'right' });
    });

    if (data.sellerInfo) {
        rightY += 8; // Space before seller block
        doc.setFont('Helvetica', 'bold');
        doc.text("Vendedor:", pageWidth - margin, rightY, { align: 'right' });
        rightY += 6;
        doc.setFont('Helvetica', 'normal');
        doc.text(data.sellerInfo.name, pageWidth - margin, rightY, { align: 'right' });
        if (data.sellerInfo.phone) { rightY += 5; doc.text(`Tel: ${data.sellerInfo.phone}`, pageWidth - margin, rightY, { align: 'right' }); }
        if (data.sellerInfo.whatsapp) { rightY += 5; doc.text(`WhatsApp: ${data.sellerInfo.whatsapp}`, pageWidth - margin, rightY, { align: 'right' }); }
        if (data.sellerInfo.email) { rightY += 5; doc.text(data.sellerInfo.email, pageWidth - margin, rightY, { align: 'right' }); }
    }
};

/**
 * Adds a consistent footer to each page of the PDF document.
 * @param doc - The jsPDF instance.
 * @param pageNumber - The current page number.
 * @param totalPages - The total number of pages.
 */
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
};

/**
 * Generates a complete PDF document from structured data.
 * @param data - The structured data for the document.
 * @returns A jsPDF instance representing the final document.
 */
export const generateDocument = (data: DocumentData): jsPDF => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: 'p', unit: 'pt', format: 'letter' });
    const margin = 39.68; // approx 14mm in points
    let finalY = 85;

    // This callback is crucial for adding headers/footers to every page, including the first one.
    const didDrawPage = (hookData: any) => {
        addHeader(doc, data);
        addFooter(doc, hookData.pageNumber, (doc.internal as any).getNumberOfPages());
    };

    // First AutoTable for Client/Delivery Blocks
    autoTable(doc, {
        startY: finalY,
        head: [data.blocks.map(b => b.title)],
        body: [data.blocks.map(b => b.content)],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: {top: 0, right: 0, bottom: 2, left: 0}, fontStyle: 'normal' },
        headStyles: { fontStyle: 'bold' },
        didDrawPage: didDrawPage,
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Main Content Table
    autoTable(doc, {
        head: [data.table.columns],
        body: data.table.rows,
        startY: finalY,
        margin: { top: 85, right: margin, bottom: 40, left: margin },
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Helvetica', fontStyle: 'bold' },
        styles: { font: 'Helvetica', fontSize: 9 },
        columnStyles: data.table.columnStyles,
        didDrawPage: didDrawPage,
    });
    
    finalY = (doc as any).lastAutoTable.finalY || finalY;
    
    // Check if we need a new page for the footer content
    if (finalY > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        finalY = 40; // Reset Y on new page
    } else {
        finalY += 20; // Add some space
    }
    
    doc.setPage(doc.getNumberOfPages()); // Ensure we are on the last page

    const pageWidth = doc.internal.pageSize.getWidth();
    let leftY = finalY;
    let rightY = finalY;

    // --- Bottom Right: Totals ---
    const totalsX = pageWidth - margin;
    doc.setFontSize(10);
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        if(isLast) {
             doc.setLineWidth(0.5);
             doc.line(totalsX, rightY - 4, totalsX - 80, rightY - 4);
             rightY += 2;
        }
        doc.setFontSize(isLast ? 12 : 10);
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        doc.text(`${total.label}`, totalsX, rightY, { align: 'right' });
        doc.text(total.value, totalsX - 100, rightY, { align: 'right' });
        rightY += isLast ? 18 : 14;
    });

    // --- Bottom Left: Notes & Payment Info ---
    doc.setFontSize(10);
    if (data.paymentInfo) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Condiciones de Pago:', margin, leftY);
        leftY += 14;
        doc.setFont('Helvetica', 'normal');
        doc.text(data.paymentInfo, margin, leftY);
        leftY += 18;
    }
    if (data.notes) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Notas:', margin, leftY);
        leftY += 14;
        doc.setFont('Helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(data.notes, (pageWidth / 2) - margin * 2);
        doc.text(splitNotes, margin, leftY);
    }
    
    // Redraw footers on all pages to ensure the page count is correct
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(doc, i, totalPages);
    }

    return doc;
};
