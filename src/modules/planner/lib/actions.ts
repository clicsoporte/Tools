/**
 * @fileoverview Client-side functions for interacting with the planner's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import type { ProductionOrder, UpdateStatusPayload, UpdateOrderDetailsPayload, ProductionOrderHistoryEntry, PlannerSettings, RejectCancellationPayload, UpdateProductionOrderPayload, DateRange, NotePayload, AdministrativeActionPayload } from '../../core/types';
import { 
    getOrders, 
    addOrder, 
    updateOrder,
    updateStatus, 
    updateDetails,
    getOrderHistory as getOrderHistoryServer,
    getSettings,
    saveSettings,
    addNote as addNoteServer,
    updatePendingAction as updatePendingActionServer,
} from './db';

/**
 * Fetches production orders from the server.
 * @param options - Pagination and filtering options.
 * @returns A promise that resolves to the orders and total archived count.
 */
export async function getProductionOrders(options: { 
    page?: number; 
    pageSize?: number;
    filters?: {
        searchTerm?: string;
        status?: string;
        classification?: string;
        dateRange?: DateRange;
    };
}): Promise<{ activeOrders: ProductionOrder[], archivedOrders: ProductionOrder[], totalArchivedCount: number }> {
    return getOrders(options);
}

/**
 * Saves a new production order.
 * @param order - The order data to save.
 * @param requestedBy - The name of the user creating the order.
 * @returns The newly created production order.
 */
export async function saveProductionOrder(order: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'machineId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate' | 'requestedBy' | 'hasBeenModified' | 'lastModifiedBy' | 'lastModifiedAt' | 'pendingAction'>, requestedBy: string): Promise<ProductionOrder> {
    return addOrder(order, requestedBy);
}

/**
 * Updates the main details of an existing production order.
 * @param payload - The data to update.
 * @returns The updated production order.
 */
export async function updateProductionOrder(payload: UpdateProductionOrderPayload): Promise<ProductionOrder> {
    return updateOrder(payload);
}

/**
 * Updates the status of a production order.
 * @param payload - The status update information.
 * @returns The updated production order.
 */
export async function updateProductionOrderStatus(payload: UpdateStatusPayload): Promise<ProductionOrder> {
    return updateStatus(payload);
}

/**
 * Updates specific details of a production order like priority or machine assignment.
 * @param payload - The details to update.
 * @returns The updated production order.
 */
export async function updateProductionOrderDetails(payload: UpdateOrderDetailsPayload): Promise<ProductionOrder> {
    return updateDetails(payload);
}

/**
 * Fetches planner settings from the server.
 * @returns The current planner settings.
 */
export async function getPlannerSettings(): Promise<PlannerSettings> {
    return getSettings();
}

/**
 * Saves planner settings.
 * @param settings - The settings object to save.
 */
export async function savePlannerSettings(settings: PlannerSettings): Promise<void> {
    return saveSettings(settings);
}

/**
 * Fetches the history for a specific order.
 * @param orderId - The ID of the order.
 * @returns A promise that resolves to an array of history entries.
 */
export async function getOrderHistory(orderId: number): Promise<ProductionOrderHistoryEntry[]> {
    return getOrderHistoryServer(orderId);
}

/**
 * Rejects a cancellation request for an order.
 * @param payload - The rejection details.
 */
export async function rejectCancellationRequest(payload: RejectCancellationPayload): Promise<ProductionOrder> {
    // Re-using updatePendingAction with 'none' is the correct way to reject a request
    return updatePendingActionServer({
        entityId: payload.entityId,
        action: 'none',
        notes: payload.notes,
        updatedBy: payload.updatedBy
    });
}

/**
 * Adds a note to a production order without changing its status.
 * @param payload - The note details.
 * @returns The updated production order.
 */
export async function addNoteToOrder(payload: NotePayload): Promise<ProductionOrder> {
    return addNoteServer(payload);
}

/**
 * Updates the pending administrative action for an order.
 * @param payload - The action details.
 * @returns The updated production order.
 */
export async function updatePendingAction(payload: AdministrativeActionPayload): Promise<ProductionOrder> {
    return updatePendingActionServer(payload);
}
