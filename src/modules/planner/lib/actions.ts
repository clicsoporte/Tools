/**
 * @fileoverview Client-side functions for interacting with the planner's server-side DB functions.
 */
'use client';

import type { ProductionOrder, UpdateStatusPayload, UpdateOrderDetailsPayload, ProductionOrderHistoryEntry, PlannerSettings, RejectCancellationPayload, UpdateProductionOrderPayload, DateRange, NotePayload } from '../../core/types';
import { 
    getOrders, 
    addOrder, 
    updateOrder,
    updateStatus, 
    updateDetails,
    getOrderHistory as getOrderHistoryServer,
    getSettings,
    saveSettings,
    rejectCancellationRequest as rejectCancellationServer,
    addNote as addNoteServer,
} from './db';

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

export async function saveProductionOrder(order: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'machineId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate' | 'requestedBy'>, requestedBy: string): Promise<ProductionOrder> {
    return addOrder(order, requestedBy);
}

export async function updateProductionOrder(payload: UpdateProductionOrderPayload): Promise<ProductionOrder> {
    return updateOrder(payload);
}

export async function updateProductionOrderStatus(payload: UpdateStatusPayload): Promise<ProductionOrder> {
    return updateStatus(payload);
}

export async function updateProductionOrderDetails(payload: UpdateOrderDetailsPayload): Promise<ProductionOrder> {
    return updateDetails(payload);
}

export async function getPlannerSettings(): Promise<PlannerSettings> {
    return getSettings();
}

export async function savePlannerSettings(settings: PlannerSettings): Promise<void> {
    return saveSettings(settings);
}

export async function getOrderHistory(orderId: number): Promise<ProductionOrderHistoryEntry[]> {
    return getOrderHistoryServer(orderId);
}

export async function rejectCancellationRequest(payload: RejectCancellationPayload): Promise<void> {
    return rejectCancellationServer(payload);
}

export async function addNoteToOrder(payload: NotePayload): Promise<ProductionOrder> {
    return addNoteServer(payload);
}
