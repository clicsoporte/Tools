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
} from './db';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory } from '@/modules/core/types';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

export async function getConsignmentAgreements(): Promise<(ConsignmentAgreement & { product_count?: number })[]> {
    return getAgreementsServer();
}

export async function saveConsignmentAgreement(agreement: Omit<ConsignmentAgreement, 'id' | 'next_boleta_number'> & { id?: number }, products: Omit<ConsignmentProduct, 'id' | 'agreement_id'>[]) {
    return saveAgreementServer(agreement, products);
}

export async function getAgreementDetails(agreementId: number): Promise<{ agreement: ConsignmentAgreement, products: ConsignmentProduct[] } | null> {
    return getAgreementDetailsServer(agreementId);
}

export async function deleteConsignmentAgreement(agreementId: number): Promise<void> {
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
    return generateBoletaFromSessionServer(sessionId, userId, userName);
}

export async function getBoletas(filters: { status: string[], dateRange?: { from?: Date, to?: Date }}) {
    return getBoletasServer(filters);
}

export async function updateBoletaStatus(payload: { boletaId: number, status: string, notes: string, updatedBy: string, erpInvoiceNumber?: string }): Promise<RestockBoleta> {
    return updateBoletaStatusServer(payload);
}

export async function getBoletaDetails(boletaId: number): Promise<{ boleta: RestockBoleta, lines: BoletaLine[], history: BoletaHistory[] } | null> {
    return getBoletaDetailsServer(boletaId);
}

export async function updateBoleta(boleta: RestockBoleta, lines: BoletaLine[], updatedBy: string): Promise<RestockBoleta> {
    return updateBoletaServer(boleta, lines, updatedBy);
}
