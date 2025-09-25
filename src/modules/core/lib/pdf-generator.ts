/**
 * @fileoverview Centralized PDF generation service for the entire application.
 * This module provides a single, configurable function to create consistent and
 * professional-looking PDF documents for quotes, production orders, and purchase requests.
 */
'use client';

import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { format } from 'date-fns';
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
 * This version uses absolute positioning for pixel-perfect layout replication.
 * @param doc - The jsPDF instance.
 * @param data - The document data containing header information.
 */
const addHeader = (doc: jsPDF, data: DocumentData) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 39.68;
    let startY = 22;

    if (data.logoDataUrl) {
        try {
            const imgProps = doc.getImageProperties(data.logoDataUrl);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgHeight = 28;
            const imgWidth = Math.min(imgHeight * aspectRatio, 50);
            doc.addImage(data.logoDataUrl, 'PNG', margin, 15, imgWidth, imgHeight);
        } catch (e) {
            console.error("Error adding logo image to PDF:", e);
        }
    }

    const companyX = margin;
    let companyY = 55;
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
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text(data.docTitle, rightColX, rightY, { align: 'right' });
    rightY += 8;

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    data.meta.forEach(item => {
        const labelWidth = doc.getStringUnitWidth(item.label + ":") * doc.getFontSize();
        doc.setFont('Helvetica', 'bold');
        doc.text(item.label + ":", rightColX - 35, rightY, { align: 'left' });
        doc.setFont('Helvetica', 'normal');
        doc.text(item.value, rightColX, rightY, { align: 'right' });
        rightY += 5;
    });

    if (data.sellerInfo) {
        rightY += 6;
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
    let finalY = 85; 

    const didDrawPage = (hookData: any) => {
        addHeader(doc, data);
        addFooter(doc, hookData.pageNumber, (doc.internal as any).getNumberOfPages());
    };
    
    didDrawPage({ pageNumber: 1 });
    
    autoTable(doc, {
        startY: finalY,
        body: data.blocks.map(b => ([
            { content: b.title, styles: { fontStyle: 'bold', cellWidth: 70 } },
            { content: b.content, styles: { fontStyle: 'normal' } }
        ])),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: {top: 1, right: 0, bottom: 1, left: 0} },
        margin: { left: margin, right: margin }
    });
    finalY = (doc as any).lastAutoTable.finalY + 15;
    
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

    const totalsX = pageWidth - margin;
    doc.setFontSize(10);
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        if(isLast) {
             rightY += 4;
        }
        doc.setFontSize(isLast ? 12 : 10);
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        const labelWidth = doc.getStringUnitWidth(total.label + ":") * doc.getFontSize() / doc.internal.scaleFactor;
        doc.text(`${total.label}:`, totalsX - 85, rightY, { align: 'right' });
        doc.text(total.value, totalsX, rightY, { align: 'right' });
        rightY += isLast ? 18 : 14;
    });

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
