import {useCallback, useEffect, useMemo, useState} from 'react';
import {buildSearchIndex, type SearchIndex} from './libraryQuery';
import type {LibraryClient} from './types';

export interface LibraryIndexState {
    search: SearchIndex | undefined; // undefined while loading or after a failure
    error: string | undefined;
    retry: () => void;
}

/** Loads the index of a client and builds the search index once. */
export function useLibraryIndex(client: LibraryClient): LibraryIndexState {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{
        client: LibraryClient;
        attempt: number;
        search?: SearchIndex;
        error?: string;
    }>();

    useEffect(() => {
        let cancelled = false;
        client.loadIndex().then(
            (index) => {
                if (!cancelled) setState({client, attempt, search: buildSearchIndex(index)});
            },
            (error: unknown) => {
                if (!cancelled)
                    setState({client, attempt, error: error instanceof Error ? error.message : String(error)});
            },
        );
        return () => {
            cancelled = true;
        };
    }, [client, attempt]);

    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    const current = state?.client === client && state.attempt === attempt ? state : undefined;
    return useMemo(() => ({search: current?.search, error: current?.error, retry}), [current, retry]);
}
