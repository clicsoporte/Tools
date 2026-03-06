/**
 * @fileoverview Server Actions for the Analytics module.
 */
'use server';

import { getCompletedOrdersByDateRange, getPlannerSettings } from '@/modules/planner/lib/db';
import { getAllRoles, getAllSuppliers, getAllStock, getAllCustomers, getAllProducts, connectDb, getAnalyticsSettings } from '@/modules/core/lib/db';
import { getAllUsersForReport } from '@/modules/core/lib/auth';
import type { DateRange, ProductionOrder, PlannerSettings, ProductionOrderHistoryEntry, Product, User, Role, ErpPurchaseOrderLine, ErpPurchaseOrderHeader, Supplier, StockInfo, PhysicalInventoryComparisonItem, ItemLocation, WarehouseLocation, InventoryUnit, WarehouseSettings, AnalyticsSettings, RestockBoleta, BoletaLine, BoletaHistory, ConsignmentProduct, ConsignmentReportRow, PeriodClosure, ConsignmentAdjustment, PhysicalCount, TransitStatusAlias } from '@/modules/core/types';
import { differenceInDays, parseISO, format } from 'date-fns';
import type { ProductionReportDetail, ProductionReportData } from '../hooks/useProductionReport';
import { logError } from '@/modules/core/lib/logger';
import { getAllErpPurchaseOrderHeaders, getAllErpPurchaseOrderLines } from '@/modules/core/lib/db';
import { getLocations as getWarehouseLocations, getInventory as getPhysicalInventory, getAllItemLocations, getSelectableLocations, getInventoryUnits, getWarehouseSettings as getWHSettings } from '@/modules/warehouse/lib/db';
import { getBoletasByDateRange, getLatestBoletaBeforeDate, getAgreementDetails, getLatestApprovedClosure, getPhysicalCountHistory, getLatestPhysicalCount, getBoletaDetails, getAdjustmentsInPeriod, getBoletas, getPeriodClosures, getPeriodClosureDetails, getConsignmentsBillingReportData as getConsignmentsBillingReportDataFromDb } from '@/modules/consignments/lib/db';
import type { TransitReportItem } from '../hooks/useTransitsReport';
import type { OccupancyReportRow } from '../hooks/useOccupancyReport';


interface ReportFilters {
    productId?: string | null;
    classifications?: string[];
    machineIds?: string[];
}

interface FullProductionReportData {
    reportData: ProductionReportData;
    plannerSettings: PlannerSettings;
}

/**
 * Fetches and processes data for the production report.
 * @param dateRange - The date range to filter production orders.
 * @param filters - Additional filters for product, classification, or machine.
 * @returns A promise that resolves to the structured production report data, including planner settings.
 */
export async function getProductionReportData({ dateRange, filters = {} }: { dateRange: DateRange, filters?: ReportFilters }): Promise<FullProductionReportData> {
    if (!dateRange.from) {
        throw new Error("Date 'from' is required for the production report.");
    }
    
    const [allOrders, plannerSettings, allProducts] = await Promise.all([
        getCompletedOrdersByDateRange(dateRange),
        getPlannerSettings(),
        getAllProducts(),
    ]);

    const filteredOrders = allOrders.filter((order: ProductionOrder) => {
        if (filters.productId && order.productId !== filters.productId) {
            return false;
        }
        if (filters.machineIds && filters.machineIds.length > 0 && (!order.machineId || !filters.machineIds.includes(order.machineId))) {
            return false;
        }
        if (filters.classifications && filters.classifications.length > 0) {
            const product = allProducts.find((p: Product) => p.id === order.productId);
            if (!product || !product.classification || !filters.classifications.includes(product.classification)) {
                return false;
            }
        }
        return true;
    });

    const details: ProductionReportDetail[] = filteredOrders.map((order: (ProductionOrder & { history: ProductionOrderHistoryEntry[] })) => {
        const history = order.history || [];
        
        const completionEntry = history.find((h: ProductionOrderHistoryEntry) => h.status === 'completed' || h.status === 'received-in-warehouse');
        const startEntry = history.find((h: ProductionOrderHistoryEntry) => h.status === 'in-progress');
        
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
            details: JSON.parse(JSON.stringify(details)), // Ensure plain objects for serialization
        },
        plannerSettings: JSON.parse(JSON.stringify(plannerSettings)),
    };
}

export async function getUserPermissionsReportData(): Promise<{ users: User[], roles: Role[] }> {
    try {
        const [users, roles] = await Promise.all([
            getAllUsersForReport(),
            getAllRoles()
        ]);
        return { users, roles };
    } catch (error: any) {
        logError("Failed to fetch user permissions report data", { error: error.message });
        throw new Error("No se pudieron obtener los datos para el reporte de permisos.");
    }
}


export async function getActiveTransitsReportData(filters: { dateRange: DateRange, statusFilter?: string[] }): Promise<TransitReportItem[]> {
    const { dateRange, statusFilter } = filters;
    if (!dateRange.from) {
        throw new Error("Date 'from' is required for the transits report.");
    }
    const toDate = dateRange.to || new Date();
    toDate.setHours(23, 59, 59, 999);

    const [allHeaders, allLines, allSuppliers, allProducts, allStock, analyticsSettings] = await Promise.all([
        getAllErpPurchaseOrderHeaders(),
        getAllErpPurchaseOrderLines(),
        getAllSuppliers(),
        getAllProducts(),
        getAllStock(),
        getAnalyticsSettings()
    ]);

    const supplierMap = new Map<string, string>(allSuppliers.map((s: Supplier) => [s.id, s.name]));
    const productMap = new Map<string, string>(allProducts.map((p: Product) => [p.id, p.description]));
    const stockMap = new Map<string, number>(allStock.map((s: StockInfo) => [s.itemId, s.totalStock]));

    // Use the status filter if provided, otherwise default to all non-final states
    const relevantStates = (statusFilter && statusFilter.length > 0) ? statusFilter : analyticsSettings.transitStatusAliases.filter((s: TransitStatusAlias) => s.id !== 'N' && s.id !== 'R').map((s: TransitStatusAlias) => s.id);
    
    const filteredHeaders = allHeaders.filter((h: ErpPurchaseOrderHeader) => {
        const orderDate = new Date(h.FECHA_HORA);
        return relevantStates.includes(h.ESTADO) && orderDate >= dateRange.from! && orderDate <= toDate;
    });

    const headerIds = new Set(filteredHeaders.map((h: ErpPurchaseOrderHeader) => h.ORDEN_COMPRA));

    const reportData: TransitReportItem[] = allLines
        .filter((line: ErpPurchaseOrderLine) => headerIds.has(line.ORDEN_COMPRA))
        .map((line: ErpPurchaseOrderLine) => {
            const header = filteredHeaders.find((h: ErpPurchaseOrderHeader) => h.ORDEN_COMPRA === line.ORDEN_COMPRA)!;
            const fechaHora = header.FECHA_HORA;
            const fechaHoraString = typeof fechaHora === 'object' && fechaHora !== null && 'toISOString' in fechaHora ? (fechaHora as Date).toISOString() : String(fechaHora);

            return {
                ...line,
                FECHA_HORA: fechaHoraString,
                ESTADO: header.ESTADO,
                PROVEEDOR: header.PROVEEDOR,
                CreatedBy: header.CreatedBy,
                proveedorName: supplierMap.get(header.PROVEEDOR) || header.PROVEEDOR,
                productDescription: productMap.get(line.ARTICULO) || 'Artículo no encontrado',
                currentStock: stockMap.get(line.ARTICULO) || 0,
            };
        });

    return JSON.parse(JSON.stringify(reportData));
}

const renderLocationPathAsString = (locationId: number, locations: any[]): string => {
    if (!locationId) return "N/A";
    const path: any[] = [];
    let current = locations.find(l => l.id === locationId);
    while (current) {
        path.unshift(current);
        current = current.parentId ? locations.find(l => l.id === current.parentId) : undefined;
    }
    return path.map(l => l.name).join(' > ');
};


export async function getPhysicalInventoryReportData({ dateRange }: { dateRange?: DateRange }): Promise<{ comparisonData: PhysicalInventoryComparisonItem[], allLocations: WarehouseLocation[] }> {
    try {
        const [physicalInventory, erpStock, allProducts, allLocations, allItemLocations, selectableLocations] = await Promise.all([
            getInventoryUnits({ dateRange, includeVoided: false, statuses: ['applied'] }),
            getAllStock(),
            getAllProducts(),
            getWarehouseLocations(),
            getAllItemLocations(),
            getSelectableLocations(),
        ]);
        
        const erpStockMap = new Map(erpStock.map(item => [item.itemId, item.totalStock]));
        const productMap = new Map(allProducts.map(item => [item.id, item.description]));
        const locationMap = new Map(allLocations.map(item => [item.id, item]));
        const itemLocationMap = new Map<string, string>();
        allItemLocations.forEach(itemLoc => {
            itemLocationMap.set(itemLoc.itemId, renderLocationPathAsString(itemLoc.locationId, allLocations));
        });

        const comparisonData: PhysicalInventoryComparisonItem[] = physicalInventory.map(item => {
            const erpQuantity = erpStockMap.get(item.productId) ?? 0;
            const location = item.locationId ? locationMap.get(item.locationId) : undefined;
            return {
                productId: item.productId,
                productDescription: productMap.get(item.productId) || 'Producto Desconocido',
                locationId: item.locationId!,
                locationName: location?.name || 'Ubicación Desconocida',
                locationCode: location?.code || 'N/A',
                physicalCount: item.quantity,
                erpStock: erpQuantity,
                difference: item.quantity - erpQuantity,
                lastCountDate: item.appliedAt || item.createdAt,
                updatedBy: item.appliedBy || item.createdBy,
                assignedLocationPath: itemLocationMap.get(item.productId) || 'Sin Asignar',
            };
        });

        return JSON.parse(JSON.stringify({ comparisonData, allLocations: selectableLocations }));
    } catch (error) {
        logError('Failed to generate physical inventory comparison report', { error });
        throw new Error('No se pudo generar el reporte de inventario físico.');
    }
}


export async function getReceivingReportData({ dateRange }: { dateRange?: DateRange }): Promise<{ units: InventoryUnit[], locations: WarehouseLocation[] }> {
    try {
        const [units, locations] = await Promise.all([
            getInventoryUnits({ dateRange, includeVoided: true }),
            getWarehouseLocations(),
        ]);
        return JSON.parse(JSON.stringify({ units, locations }));
    } catch (error) {
        logError('Failed to generate receiving report data', { error });
        throw new Error('No se pudo generar el reporte de recepciones.');
    }
}

export async function getOccupancyReportData(): Promise<{ reportRows: OccupancyReportRow[], allLocations: WarehouseLocation[], warehouseSettings: WarehouseSettings }> {
    try {
        const [allLocations, allUnits, allAssignments, allProducts, allCustomers, warehouseSettings] = await Promise.all([
            getWarehouseLocations(),
            getInventoryUnits({ includeVoided: false }),
            getAllItemLocations(),
            getAllProducts(),
            getAllCustomers(),
            getWHSettings()
        ]);
        
        const productMap = new Map(allProducts.map(p => [p.id, p]));
        const customerMap = new Map(allCustomers.map(c => [c.id, c]));
        const parentIds = new Set(allLocations.map(l => l.parentId).filter(Boolean));
        const finalLocations = allLocations.filter(l => !parentIds.has(l.id));

        const reportRows: OccupancyReportRow[] = finalLocations.map(location => {
            const unitsInLocation = allUnits.filter(u => u.locationId === location.id);
            const assignmentsInLocation = allAssignments.filter(a => a.locationId === location.id);
            
            const itemIdsInLocation = new Set([
                ...unitsInLocation.map(u => u.productId),
                ...assignmentsInLocation.map(a => a.itemId)
            ]);

            let status: OccupancyReportRow['status'] = 'Libre';
            if (itemIdsInLocation.size > 1) {
                status = 'Mixto';
            } else if (itemIdsInLocation.size === 1) {
                status = 'Ocupado';
            }

            const items = Array.from(itemIdsInLocation).map(itemId => {
                const product = productMap.get(itemId);
                const unit = unitsInLocation.find(u => u.productId === itemId);
                return {
                    productId: itemId,
                    productDescription: product?.description || 'Desconocido',
                    classification: product?.classification || 'N/A',
                    quantity: unit?.quantity,
                };
            });

            const clientIds = new Set(assignmentsInLocation.map(a => a.clientId).filter(Boolean) as string[]);
            const clients = Array.from(clientIds).map(clientId => ({
                clientId,
                clientName: customerMap.get(clientId)?.name || 'Desconocido'
            }));

            return {
                locationId: location.id,
                locationPath: renderLocationPathAsString(location.id, allLocations),
                status,
                items,
                clients,
            };
        });

        return { reportRows, allLocations, warehouseSettings };
    } catch (error) {
        logError('Failed to generate occupancy report data', { error });
        throw new Error('No se pudo generar el reporte de ocupación.');
    }
}

export async function getConsignmentsReportData(
    agreementId: string, 
    dateRange: { from: Date; to: Date },
    filters: { boletaIds?: string[], closureId?: string } = {}
): Promise<{ 
    reportRows: ConsignmentReportRow[], 
    boletas: (RestockBoleta & { lines: BoletaLine[]; history: BoletaHistory[]; })[],
    allBoletasForClient: RestockBoleta[],
    allClosuresForClient: (PeriodClosure & { client_name: string; is_initial_inventory: boolean; previous_closure_consecutive?: string; })[]
}> {
    try {
        const agreementIdNum = parseInt(agreementId, 10);
        const agreementDetails = await getAgreementDetails(agreementIdNum);
        if (!agreementDetails) {
            throw new Error("Acuerdo de consignación no encontrado.");
        }
        
        const [allBoletasForClient, allClosuresForClient] = await Promise.all([
            getBoletas({ agreementId: agreementIdNum, status: [], type: 'REPOSITION' }),
            getPeriodClosures({ agreementId: agreementIdNum })
        ]);

        let reportDateRange = dateRange;
        if (filters.closureId) {
            const closureDetails = allClosuresForClient.find(c => c.id === Number(filters.closureId));
            if (closureDetails) {
                const previousClosure = closureDetails.previous_closure_id 
                    ? await getPeriodClosureDetails(closureDetails.previous_closure_id) 
                    : null;
                
                reportDateRange = {
                    from: previousClosure ? parseISO(previousClosure.created_at) : new Date(0), // From beginning of time if no previous
                    to: parseISO(closureDetails.created_at)
                };
            }
        }

        const { products: agreementProducts } = agreementDetails;

        const initialBoleta = await getLatestBoletaBeforeDate(agreementIdNum, reportDateRange.from);
        const initialStockMap = new Map<string, number>();
        if (initialBoleta) {
            for (const line of initialBoleta.lines) {
                initialStockMap.set(line.product_id, line.counted_quantity);
            }
        }

        let boletasInPeriod = await getBoletasByDateRange(agreementId, reportDateRange, ['approved', 'sent', 'invoiced']);
        
        if (filters.boletaIds && filters.boletaIds.length > 0) {
            const boletaIdSet = new Set(filters.boletaIds.map(Number));
            boletasInPeriod = boletasInPeriod.filter(b => boletaIdSet.has(b.id));
        }
        
        const adjustmentsInPeriod = await getAdjustmentsInPeriod(agreementIdNum, reportDateRange);
        
        const replenishedMap = new Map<string, number>();
        for (const boleta of boletasInPeriod) {
            for (const line of boleta.lines) {
                const current = replenishedMap.get(line.product_id) || 0;
                replenishedMap.set(line.product_id, current + line.replenish_quantity);
            }
        }
        
        const adjustmentsMap = new Map<string, number>();
        adjustmentsInPeriod.forEach((adj: ConsignmentAdjustment) => {
            const current = adjustmentsMap.get(adj.product_id) || 0;
            adjustmentsMap.set(adj.product_id, current + adj.quantity);
        });
        
        const finalStockMap = new Map<string, number>();
        if (boletasInPeriod.length > 0) {
            const latestBoletaInPeriod = boletasInPeriod[boletasInPeriod.length - 1];
            for (const line of latestBoletaInPeriod.lines) {
                finalStockMap.set(line.product_id, line.counted_quantity);
            }
        }

        const allProducts = await getAllProducts();
        const productMap = new Map(allProducts.map((p: Product) => [p.id, p.description]));

        const reportRows: ConsignmentReportRow[] = agreementProducts.map(product => {
            const initialStock = initialStockMap.get(product.product_id) || 0;
            const totalReplenished = replenishedMap.get(product.product_id) || 0;
            const totalAdjustments = adjustmentsMap.get(product.product_id) || 0;
            
            const hasFinalCount = finalStockMap.has(product.product_id);
            const finalStock = hasFinalCount 
                ? finalStockMap.get(product.product_id)!
                : (initialStock + totalReplenished + totalAdjustments);
            
            const consumption = (initialStock + totalReplenished + totalAdjustments) - finalStock;
            const totalValue = consumption * product.price;

            const relevantBoletas = boletasInPeriod.filter((b: any) =>
                b.lines.some((l: any) => l.product_id === product.product_id && l.replenish_quantity > 0)
            );

            const boletaConsecutives = [...new Set(relevantBoletas.map((b: any) => b.consecutive))].join(', ');
            const creationDates = [...new Set(relevantBoletas.map((b: any) => format(parseISO(b.created_at), 'dd/MM/yy')))].join(', ');
            const erpInvoices = [...new Set(relevantBoletas.map((b: any) => b.erp_invoice_number).filter(Boolean))].join(', ');
            const erpMovementIds = [...new Set(relevantBoletas.map((b: any) => b.erp_movement_id).filter(Boolean))].join(', ');
            const deliveryDates = [...new Set(relevantBoletas.map((b: any) => b.delivery_date ? format(parseISO(b.delivery_date), 'dd/MM/yy') : null).filter(Boolean))].join(', ');
            const approvers = [...new Set(relevantBoletas.map((b: any) => b.approved_by).filter(Boolean))].join(', ');
            
            // Collect detailed transactions
            const transactions: ConsignmentReportRow['transactions'] = [];
            
            boletasInPeriod.forEach(boleta => {
                boleta.lines.forEach(line => {
                    if (line.product_id === product.product_id && line.replenish_quantity > 0) {
                        transactions.push({
                            date: boleta.created_at,
                            type: 'Entrega',
                            document: boleta.consecutive,
                            quantity: line.replenish_quantity,
                            user: boleta.approved_by || boleta.created_by,
                            notes: boleta.notes
                        });
                    }
                });
            });

            adjustmentsInPeriod.forEach(adj => {
                if (adj.product_id === product.product_id) {
                    transactions.push({
                        date: adj.created_at,
                        type: `Ajuste: ${adj.reason}`,
                        document: `AJUSTE-${adj.id}`,
                        quantity: adj.quantity,
                        user: adj.created_by,
                        notes: adj.notes
                    });
                }
            });

            transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return {
                productId: product.product_id,
                productDescription: productMap.get(product.product_id) || 'Producto Desconocido',
                clientProductCode: product.client_product_code || '',
                initialStock,
                totalReplenished,
                finalStock,
                consumption: consumption > 0 ? consumption : 0,
                price: product.price,
                totalValue: totalValue > 0 ? totalValue : 0,
                adjustments: totalAdjustments,
                transactions,
                boletaConsecutives,
                creationDates,
                deliveryDates,
                erpInvoices,
                erpMovementIds,
                approvers,
            };
        });

        const finalReportRows = reportRows.filter(row => row.consumption > 0 || row.initialStock > 0 || row.totalReplenished > 0 || row.adjustments !== 0 || row.finalStock > 0);
        
        return { reportRows: finalReportRows, boletas: boletasInPeriod, allBoletasForClient, allClosuresForClient };

    } catch (error: any) {
        logError('Failed to generate consignments report data', { error: error.message });
        throw new Error(`No se pudo generar el reporte de consignaciones: ${error.message}`);
    }
}

export async function getInventoryMonitorData(agreementId: number): Promise<any> {
    const mainDb = await connectDb();
    const productMap = new Map((await mainDb.prepare('SELECT id, description FROM products').all() as Product[]).map(p => [p.id, p.description]));

    const lastClosure = await getLatestApprovedClosure(agreementId);
    const startDate = lastClosure ? new Date(lastClosure.created_at) : new Date(0); // From beginning of time if no closure
    const endDate = new Date(); // To now

    const [boletasInPeriod, lastPhysicalCount, countHistory, adjustmentsInPeriod] = await Promise.all([
        getBoletasByDateRange(String(agreementId), { from: startDate, to: endDate }),
        getLatestPhysicalCount(agreementId),
        getPhysicalCountHistory(agreementId),
        getAdjustmentsInPeriod(agreementId, { from: startDate, to: endDate })
    ]);

    const theoreticalInventory = new Map<string, { description: string, quantity: number }>();
    
    // Set initial inventory from last closure
    if (lastClosure && lastClosure.closure_boleta_id) {
        const lastClosureDetails = await getBoletaDetails(lastClosure.closure_boleta_id);
        lastClosureDetails?.lines.forEach(line => {
            theoreticalInventory.set(line.product_id, {
                description: productMap.get(line.product_id) || 'Desconocido',
                quantity: line.counted_quantity
            });
        });
    }

    // Add all deliveries
    boletasInPeriod.forEach((boleta: RestockBoleta & { lines: BoletaLine[] }) => {
        if (boleta.type === 'REPOSITION') {
            boleta.lines.forEach((line: BoletaLine) => {
                const current = theoreticalInventory.get(line.product_id) || { description: productMap.get(line.product_id) || 'Desconocido', quantity: 0 };
                current.quantity += line.replenish_quantity;
                theoreticalInventory.set(line.product_id, current);
            });
        }
    });

    // Apply adjustments
    adjustmentsInPeriod.forEach((adjustment: ConsignmentAdjustment) => {
        const current = theoreticalInventory.get(adjustment.product_id) || { description: productMap.get(adjustment.product_id) || 'Desconocido', quantity: 0 };
        current.quantity += adjustment.quantity;
        theoreticalInventory.set(adjustment.product_id, current);
    });

    let lastPhysicalCountEnriched: any = null;
    if (lastPhysicalCount) {
        const latestTimestamp = lastPhysicalCount[0].counted_at;
        const latestCountLines = lastPhysicalCount.filter((c: PhysicalCount) => c.counted_at === latestTimestamp);

        lastPhysicalCountEnriched = {
            counted_at: latestTimestamp,
            counted_by: latestCountLines[0].counted_by,
            lines: latestCountLines.map((line: PhysicalCount) => ({
                ...line,
                productDescription: productMap.get(line.product_id) || 'Desconocido',
            }))
        };
    }
    
    return JSON.parse(JSON.stringify({
        theoreticalInventory: Object.fromEntries(theoreticalInventory.entries()),
        lastPhysicalCount: lastPhysicalCountEnriched,
        countHistory,
    }));
}
