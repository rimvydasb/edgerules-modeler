import type {ExampleLevel, ProjectOrigin} from '../project-session';
import {satisfiesEngine} from './semver';
import type {LibraryEntry, LibraryIndex} from './types';

export type ExampleSort = 'relevance' | 'name' | 'release';

export interface ExampleFilters {
    query?: string;
    industry?: string; // undefined is "All"
    level?: ExampleLevel;
    features?: string[]; // all of them (AND)
    compatibleWith?: string; // engine version: only the examples whose engine range includes it
    sort?: ExampleSort;
}

interface Indexed {
    entry: LibraryEntry;
    name: string; // lowercase
    text: string; // lowercase haystack of every searchable field
}

/** The lowercase text index of the examples, built once after `loadIndex`. */
export interface SearchIndex {
    index: LibraryIndex;
    items: Indexed[];
}

export function buildSearchIndex(index: LibraryIndex): SearchIndex {
    const industries = new Map(index.industries.map((industry) => [industry.id, industry.title]));
    const items = index.examples.map((entry) => ({
        entry,
        name: entry.name.toLowerCase(),
        text: [
            entry.name,
            entry.description,
            entry.id,
            industries.get(entry.industry) ?? entry.industry,
            ...(entry.tags ?? []),
            ...entry.features,
        ]
            .join('\n')
            .toLowerCase(),
    }));
    return {index, items};
}

function relevance(item: Indexed, tokens: string[]): number {
    let score = 0;
    for (const token of tokens) {
        if (item.name === token) score += 10;
        else if (item.name.startsWith(token)) score += 6;
        else if (item.name.includes(token)) score += 4;
        else score += 1;
    }
    return score;
}

function released(entry: LibraryEntry): string {
    return entry.versions[0]?.released ?? '';
}

/** Filters and sorts the examples. Every query token must occur in a searchable field. */
export function searchExamples(search: SearchIndex, filters: ExampleFilters = {}): LibraryEntry[] {
    const tokens = (filters.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const sort: ExampleSort = filters.sort ?? (tokens.length > 0 ? 'relevance' : 'name');
    const matches: {item: Indexed; score: number}[] = [];
    for (const item of search.items) {
        const {entry} = item;
        if (filters.industry && entry.industry !== filters.industry) continue;
        if (filters.level && entry.level !== filters.level) continue;
        if (filters.features?.some((feature) => !entry.features.includes(feature))) continue;
        if (filters.compatibleWith && !satisfiesEngine(filters.compatibleWith, entry.engine)) continue;
        if (tokens.some((token) => !item.text.includes(token))) continue;
        matches.push({item, score: relevance(item, tokens)});
    }
    matches.sort((a, b) => {
        if (sort === 'relevance' && a.score !== b.score) return b.score - a.score;
        if (sort === 'release') {
            const byDate = released(b.item.entry).localeCompare(released(a.item.entry));
            if (byDate !== 0) return byDate;
        }
        return a.item.entry.name.localeCompare(b.item.entry.name) || a.item.entry.id.localeCompare(b.item.entry.id);
    });
    return matches.map(({item}) => item.entry);
}

/** The examples of `index.featured`, in that order; unknown ids are skipped. */
export function featuredExamples(index: LibraryIndex): LibraryEntry[] {
    const byId = new Map(index.examples.map((entry) => [entry.id, entry]));
    return index.featured.flatMap((id) => byId.get(id) ?? []);
}

/** The examples with the newest release dates. */
export function newestExamples(index: LibraryIndex, limit: number): LibraryEntry[] {
    return [...index.examples]
        .sort((a, b) => released(b).localeCompare(released(a)) || a.name.localeCompare(b.name))
        .slice(0, limit);
}

/** Up to `limit` examples of the same industry, ordered by the number of shared features. */
export function relatedExamples(index: LibraryIndex, entry: LibraryEntry, limit = 3): LibraryEntry[] {
    const shared = (other: LibraryEntry) => other.features.filter((feature) => entry.features.includes(feature)).length;
    return index.examples
        .filter((other) => other.industry === entry.industry && other.id !== entry.id)
        .sort((a, b) => shared(b) - shared(a) || a.name.localeCompare(b.name))
        .slice(0, limit);
}

export type WorkspaceStatus = 'none' | 'in-workspace' | 'update-available';

/** What the workspace holds of an example: nothing, a copy of the newest version, or older copies only. */
export function workspaceStatus(entry: LibraryEntry, origins: readonly ProjectOrigin[] | undefined): WorkspaceStatus {
    const copies = (origins ?? []).filter((origin) => origin.id === entry.id);
    if (copies.length === 0) return 'none';
    const newest = entry.versions[0]?.version;
    return copies.some((origin) => origin.version === newest) ? 'in-workspace' : 'update-available';
}

/** The number of workspace copies of an example, of any version. */
export function workspaceCopies(entry: LibraryEntry, origins: readonly ProjectOrigin[] | undefined): number {
    return (origins ?? []).filter((origin) => origin.id === entry.id).length;
}

export function countByIndustry(index: LibraryIndex): Map<string, number> {
    const counts = new Map<string, number>();
    for (const entry of index.examples) counts.set(entry.industry, (counts.get(entry.industry) ?? 0) + 1);
    return counts;
}

export function allFeatures(index: LibraryIndex): string[] {
    return [...new Set(index.examples.flatMap((entry) => entry.features))].sort();
}
