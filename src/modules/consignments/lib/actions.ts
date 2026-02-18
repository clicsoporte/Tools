
/**
 * @fileoverview Client-side functions for interacting with the Consignments module's server-side DB functions.
 */
'use client';

import { 
    getAgreements as getAgreementsServer,
    saveAgreement as saveAgreementServer,
    getAgreementDetails as getAgreementDetailsServer,
    deleteAgreement as deleteAgreementServer,
    startOrContinueCountingSession as startOrContinueCountingSessionServer,
    saveCountLine as saveCountLineServer,
    abandonCountingSession as abandonCountingSessionServer, 
    generateBoletaFromSession as generateBoletaFromSessionServer, 
    getBoletas as getBoletasServer,
    updateBoletaStatus as updateBoletaStatusServer,
    getBoletaDetails as getBoletaDetailsServer,
    updateBoleta as updateBoletaServer,
    getActiveCountingSessionForUser as getActiveCountingSessionForUserServer,
    getBoletasByDateRange as getBoletasByDateRangeServer,
    getActiveConsignmentSessions as getActiveConsignmentSessionsServer,
    forceReleaseConsignmentSession as forceReleaseConsignmentSessionServer,
    getSettings as getConsignmentSettingsServer,
    saveSettings as saveConsignmentSettingsServer,
} from './db';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory, RestockBoletaStatus, ConsignmentSettings, User } from '@/modules/core/types';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';
import { createNotification, createNotificationForPermission } from '@/modules/core/lib/notifications-actions';
import { getCompanySettings } from '@/modules/core/lib/db';
import { sendEmail } from '@/modules/core/lib/email-service';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAllUsers } from '@/modules/core/lib/auth-client';


async function sendBoletaEmail({
    boletaId,
    subject,
    introText,
    recipientEmails,
    includePrice = false,
}: {
    boletaId: number;
    subject: string;
    introText: string;
    recipientEmails: string[];
    includePrice?: boolean;
}) {
    if (recipientEmails.length === 0) {
        logWarn(`Tried to send boleta email for #${boletaId} but no recipients were found.`);
        return;
    }

    try {
        const details = await getBoletaDetailsServer(boletaId);
        if (!details) throw new Error(`Details for boleta #${boletaId} not found.`);
        
        const companySettings = await getCompanySettings();
        const { boleta, lines } = details;
        const agreement = await getAgreementDetailsServer(boleta.agreement_id);
        const clientName = agreement?.agreement.client_name || 'N/A';
        const warehouseId = agreement?.agreement.erp_warehouse_id || 'N/A';
        const submittedBy = boleta.submitted_by || boleta.created_by;

        let html = `
            <div style="font-family: sans-serif; font-size: 14px; color: #333;">
                <p>${introText}</p>
                <h3 style="color: #2c3e50;">Boleta: ${boleta.consecutive}</h3>
                ${boleta.status === 'invoiced' && boleta.erp_invoice_number ? `<p><strong>Factura ERP: <span style="color: #c0392b;">${boleta.erp_invoice_number}</span></strong></p>` : ''}
                <p><strong>Cliente:</strong> ${clientName}</p>
                <p><strong>Bodega ERP:</strong> ${warehouseId}</p>
                <p><strong>Fecha de Creación:</strong> ${format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                ${submittedBy ? `<p><strong>Toma de Inventario por:</strong> ${submittedBy}</p>` : ''}
                <hr>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="text-align: left;">Código</th>
                            <th style="text-align: left;">Descripción</th>
                            <th style="text-align: right;">Inv. Físico</th>
                            <th style="text-align: right;">Máximo</th>
                            <th style="text-align: right;">A Reponer</th>
                            ${includePrice ? `
                            <th style="text-align: right;">Precio</th>
                            <th style="text-align: right;">Total</th>
                            ` : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalValue = 0;
        for (const line of lines) {
            const lineTotal = line.replenish_quantity * line.price;
            totalValue += lineTotal;
            html += `
                <tr>
                    <td style="font-family: monospace;">${line.product_id}</td>
                    <td>${line.product_description}</td>
                    <td style="text-align: right;">${line.counted_quantity}</td>
                    <td style="text-align: right;">${line.max_stock}</td>
                    <td style="text-align: right; font-weight: bold; color: #2980b9;">${line.replenish_quantity}</td>
                    ${includePrice ? `
                    <td style="text-align: right;">¢${line.price.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                    <td style="text-align: right; font-weight: bold;">¢${lineTotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                    ` : ''}
                </tr>
            `;
        }
        
        html += `</tbody>`;

        if (includePrice) {
            html += `
                <tfoot>
                    <tr>
                        <td colspan="6" style="text-align: right; font-weight: bold;">Total a Reponer:</td>
                        <td style="text-align: right; font-weight: bold; font-size: 14px;">¢${totalValue.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            `;
        }

        html += `
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">Este es un correo automático generado por Clic-Tools.</p>
            ${companySettings?.publicUrl ? `<p style="font-size: 12px; color: #7f8c8d;">Accede al sistema en: <a href="${companySettings.publicUrl}">${companySettings.publicUrl}</a></p>` : ''}
            </div>
        `;
        
        await sendEmail({
            to: recipientEmails,
            subject,
            html,
        });
        logInfo(`Consignment boleta email sent for #${boletaId} to ${recipientEmails.length} recipient(s).`);

    } catch (error: any) {
        logError('Failed to send boleta HTML email', { error: error.message, boletaId });
    }
}

export async function getConsignmentAgreements(): Promise<(ConsignmentAgreement & { product_count?: number })[]> {
    return getAgreementsServer();
}

export async function saveConsignmentAgreement(agreement: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id?: number }, products: Omit<ConsignmentProduct, 'id' | 'agreement_id'>[]) {
    return saveAgreementServer(agreement, products);
}

export async function getAgreementDetails(agreementId: number): Promise<{ agreement: ConsignmentAgreement, products: ConsignmentProduct[] } | null> {
    return getAgreementDetailsServer(agreementId);
}

export async function deleteConsignmentAgreement(agreementId: number): Promise<{ success: boolean; message: string }> {
    await authorizeAction('consignments:setup');
    return deleteAgreementServer(agreementId);
}

export async function getActiveCountingSessionForUser(userId: number): Promise<(CountingSession & { lines: CountingSessionLine[] }) | null> {
    await authorizeAction('consignments:count');
    return getActiveCountingSessionForUserServer(userId);
}

export async function startOrContinueCountingSession(agreementId: number, userId: number): Promise<CountingSession & { lines: CountingSessionLine[] }> {
    return startOrContinueCountingSessionServer(agreementId, userId);
}

export async function saveCountLine(sessionId: number, productId: string, quantity: number): Promise<void> {
    return saveCountLineServer(sessionId, productId, quantity);
}

export async function abandonCountingSession(sessionId: number, userId: number): Promise<void> {
    await authorizeAction('consignments:count');
    return abandonCountingSessionServer(sessionId, userId);
}

export async function generateBoletaFromSession(sessionId: number, userId: number, userName: string): Promise<RestockBoleta> {
    const newBoleta = await generateBoletaFromSessionServer(sessionId, userId, userName);
    
    try {
        const creator = (await getAllUsers()).find(u => u.name === userName);
        const agreementDetails = await getAgreementDetailsServer(newBoleta.agreement_id);
        const introText = `Se ha generado la boleta de reposición <strong>${newBoleta.consecutive}</strong> para el cliente <strong>${agreementDetails?.agreement.client_name}</strong> a partir de tu conteo. Ahora pasará a revisión.`;
        
        if (creator?.email) {
             await sendBoletaEmail({
                boletaId: newBoleta.id,
                subject: `Conteo de Consignación Registrado: ${newBoleta.consecutive}`,
                introText,
                recipientEmails: [creator.email],
                includePrice: false, // Do not show prices to the counter
            });
        }
    } catch (e: any) {
        logError('Failed to send new boleta creation email', { boletaId: newBoleta.id, error: e.message });
    }

    return newBoleta;
}

export async function getBoletas(filters: { status: string[], dateRange?: { from?: Date, to?: Date }}) {
    return getBoletasServer(filters);
}

export async function updateBoletaStatus(payload: { boletaId: number, status: string, notes: string, updatedBy: string, erpInvoiceNumber?: string }): Promise<RestockBoleta> {
    const updatedBoleta = await updateBoletaStatusServer(payload);
    
    try {
        const statusConfig = {
            review: 'En Revisión',
            pending: 'Pendiente Aprobación',
            approved: 'Aprobada',
            sent: 'Enviada',
            invoiced: 'Facturada',
            canceled: 'Cancelada',
        };
        const statusLabel = (statusConfig as any)[payload.status] || payload.status;
        const users: User[] = await getAllUsers();
        const creator = users.find((u: User) => u.name === (updatedBoleta.submitted_by || updatedBoleta.created_by));
        const settings = await getConsignmentSettingsServer();
        const agreementDetails = await getAgreementDetailsServer(updatedBoleta.agreement_id);
        const agreementNotificationUserIds = agreementDetails?.agreement.notification_user_ids || [];

        // 1. Notify approvers when a boleta is submitted for approval
        if (payload.status === 'pending') {
             const globalUserIds = settings.notificationUserIds || [];
             const additionalEmails = settings.additionalNotificationEmails?.split(',').map(e => e.trim()).filter(Boolean) || [];
             const allUserIds = new Set([...globalUserIds, ...agreementNotificationUserIds]);
             const recipientEmails = users.filter(u => allUserIds.has(u.id)).map(u => u.email).concat(additionalEmails);
             
             if (recipientEmails.length > 0) {
                 await sendBoletaEmail({
                    boletaId: updatedBoleta.id,
                    subject: `Nueva Boleta de Consignación para Aprobación: ${updatedBoleta.consecutive}`,
                    introText: `Se ha enviado una nueva boleta de reposición para el cliente <strong>${agreementDetails?.agreement.client_name}</strong>, preparada por <strong>${updatedBoleta.created_by}</strong> y enviada a aprobación por <strong>${payload.updatedBy}</strong>.`,
                    recipientEmails,
                    includePrice: true,
                });
             }
        }
        
        const milestoneStatuses: RestockBoletaStatus[] = ['approved', 'sent', 'invoiced', 'canceled'];

        // 2. Notify the creator about major status changes (milestones)
        if (creator && creator.id !== payload.updatedBy && milestoneStatuses.includes(payload.status as RestockBoletaStatus)) {
            const subject = `Boleta ${updatedBoleta.consecutive} actualizada a: ${statusLabel}`;
            const introText = `La boleta <strong>${updatedBoleta.consecutive}</strong> para <strong>${agreementDetails?.agreement.client_name}</strong> ha sido actualizada al estado <strong>${statusLabel}</strong> por ${payload.updatedBy}.
                ${payload.status === 'approved' ? ` Aprobada por <strong>${updatedBoleta.approved_by}</strong>. Ya está lista para despacho.` : ''}
                ${payload.status === 'invoiced' && updatedBoleta.erp_invoice_number ? ` Factura ERP: ${updatedBoleta.erp_invoice_number}` : ''}`;
                
            await createNotification({ userId: creator.id, message: subject, href: '/dashboard/consignments/boletas', entityId: updatedBoleta.id, entityType: 'consignment_boleta' });
            
            await sendBoletaEmail({
                boletaId: updatedBoleta.id,
                subject,
                introText,
                recipientEmails: [creator.email],
                includePrice: false, // Creator never sees prices
            });
        }
        
        // 3. Notify agreement-specific users about ANY status change (excluding the user who triggered the change to avoid self-notification)
        const agreementRecipientEmails = users
            .filter(u => agreementNotificationUserIds.includes(u.id) && u.name !== payload.updatedBy)
            .map(u => u.email);
        
        if (agreementRecipientEmails.length > 0) {
            const subject = `Actualización de Estado - Boleta ${updatedBoleta.consecutive} (${agreementDetails?.agreement.client_name})`;
            const introText = `La boleta <strong>${updatedBoleta.consecutive}</strong> para el cliente <strong>${agreementDetails?.agreement.client_name}</strong> ha cambiado de estado a <strong>${statusLabel}</strong>.`;
            await sendBoletaEmail({
                boletaId: updatedBoleta.id,
                subject,
                introText,
                recipientEmails: agreementRecipientEmails,
                includePrice: true // Agreement stakeholders see prices
            });
        }

    } catch (e: any) {
        logError('Failed to send boleta status update notification (from actions)', { boletaId: payload.boletaId, error: e.message });
    }
    
    return updatedBoleta;
}

export async function getBoletaDetails(boletaId: number): Promise<{ boleta: RestockBoleta, lines: BoletaLine[], history: BoletaHistory[] } | null> {
    return getBoletaDetailsServer(boletaId);
}

export async function updateBoleta(boleta: RestockBoleta, lines: BoletaLine[], updatedBy: string): Promise<RestockBoleta> {
    return updateBoletaServer(boleta, lines, updatedBy);
}

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }, statuses?: RestockBoletaStatus[]): Promise<(RestockBoleta & { lines: BoletaLine[]; history: BoletaHistory[]; })[]> {
    const result = await getBoletasByDateRangeServer(agreementId, dateRange, statuses);
    return result;
}


export async function getActiveConsignmentSessions(): Promise<(CountingSession & { agreement_name: string; user_name: string; })[]> {
    await authorizeAction('consignments:locks:manage');
    return getActiveConsignmentSessionsServer();
}

export async function forceReleaseConsignmentSession(sessionId: number, updatedBy: string): Promise<void> {
    await authorizeAction('consignments:locks:manage');
    return forceReleaseConsignmentSessionServer(sessionId, updatedBy);
}

export async function getConsignmentSettings(): Promise<ConsignmentSettings> {
    return getConsignmentSettingsServer();
}

export async function saveConsignmentSettings(settings: ConsignmentSettings): Promise<void> {
    return saveConsignmentSettingsServer(settings);
}
