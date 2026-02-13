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
import { sendEmail } from '@/modules/core/lib/email-service';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAllUsers } from '@/modules/core/lib/auth-client';


async function sendBoletaEmail({
    boletaId,
    subject,
    introText,
    recipientEmails,
}: {
    boletaId: number;
    subject: string;
    introText: string;
    recipientEmails: string[];
}) {
    if (recipientEmails.length === 0) {
        logWarn(`Tried to send boleta email for #${boletaId} but no recipients were found.`);
        return;
    }

    try {
        const details = await getBoletaDetailsServer(boletaId);

        if (!details) {
            throw new Error(`Details for boleta #${boletaId} not found.`);
        }
        
        const { boleta, lines } = details;
        const agreement = await getAgreementDetailsServer(boleta.agreement_id);
        const clientName = agreement?.agreement.client_name || 'N/A';
        const warehouseId = agreement?.agreement.erp_warehouse_id || 'N/A';

        let html = `
            <div style="font-family: sans-serif; font-size: 14px; color: #333;">
                <p>${introText}</p>
                <h3 style="color: #2c3e50;">Boleta: ${boleta.consecutive}</h3>
                ${boleta.status === 'invoiced' && boleta.erp_invoice_number ? `<p><strong>Factura ERP: <span style="color: #c0392b;">${boleta.erp_invoice_number}</span></strong></p>` : ''}
                <p><strong>Cliente:</strong> ${clientName}</p>
                <p><strong>Bodega ERP:</strong> ${warehouseId}</p>
                <p><strong>Fecha de Creación:</strong> ${format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                <hr>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="text-align: left;">Código</th>
                            <th style="text-align: left;">Descripción</th>
                            <th style="text-align: right;">Inv. Físico</th>
                            <th style="text-align: right;">Máximo</th>
                            <th style="text-align: right;">A Reponer</th>
                            <th style="text-align: right;">Precio</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalValue = 0;
        for (const line of lines) {
            const lineValue = line.replenish_quantity * line.price;
            totalValue += lineValue;
            html += `
                <tr>
                    <td style="font-family: monospace;">${line.product_id}</td>
                    <td>${line.product_description}</td>
                    <td style="text-align: right;">${line.counted_quantity}</td>
                    <td style="text-align: right;">${line.max_stock}</td>
                    <td style="text-align: right; font-weight: bold; color: #2980b9;">${line.replenish_quantity}</td>
                    <td style="text-align: right;">${line.price.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</td>
                    <td style="text-align: right;">${lineValue.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</td>
                </tr>
            `;
        }
        
        html += `
                </tbody>
                <tfoot>
                    <tr style="background-color: #f2f2f2; font-weight: bold;">
                        <td colspan="6" style="text-align: right;">Total a Reponer:</td>
                        <td style="text-align: right;">${totalValue.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</td>
                    </tr>
                </tfoot>
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">Este es un correo automático generado por Clic-Tools.</p>
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
        if (creator?.email) {
             const agreementDetails = await getAgreementDetailsServer(newBoleta.agreement_id);
             await sendEmail({
                to: creator.email,
                subject: `Conteo de Consignación Registrado: ${newBoleta.consecutive}`,
                html: `<p>Se ha generado la boleta de reposición <strong>${newBoleta.consecutive}</strong> para el cliente <strong>${agreementDetails?.agreement.client_name}</strong> a partir de tu conteo. Ahora pasará a revisión.</p>`,
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
    
    // Send email notification outside transaction
    try {
        const users: User[] = await getAllUsers();
        const creator = users.find((u: User) => u.name === (updatedBoleta.submitted_by || updatedBoleta.created_by));
        const settings = await getConsignmentSettings();

        // Notify approvers when a boleta is submitted for approval
        if (payload.status === 'pending') {
             const userIds = settings.notificationUserIds || [];
             const additionalEmails = settings.additionalNotificationEmails?.split(',').map(e => e.trim()).filter(Boolean) || [];
             const recipientEmails = users.filter(u => userIds.includes(u.id)).map(u => u.email).concat(additionalEmails);
             
             if (recipientEmails.length > 0) {
                 const agreement = await getAgreementDetailsServer(updatedBoleta.agreement_id);
                 await sendBoletaEmailClient({
                    boletaId: updatedBoleta.id,
                    subject: `Nueva Boleta de Consignación para Aprobación: ${updatedBoleta.consecutive}`,
                    introText: `Se ha enviado una nueva boleta de reposición para el cliente <strong>${agreement?.agreement.client_name}</strong>, preparada por <strong>${updatedBoleta.created_by}</strong> y enviada a aprobación por <strong>${payload.updatedBy}</strong>.`,
                    recipientEmails,
                });
             }
        }

        // Notify the creator/submitter about status changes
        if (creator?.email && creator.name !== payload.updatedBy) {
            if (payload.status === 'approved') {
                await createNotification({ userId: creator.id, message: `La boleta ${updatedBoleta.consecutive} ha sido aprobada.`, href: '/dashboard/consignments/boletas', entityId: updatedBoleta.id, entityType: 'consignment_boleta' });
                await sendBoletaEmailClient({
                    boletaId: updatedBoleta.id,
                    subject: `Boleta de Consignación Aprobada: ${updatedBoleta.consecutive}`,
                    introText: `La boleta <strong>${updatedBoleta.consecutive}</strong> ha sido aprobada y está lista para despacho.`,
                    recipientEmails: [creator.email],
                });
            } else if (payload.status === 'invoiced') {
                 await createNotification({ userId: creator.id, message: `La boleta ${updatedBoleta.consecutive} ha sido facturada.`, href: '/dashboard/consignments/boletas', entityId: updatedBoleta.id, entityType: 'consignment_boleta' });
                await sendBoletaEmailClient({
                    boletaId: updatedBoleta.id,
                    subject: `Boleta de Consignación Facturada: ${updatedBoleta.consecutive}`,
                    introText: `La boleta <strong>${updatedBoleta.consecutive}</strong> ha sido marcada como facturada.`,
                    recipientEmails: [creator.email],
                });
            }
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

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }, statuses?: RestockBoletaStatus[]): Promise<{ boletas: (RestockBoleta & { lines: BoletaLine[] })[] }> {
    return getBoletasByDateRangeServer(agreementId, dateRange, statuses);
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
