import {useEffect, useState} from 'react';
import type {LibraryClient} from '../example-library';
import type {ProjectOrigin} from '../project-session';

/** The newest released version of every example id; empty without a library or while the index loads. */
export function useNewestVersions(library: LibraryClient | undefined): ReadonlyMap<string, string> {
    const [newest, setNewest] = useState<ReadonlyMap<string, string>>(new Map());
    useEffect(() => {
        if (!library) return;
        let cancelled = false;
        library.loadIndex().then(
            (index) => {
                if (!cancelled)
                    setNewest(new Map(index.examples.map((entry) => [entry.id, entry.versions[0].version])));
            },
            () => undefined, // the badge is informational; an index failure hides it
        );
        return () => {
            cancelled = true;
        };
    }, [library]);
    return library ? newest : new Map();
}

/** A copy of an older version than the newest one in the index. */
export function isOutdated(origin: ProjectOrigin, newest: ReadonlyMap<string, string>): boolean {
    const latest = newest.get(origin.id);
    return latest !== undefined && latest !== origin.version;
}
