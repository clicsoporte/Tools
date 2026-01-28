/**
 * @fileoverview Centralized PDF generation service for the entire application.
 * This module provides a single, configurable function to create consistent and
 * professional-looking PDF documents for quotes, production orders, and purchase requests.
 */
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { format, parseISO } from 'date-fns';
import type { Company, Product, User, WarehouseLocation } from '../types';
import QRCode from 'qrcode';

export interface DocumentData {
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
    orientation?: 'portrait' | 'landscape';
    topLegend?: string;
    signatureBlock?: { label: string; value: string }[];
}

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    doc.setFontSize(8);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 30, { align: 'right' });
};

export const generateDocument = (data: DocumentData): jsPDF => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: data.orientation || 'portrait', unit: 'pt', format: data.paperSize || 'letter' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    let finalY = 0;
    let pagesDrawnByAutotable = new Set<number>();
    let totalPages = 1;
    let currentPage = 1;

    const addHeader = () => {
        let currentY = 40; // Initial Y position for the main title
        const rightColX = pageWidth - margin;

        // --- 1. Draw Main Title on the first line ---
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'bold');
        doc.text(data.docTitle, pageWidth / 2, currentY, { align: 'center' });
        currentY += 25; // Move down for the next section

        // --- 2. Draw Company Info & Meta Info ---
        let companyY = currentY;
        let rightY = currentY;
        
        let companyX = margin;
        
        if (data.logoDataUrl) {
            try {
                const imgProps = doc.getImageProperties(data.logoDataUrl);
                const imgHeight = 45; 
                const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                doc.addImage(data.logoDataUrl, 'PNG', margin, companyY, imgWidth, imgHeight);
                companyX = margin + imgWidth + 15;
            } catch (e) {
                console.error("Error adding logo image to PDF:", e);
            }
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(data.companyData.name, companyX, companyY);
        companyY += 12;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Cédula: ${data.companyData.taxId}`, companyX, companyY);
        companyY += 10;
        if (data.companyData.address) {
            const splitAddress = doc.splitTextToSize(data.companyData.address, (pageWidth / 2) - margin + 40);
            doc.text(splitAddress, companyX, companyY);
            companyY += (splitAddress.length * 10);
        }
        doc.text(`Tel: ${data.companyData.phone}`, companyX, companyY);
        companyY += 10;
        doc.text(`Email: ${data.companyData.email}`, companyX, companyY);
        
        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        if (data.docId) {
            doc.setTextColor(255, 0, 0); // Red color for ID
            doc.text(data.docId, rightColX, rightY, { align: 'right' });
            doc.setTextColor(0, 0, 0); // Reset color
            rightY += 15;
        }

        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        data.meta.forEach(item => {
            doc.text(`${item.label}: ${item.value}`, rightColX, rightY, { align: 'right' });
            rightY += 12;
        });
        
        if (data.sellerInfo) {
            rightY += 8;
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
            doc.setFont('Helvetica', 'italic');
            doc.text(data.topLegend, margin, 25);
        }
        
        finalY = Math.max(companyY, rightY) + 20;
    };

    const didDrawPage = (hookData: any) => {
        pagesDrawnByAutotable.add(hookData.pageNumber);
        if (hookData.pageNumber > 1) {
            addHeader();
        }
    };
    
    addHeader();
    
    if (data.blocks.length > 0) {
        data.blocks.forEach(block => {
            if (finalY > doc.internal.pageSize.getHeight() - 100) { // Check if space is needed
                doc.addPage();
                addHeader();
            }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(block.title, margin, finalY);
            finalY += 15;
    
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            const contentLines = doc.splitTextToSize(block.content, pageWidth - (margin * 2));
            doc.text(contentLines, margin, finalY);
            finalY += (contentLines.length * 10) + 10;
        });
        finalY += 5;
    }

    if (data.table && data.table.rows && data.table.rows.length > 0) {
        autoTable(doc, {
            head: [data.table.columns],
            body: data.table.rows,
            startY: finalY,
            margin: { right: margin, left: margin, bottom: 120 },
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Helvetica', fontStyle: 'bold' },
            styles: { font: 'Helvetica', fontSize: 9, cellPadding: 4 },
            columnStyles: data.table.columnStyles,
            didDrawPage: didDrawPage,
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }
    
    totalPages = (doc.internal as any).getNumberOfPages();
    currentPage = totalPages;
    doc.setPage(currentPage);
    
    const pageHeight = doc.internal.pageSize.getHeight();
    let leftY = finalY + 20;
    let rightY = finalY + 20;
    
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
        leftY += (splitNotes.length * 10);
    }
    
    const totalsX = pageWidth - margin;
    const padding = 10;
    data.totals.forEach((total, index) => {
        const isLast = index === data.totals.length - 1;
        doc.setFont('Helvetica', isLast ? 'bold' : 'normal');
        doc.setFontSize(isLast ? 12 : 10);
        const valueWidth = doc.getTextWidth(total.value);
        const labelX = totalsX - valueWidth - padding;
        doc.text(total.label, labelX, rightY, { align: 'right' });
        doc.text(total.value, totalsX, rightY, { align: 'right' });
        rightY += isLast ? 18 : 14;
    });

    let bottomContentY = Math.max(leftY, rightY);
    
    if (data.signatureBlock && data.signatureBlock.length > 0) {
        if (bottomContentY > pageHeight - 120) {
            doc.addPage();
            currentPage++; totalPages++;
            addHeader();
            bottomContentY = 80;
        }

        doc.setFontSize(10).setFont('Helvetica', 'bold');
        doc.text('ACEPTACIÓN Y RESPONSABILIDAD:', margin, bottomContentY);
        bottomContentY += 40;

        const signatureWidth = 180;
        const leftSig = data.signatureBlock[0];
        if (leftSig) {
            const x = margin;
            doc.line(x, bottomContentY, x + signatureWidth, bottomContentY);
            doc.setFontSize(9).setFont('Helvetica', 'normal');
            doc.text(leftSig.label, x, bottomContentY + 12);
            doc.text(leftSig.value, x, bottomContentY + 22);
        }
        
        const rightSig = data.signatureBlock[1];
        if (rightSig) {
            const x = pageWidth - margin - signatureWidth;
            doc.line(x, bottomContentY, x + signatureWidth, bottomContentY);
            doc.setFontSize(9).setFont('Helvetica', 'normal');
            doc.text(rightSig.label, x, bottomContentY + 12);
            doc.text(rightSig.value, x, bottomContentY + 22);
        }
    }

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (!pagesDrawnByAutotable.has(i) && i > 1) {
            addHeader();
        }
        addFooter(doc, i, totalPages);
    }

    return doc;
};


const renderLocationPathAsString = (locationId: number, locations: WarehouseLocation[]): string => {
    if (!locationId) return "N/A";
    const path: WarehouseLocation[] = [];
    let current: WarehouseLocation | undefined = locations.find(l => l.id === locationId);
    while (current) {
        path.unshift(current);
        const parentId = current.parentId;
        current = parentId ? locations.find(l => l.id === parentId) : undefined;
    }
    return path.map(l => l.name).join(' > ');
};

export const generateScannerLabelsPDF = async ({ itemsToPrint, allLocations, user }: {
    itemsToPrint: { product: Product, location: WarehouseLocation }[],
    allLocations: WarehouseLocation[],
    user: User | null
}) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    doc.deletePage(1);

    for (const item of itemsToPrint) {
        const { product, location } = item;
        doc.addPage();
        
        const qrContent = `${location.id}>${product.id}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'M', width: 200 });
        
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // QR Code
        doc.addImage(qrCodeDataUrl, 'PNG', margin, margin, 100, 100);

        // Metadata
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor('#666');
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin, margin, { align: 'right' });
        if (user) {
            doc.text(`por ${user.name}`, pageWidth - margin, margin + 12, { align: 'right' });
        }

        // Main Content
        doc.setTextColor('#000');
        doc.setFontSize(150);
        doc.setFont('Helvetica', 'bold');
        doc.text(product.id, pageWidth / 2, pageHeight / 2 - 40, { align: 'center'});

        doc.setFontSize(52);
        doc.setFont('Helvetica', 'normal');
        const secondaryTextLines = doc.splitTextToSize(product.description, pageWidth - margin * 2);
        doc.text(secondaryTextLines, pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        // Footer
        const footerText = renderLocationPathAsString(location.id, allLocations);
        doc.setFontSize(24);
        doc.setFont('Helvetica', 'bold');
        doc.text('Ubicación:', margin, pageHeight - 80);
        doc.setFontSize(28);
        doc.setFont('Helvetica', 'normal');
        const footerLines = doc.splitTextToSize(footerText, pageWidth - margin * 2);
        doc.text(footerLines, margin, pageHeight - 50);
    }
    
    return doc;
};
