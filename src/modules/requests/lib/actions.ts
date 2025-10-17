/**
 * @fileoverview Client-side functions for interacting with the request module's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import type { PurchaseRequest, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, RequestSettings, UpdatePurchaseRequestPayload, RejectCancellationPayload, DateRange, AdministrativeActionPayload, StockInfo, ErpOrderHeader, ErpOrderLine } from '../../core/types';
import { logInfo } from '@/modules/core/lib/logger';
import { createNotification } from '@/modules/core/lib/notifications-actions';
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
    getUserByName,
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
export async function savePurchaseRequest(request: Omit<PurchaseRequest, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'requestedBy' | 'deliveredQuantity' | 'receivedInWarehouseBy' | 'receivedDate' | 'previousStatus' | 'lastModifiedAt' | 'lastModifiedBy' | 'hasBeenModified' | 'approvedBy' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes'>, requestedBy: string): Promise<PurchaseRequest> {
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
    
    // --- Create Notification ---
    if (updatedRequest.requestedBy !== payload.updatedBy) {
        const targetUser = await getUserByName(updatedRequest.requestedBy);
        if (targetUser) {
            await createNotification(
                targetUser.id,
                `La solicitud ${updatedRequest.consecutive} ha sido actualizada a: ${updatedRequest.status}.`,
                `/dashboard/requests?search=${updatedRequest.consecutive}`
            );
        }
    }
    
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
 * @returns An object containing the order headers, an array of lines, and the real-time inventory for those lines.
 */
export async function getErpOrderData(orderNumber: string): Promise<{headers: ErpOrderHeader[], lines: ErpOrderLine[], inventory: StockInfo[]}> {
    return getErpOrderDataServer(orderNumber);
}
