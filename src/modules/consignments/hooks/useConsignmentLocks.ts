'use client';

// This hook is obsolete as the underlying locking mechanism has been removed.
// It is kept as an empty shell to prevent build errors from old imports
// but should be considered for deletion in future cleanup efforts.
import { useState } from 'react';

export const useConsignmentLocks = () => {
    const [state] = useState({
        isLoading: false,
        isReleasing: null,
        locks: [],
    });
    const actions = {
        fetchLocks: () => {},
        handleReleaseLock: () => {},
    };

    return { state, actions };
};
