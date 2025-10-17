/**
 * @fileoverview Server Actions for the Analytics module.
 */
'use server';

import { getCompletedOrdersByDateRange } from '@/modules/planner/lib/db';
import type { DateRange } from '@/modules/core/types';
import type { ProductionReportData } from '@/modules/analytics/hooks/useProductionReport';

/**
 * Fetches and processes data for the production report.
 * @param dateRange - The date range to filter production orders.
 * @returns A promise that resolves to the structured production report data.
 */
export async function getProductionReportData(dateRange: DateRange): Promise<ProductionReportData> {
    if (!dateRange.from) {
        throw new Error("Date 'from' is required for the production report.");
    }

    const orders = await getCompletedOrdersByDateRange(dateRange);

    const totals = orders.reduce(
        (acc, order) => {
            acc.totalRequested += order.quantity;
            acc.totalDelivered += order.deliveredQuantity ?? 0;
            acc.totalDefective += order.defectiveQuantity ?? 0;
            return acc;
        },
        { totalRequested: 0, totalDelivered: 0, totalDefective: 0, totalNet: 0 }
    );

    totals.totalNet = totals.totalDelivered - totals.totalDefective;

    const details = orders.map(order => {
        const historyEntry = order.history?.find(h => h.status === 'completed' || h.status === 'received-in-warehouse');
        return {
            ...order,
            completionDate: historyEntry?.timestamp || null,
        };
    });

    return {
        totals,
        details: JSON.parse(JSON.stringify(details)), // Ensure plain objects for serialization
    };
}
