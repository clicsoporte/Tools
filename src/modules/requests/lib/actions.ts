/**
 * @fileoverview Client-side functions for interacting with the request module's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import type { PurchaseRequest, UpdateRequestStatusPayload, PurchaseRequestHistoryEntry, RequestSettings, UpdatePurchaseRequestPayload, RejectCancellationPayload, DateRange, AdministrativeAction, AdministrativeActionPayload, StockInfo, ErpOrderHeader, ErpOrderLine, User } from '../../core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
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
import type { PurchaseSuggestion } from '../hooks/useRequestSuggestions.tsx';
import { getAllProducts, getAllStock, getAllCustomers } from '@/modules/core/lib/db';

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
export async function getErpOrderData(orderNumber: string | DateRange): Promise<{headers: ErpOrderHeader[], lines: ErpOrderLine[], inventory: StockInfo[]}> {
    return getErpOrderDataServer(orderNumber);
}

/**
 * Analyzes ERP orders within a date range and suggests purchases for items with stock shortages.
 * @param dateRange - The date range for ERP orders to analyze.
 * @returns A promise that resolves to an array of purchase suggestions.
 */
export async function getRequestSuggestions(dateRange: DateRange): Promise<PurchaseSuggestion[]> {
    const { headers, lines } = await getErpOrderDataServer(dateRange);
    const allStock = await getAllStock();
    const allProducts = await getAllProducts();
    const allCustomers = await getAllCustomers();

    const requiredItems = new Map<string, { totalRequired: number; sourceOrders: Set<string>; clientIds: Set<string>; erpUsers: Set<string>; earliestDueDate: Date | null; }>();

    for (const line of lines) {
        const header = headers.find(h => h.PEDIDO === line.PEDIDO);
        if (!header) continue;

        if (!requiredItems.has(line.ARTICULO)) {
            requiredItems.set(line.ARTICULO, { totalRequired: 0, sourceOrders: new Set(), clientIds: new Set(), erpUsers: new Set(), earliestDueDate: null });
        }
        
        const item = requiredItems.get(line.ARTICULO)!;
        item.totalRequired += line.CANTIDAD_PEDIDA;
        item.sourceOrders.add(header.PEDIDO);
        item.clientIds.add(header.CLIENTE);
        if (header.USUARIO) {
            item.erpUsers.add(header.USUARIO);
        }
        
        const dueDate = new Date(header.FECHA_PROMETIDA);
        if (!item.earliestDueDate || dueDate < item.earliestDueDate) {
            item.earliestDueDate = dueDate;
        }
    }

    const suggestions: PurchaseSuggestion[] = [];

    for (const [itemId, data] of requiredItems.entries()) {
        const stockInfo = allStock.find(s => s.itemId === itemId);
        const currentStock = stockInfo?.totalStock ?? 0;
        const shortage = data.totalRequired - currentStock;

        if (shortage > 0) {
            const productInfo = allProducts.find(p => p.id === itemId);
            const involvedClients = Array.from(data.clientIds).map(id => {
                const customer = allCustomers.find(c => c.id === id);
                return { id, name: customer?.name || 'Desconocido' };
            });
            
            suggestions.push({
                itemId,
                itemDescription: productInfo?.description || 'Artículo no encontrado',
                itemClassification: productInfo?.classification || 'N/A',
                totalRequired: data.totalRequired,
                currentStock,
                shortage,
                sourceOrders: Array.from(data.sourceOrders),
                involvedClients,
                erpUsers: Array.from(data.erpUsers),
                earliestDueDate: data.earliestDueDate ? data.earliestDueDate.toISOString() : null,
            });
        }
    }

    return suggestions.sort((a, b) => b.shortage - a.shortage);
}
