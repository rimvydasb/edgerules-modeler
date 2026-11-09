import {useEffect, useState} from 'react';

export interface WorkspaceStorage {
    usage?: number; // bytes used by the origin
    quota?: number; // bytes available to the origin
    persistent?: boolean; // false: the browser can evict the data; undefined: unknown
}

/** Requests persistent storage on first use and reads the usage. `refresh` changes re-read the estimate. */
export function useWorkspaceStorage(refresh: unknown): WorkspaceStorage {
    const [state, setState] = useState<WorkspaceStorage>({});

    useEffect(() => {
        const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
        if (!storage) return;
        let cancelled = false;
        void (async () => {
            try {
                let persistent = storage.persisted ? await storage.persisted() : undefined;
                if (persistent === false && storage.persist) persistent = await storage.persist();
                const estimate = storage.estimate ? await storage.estimate() : undefined;
                if (!cancelled) setState({usage: estimate?.usage, quota: estimate?.quota, persistent});
            } catch {
                // Storage details are informational; the workspace works without them.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [refresh]);

    return state;
}
