/**
 * @fileoverview Client-side functions for interacting with the Consignments module's server-side DB functions.
 */
'use client';

import { 
    getAgreements as getAgreementsServer,
    saveAgreement as saveAgreementServer,
    getAgreementDetails as getAgreementDetailsServer,
    deleteAgreement as deleteAgreementServer,
    getBoletas as getBoletasServer,
    updateBoletaStatus as updateBoletaStatusServer,
    getBoletaDetails as getBoletaDetailsServer,
    updateBoleta as updateBoletaServer,
    getBoletasByDateRange as getBoletasByDateRangeServer,
    getSettings as getConsignmentSettingsServer,
    saveSettings as saveConsignmentSettingsServer,
    savePhysicalCount as savePhysicalCountServer,
    createClosureFromCount as createClosureFromCountServer,
    getLatestPhysicalCount as getLatestPhysicalCountServer,
    getPeriodClosures as getPeriodClosuresServer,
    getPeriodClosureDetails as getPeriodClosureDetailsServer,
    approvePeriodClosure as approvePeriodClosureServer,
    rejectPeriodClosure as rejectPeriodClosureServer,
    getConsignmentsBillingReportData as getConsignmentsBillingReportDataFromDb,
    saveReplenishmentBoleta as saveReplenishmentBoletaServer,
    getPhysicalCountByRef as getPhysicalCountByRefServer,
    lockAgreement as lockAgreementServer,
    forceRelayLock as forceRelayLockServer,
    releaseAgreementLock as releaseAgreementLockServer,
    getLatestApprovedClosure,
    getPhysicalCountHistory,
    getRecentPhysicalCounts as getRecentPhysicalCountsServer,
    saveAdjustment as saveAdjustmentServer,
    annulPeriodClosure as annulPeriodClosureServer,
    getAdjustmentsInPeriod
} from './db';
import type { ConsignmentAgreement, ConsignmentProduct, RestockBoleta, BoletaLine, BoletaHistory, User, Product, RestockBoletaStatus, ConsignmentSettings, PeriodClosure, PhysicalCount, BoletaType, ConsignmentAdjustment, ConsignmentAdjustmentReason } from '@/modules/core/types';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import { logError, logInfo, logWarn } from '@/modules/core/lib/logger';
import { createNotification, createNotificationForPermission } from '@/modules/core/lib/notifications-actions';
import { getCompanySettings, getAllProducts as getAllProductsFromMainDb } from '@/modules/core/lib/db';
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
                ${boleta.erp_movement_id ? `<p><strong>Movimiento Interno:</strong> ${boleta.erp_movement_id}</p>` : ''}
                <p><strong>Cliente:</strong> ${clientName}</p>
                <p><strong>Bodega ERP:</strong> ${warehouseId}</p>
                <p><strong>Fecha de Creación:</strong> ${format(parseISO(boleta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                ${boleta.delivery_date ? `<p><strong>Fecha de Entrega:</strong> ${format(parseISO(boleta.delivery_date), 'dd/MM/yyyy')}</p>` : ''}
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

async function sendClosurePendingEmail({
    closure,
    agreementDetails,
    physicalCount,
    recipientEmails,
}: {
    closure: PeriodClosure;
    agreementDetails: { agreement: ConsignmentAgreement; products: ConsignmentProduct[] };
    physicalCount: { productId: string; quantity: number }[];
    recipientEmails: string[];
}) {
    if (recipientEmails.length === 0) return;

    try {
        const companySettings = await getCompanySettings();
        const allProducts = await getAllProductsFromMainDb();
        const productMap = new Map(allProducts.map(p => [p.id, p.description]));

        const subject = `Nuevo Cierre de Periodo Pendiente: ${closure.consecutive}`;
        let html = `
            <div style="font-family: sans-serif; font-size: 14px; color: #333;">
                <p>El usuario <strong>${closure.created_by}</strong> ha generado un nuevo cierre de periodo para el cliente <strong>${agreementDetails.agreement.client_name}</strong>.</p>
                <p>El cierre <strong>${closure.consecutive}</strong> está pendiente de aprobación. A continuación se muestra el detalle del conteo físico registrado:</p>
                <hr>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="text-align: left;">Código</th>
                            <th style="text-align: left;">Descripción</th>
                            <th style="text-align: right;">Cantidad Contada</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const line of physicalCount) {
            html += `
                <tr>
                    <td style="font-family: monospace;">${line.productId}</td>
                    <td>${productMap.get(line.productId) || 'Producto Desconocido'}</td>
                    <td style="text-align: right; font-weight: bold;">${line.quantity}</td>
                </tr>
            `;
        }

        html += `</tbody></table>
            <p style="margin-top: 20px;">Por favor, ingrese a Clic-Tools en la sección de "Gestión de Cierres" para revisar, vincular con el período anterior y aprobar.</p>
            ${companySettings?.publicUrl ? `<p style="font-size: 12px; color: #7f8c8d;">Accede al sistema en: <a href="${companySettings.publicUrl}">${companySettings.publicUrl}</a></p>` : ''}
            </div>
        `;
        
        await sendEmail({
            to: recipientEmails,
            subject,
            html,
        });
        logInfo(`Closure pending email sent for #${closure.consecutive} to ${recipientEmails.length} recipient(s).`);

    } catch (error: any) {
        logError('Failed to send closure pending HTML email', { error: error.message, closureId: closure.id });
    }
}


export async function getConsignmentAgreements(): Promise<(ConsignmentAgreement & { product_count?: number; boleta_count?: number })[]> {
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

export async function savePhysicalCount(agreementId: number, lines: { productId: string; quantity: number }[], userName: string): Promise<void> {
    await authorizeAction('consignments:count');
    return savePhysicalCountServer(agreementId, lines, userName);
}

export async function createClosureFromCount(agreementId: number, lines: { productId: string; quantity: number }[], userName: string): Promise<PeriodClosure> {
    await authorizeAction('consignments:count');
    const closure = await createClosureFromCountServer(agreementId, lines, userName);
    
    // --- Send Notification on new pending closure ---
    try {
        const [users, agreementDetails, settings] = await Promise.all([
            getAllUsers(),
            getAgreementDetailsServer(agreementId),
            getConsignmentSettingsServer(),
        ]);

        if (!agreementDetails) {
            throw new Error('Agreement details not found for notification.');
        }

        const allRecipients = new Set<string>();

        // 1. Get recipients from the specific agreement
        const agreementUserIds = agreementDetails.agreement.notification_user_ids || [];
        agreementUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
            if (user?.email) allRecipients.add(user.email);
        });

        // 2. Get global recipients from settings
        const globalUserIds = settings.notificationUserIds || [];
        globalUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
            if (user?.email) allRecipients.add(user.email);
        });

        const additionalEmails = settings.additionalNotificationEmails?.split(',').map(e => e.trim()).filter(Boolean) || [];
        additionalEmails.forEach(email => allRecipients.add(email));

        if (allRecipients.size > 0) {
            await sendClosurePendingEmail({
                closure,
                agreementDetails,
                physicalCount: lines,
                recipientEmails: Array.from(allRecipients),
            });
        }

        await createNotificationForPermission(
            'consignments:boleta:approve', // Reuse permission for approving closures
            `Nuevo cierre de periodo ${closure.consecutive} requiere aprobación.`,
            `/dashboard/consignments/cierres`,
            closure.id,
            'period_closure',
            'approve'
        );

    } catch(e: any) {
        logError('Failed to send closure creation notification', { error: e.message, closureId: closure.id });
    }
    
    return closure;
}


export async function getBoletas(filters: { status: string[], dateRange?: { from?: Date, to?: Date }, type?: BoletaType, agreementId?: number }) {
    return getBoletasServer(filters);
}

export async function updateBoletaStatus(payload: { boletaId: number, status: RestockBoletaStatus, notes: string, updatedBy: string, erpInvoiceNumber?: string, erpMovementId?: string }): Promise<RestockBoleta> {
    if (payload.status === 'pending' && !payload.erpMovementId?.trim()) {
        throw new Error("El número de movimiento de inventario del ERP es requerido para poder enviar a aprobación.");
    }

    try {
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
            const statusLabel = statusConfig[payload.status] || payload.status;
            const users: User[] = await getAllUsers();
            const creator = users.find((u: User) => u.name === (updatedBoleta.submitted_by || updatedBoleta.created_by));
            const settings = await getConsignmentSettingsServer();
            const agreementDetails = await getAgreementDetailsServer(updatedBoleta.agreement_id);
            
            const allRecipients = new Map<string, { includePrice: boolean }>();
            
            const milestoneStatuses: RestockBoletaStatus[] = ['approved', 'sent', 'invoiced', 'canceled', 'review'];
            const isImportantUpdate = milestoneStatuses.includes(payload.status);
            const isApprovalRequest = payload.status === 'pending';

            if (isImportantUpdate) {
                if (creator?.email) {
                    allRecipients.set(creator.email, { includePrice: false });
                }
                const agreementUserIds = agreementDetails?.agreement.notification_user_ids || [];
                agreementUserIds.forEach(userId => {
                    const user = users.find(u => u.id === userId);
                    if (user?.email) {
                        allRecipients.set(user.email, { includePrice: true });
                    }
                });
            }
            
            if (isApprovalRequest) {
                const globalUserIds = settings.notificationUserIds || [];
                users.forEach(user => {
                    if (globalUserIds.includes(user.id)) {
                        allRecipients.set(user.email, { includePrice: true });
                    }
                });
                const additionalEmails = settings.additionalNotificationEmails?.split(',').map(e => e.trim()).filter(Boolean) || [];
                additionalEmails.forEach(email => allRecipients.set(email, { includePrice: true }));
            }

            if (allRecipients.size > 0) {
                const introText = `La boleta <strong>${updatedBoleta.consecutive}</strong> para el cliente <strong>${agreementDetails?.agreement.client_name}</strong> ha sido actualizada al estado <strong>${statusLabel}</strong> por ${payload.updatedBy}.`;
                const subject = `Actualización de Boleta: ${updatedBoleta.consecutive} - ${statusLabel}`;
                
                for (const [email, config] of allRecipients.entries()) {
                    await sendBoletaEmail({
                        boletaId: updatedBoleta.id,
                        subject,
                        introText,
                        recipientEmails: [email],
                        includePrice: config.includePrice,
                    });
                }
            }
            
            if (creator && creator.name !== payload.updatedBy && isImportantUpdate) {
                 await createNotification({
                    userId: creator.id,
                    message: `La boleta ${updatedBoleta.consecutive} ha sido actualizada a: ${statusLabel}.`,
                    href: '/dashboard/consignments/boletas',
                    entityId: updatedBoleta.id,
                    entityType: 'consignment_boleta',
                    entityStatus: payload.status,
                });
            }
            
            if (isApprovalRequest) {
                await createNotificationForPermission(
                    'consignments:boleta:approve',
                    `Nueva boleta de consignación ${updatedBoleta.consecutive} requiere aprobación.`,
                    '/dashboard/consignments/boletas',
                    updatedBoleta.id,
                    'consignment_boleta',
                    'approve'
                );
            }

        } catch (e: any) {
            logError('Failed to send boleta status update notification (from actions)', { boletaId: payload.boletaId, error: e.message });
        }
        
        return updatedBoleta;
    } catch(error: any) {
        logError('Failed to update boleta status (from actions)', { error: error.message, payload });
        throw new Error(`${error.message}`);
    }
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

export async function getConsignmentSettings(): Promise<ConsignmentSettings> {
    return getConsignmentSettingsServer();
}

export async function saveConsignmentSettings(settings: ConsignmentSettings): Promise<void> {
    return saveConsignmentSettingsServer(settings);
}

export async function getLatestPhysicalCount(agreementId: number): Promise<PhysicalCount[] | null> {
    return getLatestPhysicalCountServer(agreementId);
}

export async function getPeriodClosures(filters: {} = {}): Promise<(PeriodClosure & { client_name: string; is_initial_inventory: boolean; })[]> {
    return getPeriodClosuresServer(filters);
}

export async function getPeriodClosureDetails(closureId: number): Promise<PeriodClosure | null> {
    return getPeriodClosureDetailsServer(closureId);
}

export async function approvePeriodClosure(closureId: number, previousClosureId: number | null, updatedBy: string): Promise<PeriodClosure> {
    return approvePeriodClosureServer(closureId, previousClosureId, updatedBy);
}

export async function rejectPeriodClosure(closureId: number, notes: string, updatedBy: string): Promise<PeriodClosure> {
    return rejectPeriodClosureServer(closureId, notes, updatedBy);
}

export async function getConsignmentsBillingReportData(closureId: number): Promise<any> {
    return getConsignmentsBillingReportDataFromDb(closureId);
}


export async function saveReplenishmentBoleta(agreementId: number, lines: { productId: string; quantity: number }[], userName: string): Promise<RestockBoleta> {
    return saveReplenishmentBoletaServer(agreementId, lines, userName);
}

export async function getPhysicalCountDetails(agreementId: number, countedAt: string): Promise<PhysicalCount[]> {
    return getPhysicalCountByRefServer(agreementId, countedAt);
}

export async function lockAgreement(agreementId: number, userId: number, userName: string): Promise<{ success: boolean, locked: boolean, message: string }> {
    return lockAgreementServer(agreementId, userId, userName);
}

export async function forceRelayLock(agreementId: number, userId: number, userName: string): Promise<void> {
    return forceRelayLockServer(agreementId, userId, userName);
}

export async function releaseAgreementLock(agreementId: number, userId: number): Promise<void> {
    return releaseAgreementLockServer(agreementId, userId);
}

export async function getRecentPhysicalCounts(agreementId: number): Promise<{ counted_at: string; counted_by: string }[]> {
    return getRecentPhysicalCountsServer(agreementId);
}

export async function saveAdjustment(payload: { agreementId: number; productId: string; quantity: number; reason: ConsignmentAdjustmentReason; notes?: string; userName: string; }): Promise<void> {
    await saveAdjustmentServer(payload);
}

export async function annulPeriodClosure(closureId: number, updatedBy: string): Promise<PeriodClosure> {
    return await annulPeriodClosureServer(closureId, updatedBy);
}
