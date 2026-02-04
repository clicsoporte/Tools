/**
 * @fileoverview Defines the expected database schema for the new IT Tools module.
 * This is used by the central database audit system to verify integrity.
 */

import type { ExpectedSchema } from '@/modules/core/types';

export const itToolsSchema: ExpectedSchema = {
    'it_notes': [
        'id',
        'title',
        'content',
        'tags',
        'linkedModule',
        'createdBy',
        'createdAt',
        'updatedAt',
    ],
    'it_settings': ['key', 'value'],
};
