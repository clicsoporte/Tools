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
        rows: RowInput[];
        columnStyles?: { [key: string]: any };
    };
    notes?: string;
    paymentInfo?: string;
    totals: { label: string; value: string }[];
}

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
};

export const generateDocument = (data: DocumentData): jsPDF => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: 'p', unit: 'pt', format: 'letter' });
    const margin = 39.68;
    const pageWidth = doc.internal.pageSize.getWidth();
    let finalY = 0;

    const addHeader = () => {
        if (data.logoDataUrl) {
            try {
                const imgProps = doc.getImageProperties(data.logoDataUrl);
                const imgHeight = 25; 
                const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                doc.addImage(data.logoDataUrl, 'PNG', margin, 15, imgWidth, imgHeight);
            } catch (e) {
                console.error("Error adding logo image to PDF:", e);
            }
        }

        const companyX = margin + 60;
        let companyY = 20;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(data.companyData.name, companyX, companyY);
        companyY += 12;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Cédula: ${data.companyData.taxId}`, companyX, companyY);
        companyY += 10;
        doc.text(`Tel: ${data.companyData.phone}`, companyX, companyY);
        companyY += 10;
        doc.text(`Email: ${data.companyData.email}`, companyX, companyY);

        const rightColX = pageWidth - margin;
        let rightY = 20;
        doc.setFontSize(18);
        doc.setFont('Helvetica', 'bold');
        doc.text(data.docTitle, rightColX, rightY, { align: 'right' });
        rightY += 12;
        
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'normal');
        data.meta.forEach(item => {
            doc.text(`${item.label} ${item.value}`, rightColX, rightY, { align: 'right' });
            rightY += 12;
        });

        rightY += 5;

        if (data.sellerInfo) {
            doc.setFont('Helvetica', 'bold');
            doc.text("Vendedor:", rightColX, rightY, { align: 'right' });
            rightY += 10;
            doc.setFont('Helvetica', 'normal');
            doc.text(data.sellerInfo.name, rightColX, rightY, { align: 'right' });
            if (data.sellerInfo.phone) { rightY += 10; doc.text(`Tel: ${data.sellerInfo.phone}`, rightColX, rightY, { align: 'right' }); }
            if (data.sellerInfo.whatsapp) { rightY += 10; doc.text(`WhatsApp: ${data.sellerInfo.whatsapp}`, rightColX, rightY, { align: 'right' }); }
            if (data.sellerInfo.email) { rightY += 10; doc.text(data.sellerInfo.email, rightColX, rightY, { align: 'right' }); }
        }
    };

    const didDrawPage = (hookData: any) => {
        addHeader();
        addFooter(doc, hookData.pageNumber, (doc.internal as any).getNumberOfPages());
    };

    didDrawPage({ pageNumber: 1 });

    const clientBlockY = 110;
    autoTable(doc, {
        startY: clientBlockY,
        body: data.blocks.map(b => ([
            { content: b.title, styles: { fontStyle: 'bold', cellPadding: { top: 0, right: 5, bottom: 2, left: 0 } } },
            { content: b.content, styles: { fontStyle: 'normal', cellPadding: { top: 0, right: 0, bottom: 2, left: 0 } } }
        ])),
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { fontSize: 9, cellPadding: 0 },
        columnStyles: { 0: { cellWidth: 50 } },
        margin: { left: margin, right: margin }
    });
    finalY = (doc as any).lastAutoTable.finalY + 15;

    autoTable(doc, {
        head: [data.table.columns],
        body: data.table.rows,
        startY: finalY,
        margin: { right: margin, left: margin, bottom: 80 },
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Helvetica', fontStyle: 'bold' },
        styles: { font: 'Helvetica', fontSize: 9 },
        columnStyles: data.table.columnStyles,
        didDrawPage: didDrawPage,
    });
    
    finalY = (doc as any).lastAutoTable.finalY;
    
    const pageHeight = doc.internal.pageSize.getHeight();
    if (finalY > pageHeight - 140) { // Check if there's enough space for footer content
        doc.addPage();
        finalY = 40;
    } else {
        finalY += 20;
    }
    
    const totalPages = (doc.internal as any).getNumberOfPages();
    doc.setPage(totalPages);

    let leftY = finalY;
    let rightY = finalY;

    // Draw Notes and Payment Info on the left side
    doc.setFontSize(9);
    if (data.paymentInfo) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Condiciones de Pago:', margin, leftY);
        leftY += 12;
        doc.setFont('Helvetica', 'normal');
        doc.text(data.paymentInfo, margin, leftY);
        leftY += 15;
    }
    if (data.notes) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Notas:', margin, leftY);
        leftY += 12;
        doc.setFont('Helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(data.notes, (pageWidth / 2) - margin);
        doc.text(splitNotes, margin, leftY);
    }
    
    // Draw Totals on the right side
    const totalsX = pageWidth - margin;
    doc.setFontSize(10);
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        doc.setFontSize(isLast ? 12 : 10);
        
        doc.text(total.label, totalsX - 90, rightY, { align: 'right' });
        doc.text(total.value, totalsX, rightY, { align: 'right' });
        
        rightY += isLast ? 18 : 14;
    });

    addFooter(doc, totalPages, totalPages);

    return doc;
};
