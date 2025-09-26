/**
 * @fileoverview Centralized PDF generation service for the entire application.
 * This module provides a single, configurable function to create consistent and
 * professional-looking PDF documents for quotes, production orders, and purchase requests.
 */
'use client';

import jsPDF from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import { format, parseISO } from 'date-fns';
import type { Company } from '../types';

interface DocumentData {
    docTitle: string;
    meta: { label: string; value: string }[];
    companyData: Company;
    logoDataUrl?: string | null;
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
        columnStyles?: { [key: string]: any };
    };
    notes?: string;
    paymentInfo?: string;
    totals: { label: string; value: string }[];
}

const addHeader = (doc: jsPDF, data: DocumentData) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14; // Left and right margin in points
    let startY = 22;

    if (data.logoDataUrl) {
        try {
            const imgProps = doc.getImageProperties(data.logoDataUrl);
            const imgHeight = 30; // Increased logo height
            const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
            doc.addImage(data.logoDataUrl, 'PNG', margin, 15, imgWidth, imgHeight);
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }

    const companyX = margin + 50; // Position next to logo
    let companyY = 20;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(data.companyData.name, companyX, companyY);
    companyY += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Cédula: ${data.companyData.taxId}`, companyX, companyY);
    companyY += 5;
    doc.text(`Tel: ${data.companyData.phone}`, companyX, companyY);
    companyY += 5;
    doc.text(`Email: ${data.companyData.email}`, companyX, companyY);

    const rightColX = pageWidth - margin;
    let rightY = 22;

    // Quote Title
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text(data.docTitle, rightColX, rightY, { align: 'right' });
    rightY += 8;

    // Quote Meta Data
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    data.meta.forEach(item => {
        doc.text(`${item.label} ${item.value}`, rightColX, rightY, { align: 'right' });
        rightY += 5;
    });

    rightY += 6; // Space before seller info

    // Seller Info
    if (data.sellerInfo) {
        doc.setFont('Helvetica', 'bold');
        doc.text("Vendedor:", rightColX, rightY, { align: 'right' });
        rightY += 6;
        doc.setFont('Helvetica', 'normal');
        doc.text(data.sellerInfo.name, rightColX, rightY, { align: 'right' });
        if (data.sellerInfo.phone) { rightY += 5; doc.text(`Tel: ${data.sellerInfo.phone}`, rightColX, rightY, { align: 'right' }); }
        if (data.sellerInfo.whatsapp) { rightY += 5; doc.text(`WhatsApp: ${data.sellerInfo.whatsapp}`, rightColX, rightY, { align: 'right' }); }
        if (data.sellerInfo.email) { rightY += 5; doc.text(data.sellerInfo.email, rightColX, rightY, { align: 'right' }); }
    }
};

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
};

export const generateDocument = (data: DocumentData): jsPDF => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: 'p', unit: 'pt', format: 'letter' });
    const margin = 39.68;
    let finalY = 0;

    const didDrawPage = (hookData: any) => {
        addHeader(doc, data);
        addFooter(doc, hookData.pageNumber, (doc.internal as any).getNumberOfPages());
    };

    didDrawPage({ pageNumber: 1 });

    const clientBlockY = 85;
    autoTable(doc, {
        startY: clientBlockY,
        body: data.blocks.map(b => ([
            { content: b.title, styles: { fontStyle: 'bold', cellPadding: { right: 5 } } },
            { content: b.content, styles: { fontStyle: 'normal' } }
        ])),
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { fontSize: 10, cellPadding: 0 },
        columnStyles: { 0: { cellWidth: 70 } },
        margin: { left: margin, right: margin }
    });
    finalY = (doc as any).lastAutoTable.finalY + 15;

    autoTable(doc, {
        head: [data.table.columns],
        body: Array.isArray(data.table.rows) ? data.table.rows : [data.table.rows],
        startY: finalY,
        margin: { top: 85, right: margin, bottom: 40, left: margin },
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Helvetica', fontStyle: 'bold' },
        styles: { font: 'Helvetica', fontSize: 9 },
        columnStyles: data.table.columnStyles,
        didDrawPage: didDrawPage,
    });
    
    finalY = (doc as any).lastAutoTable?.finalY || finalY;
    
    const pageHeight = doc.internal.pageSize.getHeight();
    if (finalY > pageHeight - 120) {
        doc.addPage();
        finalY = 40;
    } else {
        finalY += 20;
    }
    
    const totalPages = (doc.internal as any).getNumberOfPages();
    doc.setPage(totalPages);

    const pageWidth = doc.internal.pageSize.getWidth();
    let leftY = finalY;
    let rightY = finalY;

    // Draw Totals on the right side
    const totalsX = pageWidth - margin;
    doc.setFontSize(10);
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        if (isLast) rightY += 4; // Extra space before the final total
        
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        doc.setFontSize(isLast ? 12 : 10);
        
        doc.text(total.label, totalsX - 85, rightY, { align: 'right' });
        doc.text(total.value, totalsX, rightY, { align: 'right' });
        
        rightY += isLast ? 18 : 14;
    });

    // Draw Notes and Payment Info on the left side
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
        const splitNotes = doc.splitTextToSize(data.notes, (pageWidth / 2) - margin);
        doc.text(splitNotes, margin, leftY);
    }
    
    addFooter(doc, totalPages, totalPages);

    return doc;
};
