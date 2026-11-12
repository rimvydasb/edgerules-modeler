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

/** The industry title of every example id, for the label of a project copied from an example. */
export function useExampleIndustries(library: LibraryClient | undefined): ReadonlyMap<string, string> {
    const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());
    useEffect(() => {
        if (!library) return;
        let cancelled = false;
        library.loadIndex().then(
            (index) => {
                if (cancelled) return;
                const industries = new Map(index.industries.map((industry) => [industry.id, industry.title]));
                setTitles(
                    new Map(
                        index.examples.map((entry) => [entry.id, industries.get(entry.industry) ?? entry.industry]),
                    ),
                );
            },
            () => undefined, // the label is informational; an index failure falls back to "From example"
        );
        return () => {
            cancelled = true;
        };
    }, [library]);
    return library ? titles : new Map();
}
