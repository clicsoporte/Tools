/**
 * @fileoverview Centralized PDF generation service for the entire application.
 * This module provides a single, configurable function to create consistent and
 * professional-looking PDF documents for quotes, production orders, and purchase requests.
 */
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { format, parseISO } from 'date-fns';
import type { Company } from '../types';

interface DocumentData {
    docTitle: string;
    docId: string;
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
    paperSize?: 'letter' | 'legal';
    topLegend?: string;
}

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    doc.setFontSize(8);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 30, { align: 'right' });
};

export const generateDocument = (data: DocumentData): jsPDF => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: 'p', unit: 'pt', format: data.paperSize || 'letter' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    let finalY = 0;

    const addHeader = () => {
        const topMargin = 50;
        const rightColX = pageWidth - margin;
        
        let companyX = margin;
        
        // Block for company data (center-left)
        let companyY = topMargin + 5;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(data.companyData.name, companyX, companyY);
        companyY += 12;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Cédula: ${data.companyData.taxId}`, companyX, companyY);
        companyY += 10;
        doc.text(data.companyData.address, companyX, companyY);
        companyY += 10;
        doc.text(`Tel: ${data.companyData.phone}`, companyX, companyY);
        companyY += 10;
        doc.text(`Email: ${data.companyData.email}`, companyX, companyY);

        if (data.logoDataUrl) {
            try {
                const imgProps = doc.getImageProperties(data.logoDataUrl);
                const imgHeight = 40; // Increased logo height
                const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                
                // Position logo to the right of the company block
                const logoX = companyX + 160; // Adjust as needed
                const logoY = topMargin + 5; // Align top with company name top

                doc.addImage(data.logoDataUrl, 'PNG', logoX, logoY, imgWidth, imgHeight);
            } catch (e) {
                console.error("Error adding logo image to PDF:", e);
            }
        }
        
        // Block for quote/seller data (right)
        let rightY = topMargin + 5;
        doc.setFontSize(18);
        doc.setFont('Helvetica', 'bold');
        doc.text(data.docTitle, rightColX, rightY, { align: 'right' });
        rightY += 16;
        
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'normal');
        data.meta.forEach(item => {
            doc.text(`${item.label}: ${item.value}`, rightColX, rightY, { align: 'right' });
            rightY += 12;
        });
        
        rightY += 8;

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

        if (data.topLegend) {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(data.topLegend, pageWidth / 2, topMargin - 25, { align: 'center' });
            doc.setTextColor(0);
        }
    };

    const didDrawPage = (hookData: any) => {
        if (hookData.pageNumber > 1) {
            addHeader();
        }
    };
    
    addHeader();
    
    const clientBlockY = 150;
    autoTable(doc, {
        startY: clientBlockY,
        body: data.blocks.map(b => ([
            { content: b.title, styles: { fontStyle: 'bold', cellPadding: { top: 0, right: 5, bottom: 2, left: 0 } } },
            { content: b.content, styles: { fontStyle: 'normal', cellPadding: { top: 0, right: 0, bottom: 2, left: 0 } } }
        ])),
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { fontSize: 9, cellPadding: 0 },
        columnStyles: { 0: { cellWidth: 'wrap' } },
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
        styles: { font: 'Helvetica', fontSize: 9, cellPadding: 4 },
        columnStyles: data.table.columnStyles,
        didDrawPage: didDrawPage,
    });
    
    finalY = (doc as any).lastAutoTable.finalY;
    
    const pageHeight = doc.internal.pageSize.getHeight();
    const totalPages = (doc.internal as any).getNumberOfPages();
    let currentPage = totalPages;

    if (finalY > pageHeight - 140) {
        doc.addPage();
        currentPage++;
        finalY = 50; 
        addHeader();
    } else {
        finalY += 20;
    }
    
    doc.setPage(currentPage);
    
    let leftY = finalY;
    let rightY = finalY;

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
        const splitNotes = doc.splitTextToSize(data.notes, (pageWidth / 2) - margin * 2);
        doc.text(splitNotes, margin, leftY);
    }
    
    const totalsX = pageWidth - margin;
    doc.setFontSize(10);
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        doc.setFontSize(isLast ? 12 : 10);
        
        doc.text(total.label, totalsX - 100, rightY, { align: 'right' });
        doc.text(total.value, totalsX, rightY, { align: 'right' });
        
        rightY += isLast ? 18 : 14;
    });

    for (let i = 1; i <= (doc.internal as any).getNumberOfPages(); i++) {
        doc.setPage(i);
        addFooter(doc, i, (doc.internal as any).getNumberOfPages());
    }

    return doc;
};
