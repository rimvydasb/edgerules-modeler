import {useCallback, useEffect, useState} from 'react';

export interface WorkspaceStorage {
    usage?: number; // bytes used by the origin
    quota?: number; // bytes available to the origin
    persistent?: boolean; // false: the browser can evict the data; undefined: unknown
    canPersist: boolean; // the browser offers `navigator.storage.persist`
    keepDenied: boolean; // the browser refused the last `keep` request
    keep: () => Promise<boolean>; // asks the browser to keep the projects; resolves to the new persistent state
}

type Details = Pick<WorkspaceStorage, 'usage' | 'quota' | 'persistent'>;

function browserStorage(): StorageManager | undefined {
    return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

/** Reads the usage and persistence of the workspace storage. `refresh` changes re-read the estimate. */
export function useWorkspaceStorage(refresh: unknown): WorkspaceStorage {
    const [state, setState] = useState<Details>({});
    const [keepDenied, setKeepDenied] = useState(false);

    useEffect(() => {
        const storage = browserStorage();
        if (!storage) return;
        let cancelled = false;
        void (async () => {
            try {
                const persistent = storage.persisted ? await storage.persisted() : undefined;
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

    // The browser may show a prompt, so persistence is requested only on the user's click.
    const keep = useCallback(async () => {
        const storage = browserStorage();
        if (!storage?.persist) return false;
        try {
            const persistent = await storage.persist();
            setState((current) => ({...current, persistent}));
            setKeepDenied(!persistent);
            return persistent;
        } catch {
            setKeepDenied(true);
            return false;
        }
    }, []);

    return {...state, keepDenied, canPersist: typeof browserStorage()?.persist === 'function', keep};
}
