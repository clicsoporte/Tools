/**
 * @fileoverview This hook is obsolete and has been replaced by useWarehouseExplorer.
 * This file's content has been removed to complete the deprecation process.
 */
'use client';

export function useCleanupTool() {
    return {
        state: { isLoading: true, isSubmitting: false },
        actions: {},
        selectors: { searchOptions: [], getCleanupTitle: () => '' },
        isAuthorized: false,
    };
}
