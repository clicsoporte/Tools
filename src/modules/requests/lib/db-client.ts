/**
 * @fileoverview Client-side functions for interacting with the request module's server-side DB functions.
 */
'use client';

import type { PurchaseRequest, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, RequestSettings, UpdatePurchaseRequestPayload } from '../../core/types';
import { 
    getRequests, 
    addRequest,
    updateRequest,
    updateStatus, 
    getRequestHistory as getRequestHistoryServer,
    getSettings,
    saveSettings,
} from './db';

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
    return getRequests();
}

export async function savePurchaseRequest(request: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate'>, requestedBy: string): Promise<PurchaseRequest> {
    return addRequest(request, requestedBy);
}

export async function updatePurchaseRequest(payload: UpdatePurchaseRequestPayload): Promise<PurchaseRequest> {
    return updateRequest(payload);
}

export async function updatePurchaseRequestStatus(payload: UpdateRequestStatusPayload): Promise<PurchaseRequest> {
    return updateStatus(payload);
}

export async function getRequestHistory(requestId: number): Promise<PurchaseRequestHistoryEntry[]> {
    return getRequestHistoryServer(requestId);
}

export async function getRequestSettings(): Promise<RequestSettings> {
    return getSettings();
}

export async function saveRequestSettings(settings: RequestSettings): Promise<void> {
    return saveSettings(settings);
}
