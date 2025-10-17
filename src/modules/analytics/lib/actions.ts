/**
 * @fileoverview Server Actions for the Analytics module.
 */
'use server';

import { getCompletedOrdersByDateRange } from '@/modules/planner/lib/db';
import { getSettings as getPlannerSettingsDb } from '@/modules/planner/lib/db';
import type { DateRange, ProductionOrder, PlannerSettings, ProductionOrderHistoryEntry } from '@/modules/core/types';
import { differenceInDays, parseISO } from 'date-fns';
import type { ProductionReportDetail, ProductionReportData } from '../hooks/useProductionReport';

interface FullProductionReportData {
    reportData: ProductionReportData;
    plannerSettings: PlannerSettings;
}

/**
 * Fetches and processes data for the production report.
 * @param dateRange - The date range to filter production orders.
 * @returns A promise that resolves to the structured production report data, including planner settings.
 */
export async function getProductionReportData(dateRange: DateRange): Promise<FullProductionReportData> {
    if (!dateRange.from) {
        throw new Error("Date 'from' is required for the production report.");
    }

    const [orders, plannerSettings] = await Promise.all([
        getCompletedOrdersByDateRange(dateRange),
        getPlannerSettingsDb(),
    ]);

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

    const details: ProductionReportDetail[] = orders.map(order => {
        const history = order.history || [];
        
        const completionEntry = history.find(h => h.status === 'completed' || h.status === 'received-in-warehouse');
        const startEntry = history.find(h => h.status === 'in-progress');
        
        const completionDate = completionEntry?.timestamp || null;
        
        let productionDurationDays: number | null = null;
        if (startEntry?.timestamp && completionDate) {
            productionDurationDays = differenceInDays(parseISO(completionDate), parseISO(startEntry.timestamp));
        }

        let totalCycleDays: number | null = null;
        if (order.requestDate && completionDate) {
            totalCycleDays = differenceInDays(parseISO(completionDate), parseISO(order.requestDate));
        }
        
        return {
            ...order,
            completionDate,
            productionDurationDays,
            totalCycleDays,
        };
    });

    return {
        reportData: {
            totals,
            details: JSON.parse(JSON.stringify(details)), // Ensure plain objects for serialization
        },
        plannerSettings: JSON.parse(JSON.stringify(plannerSettings)),
    };
}
