
/**
 * @fileoverview Defines the expected database schema for the new Consignments module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const consignmentsSchema: ExpectedSchema = {
    'consignment_agreements': ['id', 'client_id', 'client_name', 'erp_warehouse_id', 'next_boleta_number', 'notes', 'is_active', 'product_code_display_mode'],
    'consignment_products': ['id', 'agreement_id', 'product_id', 'max_stock', 'price', 'client_product_code'],
    'counting_sessions': ['id', 'agreement_id', 'user_id', 'status', 'created_at'],
    'counting_session_lines': ['id', 'session_id', 'product_id', 'counted_quantity'],
    'restock_boletas': ['id', 'consecutive', 'agreement_id', 'status', 'created_by', 'submitted_by', 'created_at', 'approved_by', 'approved_at', 'erp_invoice_number', 'notes'],
    'boleta_lines': ['id', 'boleta_id', 'product_id', 'product_description', 'counted_quantity', 'replenish_quantity', 'max_stock', 'price', 'is_manually_edited', 'client_product_code'],
    'boleta_history': ['id', 'boleta_id', 'timestamp', 'status', 'notes', 'updatedBy'],
    'consignments_settings': ['key', 'value'],
};

    
