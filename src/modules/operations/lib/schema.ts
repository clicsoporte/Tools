/**
 * @fileoverview Defines the expected database schema for the new Operations module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const operationsSchema: ExpectedSchema = {
    'operations_document_types': ['id', 'name', 'description', 'prefix', 'nextNumber'],
    'operations_documents': [
        'id', 'consecutive', 'documentTypeId', 'status', 'requestDate', 'notes',
        'relatedProductionOrderId', 'relatedPurchaseRequestId', 'relatedCustomerId',
        'requesterId', 'requesterName', 'requesterSignedAt',
        'processorId', 'processorName', 'processorSignedAt'
    ],
    'operations_document_lines': [
        'id', 'documentId', 'itemId', 'itemDescription', 'quantity', 'lotId',
        'sourceLocationId', 'destinationLocationId'
    ],
    'operations_document_history': ['id', 'documentId', 'timestamp', 'status', 'notes', 'updatedBy'],
};
