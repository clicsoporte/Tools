/**
 * @fileoverview Defines the expected database schema for the Warehouse module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const warehouseSchema: ExpectedSchema = {
    'locations': ['id', 'name', 'code', 'type', 'parentId', 'isLocked', 'lockedBy', 'lockedBySessionId'],
    'inventory': ['id', 'itemId', 'locationId', 'quantity', 'lastUpdated', 'updatedBy'],
    'item_locations': ['id', 'itemId', 'locationId', 'clientId', 'isExclusive', 'requiresCertificate', 'updatedBy', 'updatedAt'],
    'inventory_units': ['id', 'unitCode', 'receptionConsecutive', 'correctionConsecutive', 'correctedFromUnitId', 'productId', 'humanReadableId', 'documentId', 'erpDocumentId', 'locationId', 'quantity', 'notes', 'createdAt', 'createdBy', 'status', 'annulledAt', 'annulledBy'],
    'movements': ['id', 'itemId', 'quantity', 'fromLocationId', 'toLocationId', 'timestamp', 'userId', 'notes'],
    'warehouse_config': ['key', 'value'],
};

    
