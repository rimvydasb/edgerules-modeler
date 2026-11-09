import {Alert, Button, Checkbox, Group, Loader, MultiSelect, Select, Stack, Tabs, Text, TextInput} from '@mantine/core';
import {useEffect, useMemo, useRef, useState, type ReactElement} from 'react';
import type {ExampleLevel, ProjectOrigin} from '../project-session';
import {ExamplePanel} from './ExamplePanel';
import {VirtualGrid} from './VirtualGrid';
import {
    allFeatures,
    countByIndustry,
    featuredExamples,
    searchExamples,
    workspaceStatus,
    type ExampleSort,
} from './libraryQuery';
import {satisfiesEngine} from './semver';
import type {ExampleCoordinates, LibraryClient, LibraryEntry, LoadedExample} from './types';
import {useLibraryIndex} from './useLibraryIndex';

export interface ExampleGalleryProps {
    client: LibraryClient; // from createLibraryClient(source)
    industry?: string; // controlled industry tab; undefined is "All"
    onIndustryChange?: (industry: string | undefined) => void; // the host updates the route
    query?: string; // controlled search text, from the Home search box or the route
    onQueryChange?: (query: string) => void; // search text change
    featured?: boolean; // featured mode for the Home page: index.featured only, no tabs or facets
    limit?: number; // maximum number of panels
    engineVersion?: string; // version of the loaded engine, for the compatibility facet
    workspaceOrigins?: ProjectOrigin[]; // origins of the workspace projects, for the badges
    onCopy: (example: LoadedExample, open: boolean) => void; // the host adds the copy; `open` for "Copy and open"
    onShowDetails: (coordinates: ExampleCoordinates) => void; // the host navigates to the details page
}

const ROW_HEIGHT = 340;
const ALL = 'all';
const LEVELS: {value: ExampleLevel; label: string}[] = [
    {value: 'beginner', label: 'Beginner'},
    {value: 'intermediate', label: 'Intermediate'},
    {value: 'advanced', label: 'Advanced'},
];
const SORTS: {value: ExampleSort; label: string}[] = [
    {value: 'relevance', label: 'Relevance'},
    {value: 'name', label: 'Name'},
    {value: 'release', label: 'Last release'},
];

/** A value that the host controls when it reports changes, and that the component keeps itself otherwise. */
function useHostValue<T>(value: T, controlled: boolean): [T, (next: T) => void] {
    const [own, setOwn] = useState(value);
    const [previous, setPrevious] = useState(value);
    if (previous !== value) {
        // The host changed the prop (a route change): follow it.
        setPrevious(value);
        setOwn(value);
    }
    return [controlled ? value : own, setOwn];
}

/** The Examples page and the featured row of the Home page: industry tabs, search, facets, sort and example panels. */
export function ExampleGallery({
    client,
    industry: industryProp,
    onIndustryChange,
    query: queryProp = '',
    onQueryChange,
    featured,
    limit,
    engineVersion,
    workspaceOrigins,
    onCopy,
    onShowDetails,
}: ExampleGalleryProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const [industry, setOwnIndustry] = useHostValue(industryProp, onIndustryChange !== undefined);
    const [query, setOwnQuery] = useHostValue(queryProp, onQueryChange !== undefined);
    const [level, setLevel] = useState<ExampleLevel | undefined>();
    const [features, setFeatures] = useState<string[]>([]);
    const [compatible, setCompatible] = useState(false);
    const [sort, setSort] = useState<ExampleSort | undefined>();
    const [busyId, setBusyId] = useState<string | undefined>();
    const [copyError, setCopyError] = useState<string | undefined>();
    const searchInput = useRef<HTMLInputElement>(null);

    // `/` focuses the search box from anywhere on the page.
    useEffect(() => {
        if (featured) return;
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.key !== '/' || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            event.preventDefault();
            searchInput.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [featured]);

    const entries = useMemo<LibraryEntry[]>(() => {
        if (!search) return [];
        const shown = featured
            ? featuredExamples(search.index)
            : searchExamples(search, {
                  query,
                  industry,
                  level,
                  features,
                  compatibleWith: compatible ? engineVersion : undefined,
                  sort,
              });
        return limit === undefined ? shown : shown.slice(0, limit);
    }, [search, featured, query, industry, level, features, compatible, engineVersion, sort, limit]);

    const industries = search?.index.industries ?? [];
    const titles = useMemo(() => new Map(industries.map((item) => [item.id, item.title])), [industries]);
    const counts = useMemo(() => (search ? countByIndustry(search.index) : new Map<string, number>()), [search]);
    const featureOptions = useMemo(() => (search ? allFeatures(search.index) : []), [search]);

    if (error) {
        return (
            <Alert color="red" title="The example library did not load" role="alert">
                <Text size="sm">{error}</Text>
                <Button mt="xs" size="compact-sm" onClick={retry}>
                    Retry
                </Button>
            </Alert>
        );
    }
    if (!search) return <Loader size="sm" aria-label="Loading examples" />;

    const copyAndOpen = async (entry: LibraryEntry) => {
        setBusyId(entry.id);
        setCopyError(undefined);
        try {
            onCopy(await client.loadExample(entry, entry.versions[0].version), true);
        } catch (failure) {
            setCopyError(`${entry.name}: ${failure instanceof Error ? failure.message : String(failure)}`);
        } finally {
            setBusyId(undefined);
        }
    };

    return (
        <Stack gap="sm" data-testid="example-gallery">
            {!featured && (
                <>
                    <Group align="flex-end" wrap="wrap">
                        <TextInput
                            ref={searchInput}
                            placeholder="Search examples"
                            aria-label="Search examples"
                            value={query}
                            style={{flex: 1, minWidth: 220}}
                            onChange={(event) => {
                                setOwnQuery(event.currentTarget.value);
                                onQueryChange?.(event.currentTarget.value);
                            }}
                        />
                        <Select
                            aria-label="Level"
                            placeholder="Level"
                            data={LEVELS}
                            value={level ?? null}
                            clearable
                            onChange={(value) => setLevel((value as ExampleLevel | null) ?? undefined)}
                        />
                        <MultiSelect
                            aria-label="Features"
                            placeholder="Features"
                            data={featureOptions}
                            value={features}
                            searchable
                            onChange={setFeatures}
                        />
                        <Select
                            aria-label="Sort"
                            data={SORTS}
                            value={sort ?? (query.trim() ? 'relevance' : 'name')}
                            allowDeselect={false}
                            onChange={(value) => setSort((value as ExampleSort | null) ?? undefined)}
                        />
                        {engineVersion && (
                            <Checkbox
                                label="Works with my engine"
                                checked={compatible}
                                onChange={(event) => setCompatible(event.currentTarget.checked)}
                            />
                        )}
                    </Group>
                    <Tabs
                        value={industry ?? ALL}
                        onChange={(value) => {
                            const next = value === null || value === ALL ? undefined : value;
                            setOwnIndustry(next);
                            onIndustryChange?.(next);
                        }}
                    >
                        <Tabs.List>
                            <Tabs.Tab value={ALL}>All ({search.index.examples.length})</Tabs.Tab>
                            {industries.map((item) => (
                                <Tabs.Tab key={item.id} value={item.id}>
                                    {item.title} ({counts.get(item.id) ?? 0})
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs>
                    <Text size="sm" c="dimmed" role="status">
                        {entries.length} {entries.length === 1 ? 'example' : 'examples'}
                    </Text>
                </>
            )}
            {copyError && (
                <Alert color="red" role="alert" withCloseButton onClose={() => setCopyError(undefined)}>
                    {copyError}
                </Alert>
            )}
            {entries.length === 0 && <Text c="dimmed">No example matches.</Text>}
            <VirtualGrid
                label="Examples"
                items={entries}
                itemKey={(entry) => entry.id}
                rowHeight={ROW_HEIGHT}
                renderItem={(entry, _index, tabIndex) => (
                    <ExamplePanel
                        entry={entry}
                        industryTitle={titles.get(entry.industry) ?? entry.industry}
                        status={workspaceStatus(entry, workspaceOrigins)}
                        incompatible={engineVersion !== undefined && !satisfiesEngine(engineVersion, entry.engine)}
                        thumbnailUrl={
                            entry.thumbnail
                                ? client.resolveFileUrl(entry, entry.versions[0].version, entry.thumbnail)
                                : undefined
                        }
                        busy={busyId === entry.id}
                        tabIndex={tabIndex}
                        onCopyAndOpen={() => void copyAndOpen(entry)}
                        onDetails={() => onShowDetails({id: entry.id, version: entry.versions[0].version})}
                    />
                )}
            />
        </Stack>
    );
}
