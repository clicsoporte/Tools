/**
 * @fileoverview Client-side functions for interacting with the request module's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import type { PurchaseRequest, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, RequestSettings, UpdatePurchaseRequestPayload, RejectCancellationPayload, DateRange, AdministrativeActionPayload, StockInfo } from '../../core/types';
import { logInfo } from '@/modules/core/lib/logger';
import { 
    getRequests, 
    addRequest,
    updateRequest,
    updateStatus, 
    getRequestHistory as getRequestHistoryServer,
    getSettings,
    saveSettings,
    updatePendingAction as updatePendingActionServer,
    getErpOrderData as getErpOrderDataServer,
} from './db';

/**
 * Fetches purchase requests from the server.
 * @param options - Pagination and filtering options.
 * @returns A promise that resolves to the requests and total archived count.
 */
export async function getPurchaseRequests(options: { 
    page?: number; 
    pageSize?: number;
    filters?: {
        searchTerm?: string;
        status?: string;
        classification?: string;
        dateRange?: DateRange;
    };
}): Promise<{ requests: PurchaseRequest[], totalArchivedCount: number }> {
    return getRequests(options);
}

/**
 * Saves a new purchase request.
 * @param request - The request data to save.
 * @param requestedBy - The name of the user creating the request.
 * @returns The newly created purchase request.
 */
export async function savePurchaseRequest(request: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus'>, requestedBy: string): Promise<PurchaseRequest> {
    const createdRequest = await addRequest(request, requestedBy);
    await logInfo(`Purchase request ${createdRequest.consecutive} created by ${requestedBy}`, { item: createdRequest.itemDescription, quantity: createdRequest.quantity });
    return createdRequest;
}

/**
 * Updates the main details of an existing purchase request.
 * @param payload - The data to update.
 * @returns The updated purchase request.
 */
export async function updatePurchaseRequest(payload: UpdatePurchaseRequestPayload): Promise<PurchaseRequest> {
    const updatedRequest = await updateRequest(payload);
    await logInfo(`Purchase request ${updatedRequest.consecutive} edited by ${payload.updatedBy}`, { requestId: payload.requestId });
    return updatedRequest;
}

/**
 * Updates the status of a purchase request.
 * @param payload - The status update information.
 * @returns The updated purchase request.
 */
export async function updatePurchaseRequestStatus(payload: UpdateRequestStatusPayload): Promise<PurchaseRequest> {
    const updatedRequest = await updateStatus(payload);
    await logInfo(`Status of request ${updatedRequest.consecutive} updated to '${payload.status}' by ${payload.updatedBy}`, { notes: payload.notes, requestId: payload.requestId });
    return updatedRequest;
}

/**
 * Fetches the history for a specific request.
 * @param requestId - The ID of the request.
 * @returns A promise that resolves to an array of history entries.
 */
export async function getRequestHistory(requestId: number): Promise<PurchaseRequestHistoryEntry[]> {
    return getRequestHistoryServer(requestId);
}

/**
 * Fetches request settings from the server.
 * @returns The current request settings.
 */
export async function getRequestSettings(): Promise<RequestSettings> {
    return getSettings();
}

/**
 * Saves request settings.
 * @param settings - The settings object to save.
 */
export async function saveRequestSettings(settings: RequestSettings): Promise<void> {
    await logInfo('Purchase requests settings updated.');
    return saveSettings(settings);
}

/**
 * Rejects a cancellation request for a purchase request.
 * @param payload - The rejection details.
 */
export async function rejectCancellationRequest(payload: RejectCancellationPayload): Promise<PurchaseRequest> {
    const updatedRequest = await updatePendingActionServer({
        entityId: payload.entityId,
        action: 'none',
        notes: payload.notes,
        updatedBy: payload.updatedBy
    });
    await logInfo(`Admin action request for request ${updatedRequest.consecutive} was rejected by ${payload.updatedBy}`, { notes: payload.notes });
    return updatedRequest;
}

/**
 * Updates the pending administrative action for a request.
 * @param payload - The action details.
 * @returns The updated purchase request.
 */
export async function updatePendingAction(payload: AdministrativeActionPayload): Promise<PurchaseRequest> {
    const updatedRequest = await updatePendingActionServer(payload);
    await logInfo(`Administrative action '${payload.action}' initiated for request ${updatedRequest.consecutive} by ${payload.updatedBy}.`);
    return updatedRequest;
}

/**
 * Fetches the header and line items for a given ERP order number.
 * @param orderNumber The ERP order number to fetch.
 * @param signal The AbortSignal to cancel the request.
 * @returns An object containing the order headers, an array of lines, and the real-time inventory for those lines.
 */
export async function getErpOrderData(orderNumber: string, signal?: AbortSignal): Promise<{headers: any[], lines: any[], inventory: StockInfo[]}> {
    return getErpOrderDataServer(orderNumber, signal);
}
