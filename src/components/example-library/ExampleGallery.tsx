import {Alert, Button, Select, Stack, Text, TextInput} from '@mantine/core';
import {IconSearch} from '@tabler/icons-react';
import {useEffect, useMemo, useRef, useState, type ReactElement} from 'react';
import {cx} from '#ui/cx';
import {SheetEmpty, SheetPageHeader, sheetClasses} from '#ui/sheet';
import type {ExampleLevel, ProjectOrigin} from '../project-session';
import {ExamplePanel} from './ExamplePanel';
import {IndustryIcon} from './industryIcon';
import {LEVEL_LABELS} from './levels';
import {VirtualGrid} from './VirtualGrid';
import {
    allFeatures,
    countByIndustry,
    featuredExamples,
    searchExamples,
    workspaceCopies,
    workspaceStatus,
    type ExampleSort,
} from './libraryQuery';
import {satisfiesEngine} from './semver';
import type {ExampleCoordinates, LibraryClient, LibraryEntry, LoadedExample} from './types';
import {useLibraryIndex} from './useLibraryIndex';
import * as classes from './exampleGallery.module.css';
import {SodasLoader} from '#ui/SodasLoader';

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
    onOpenCopy?: (exampleId: string) => void; // "Open copy" of an example in the workspace; the host opens its newest copy
    onShowDetails: (coordinates: ExampleCoordinates) => void; // the host navigates to the details page
}

const ROW_HEIGHT = 232; // one card and the grid gap
const THUMBNAIL_HEIGHT = 103;
type WorkspaceFacet = 'any' | 'not-copied' | 'copied';
const WORKSPACE_FACETS: {value: WorkspaceFacet; label: string}[] = [
    {value: 'any', label: 'Any'},
    {value: 'not-copied', label: 'Not copied yet'},
    {value: 'copied', label: 'In my workspace'},
];
const LEVELS: {value: ExampleLevel; label: string}[] = (['beginner', 'intermediate', 'advanced'] as const).map(
    (value) => ({value, label: LEVEL_LABELS[value]}),
);
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
    onOpenCopy,
    onShowDetails,
}: ExampleGalleryProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const [industry, setOwnIndustry] = useHostValue(industryProp, onIndustryChange !== undefined);
    const [query, setOwnQuery] = useHostValue(queryProp, onQueryChange !== undefined);
    const [level, setLevel] = useState<ExampleLevel | undefined>();
    const [features, setFeatures] = useState<string[]>([]);
    const [compatible, setCompatible] = useState(false);
    const [workspace, setWorkspace] = useState<WorkspaceFacet>('any');
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
        const filtered =
            workspace === 'any'
                ? shown
                : shown.filter(
                      (entry) => (workspaceStatus(entry, workspaceOrigins) !== 'none') === (workspace === 'copied'),
                  );
        return limit === undefined ? filtered : filtered.slice(0, limit);
    }, [
        search,
        featured,
        query,
        industry,
        level,
        features,
        compatible,
        engineVersion,
        sort,
        limit,
        workspace,
        workspaceOrigins,
    ]);

    const industries = search?.index.industries ?? [];
    const byId = useMemo(() => new Map(industries.map((item) => [item.id, item])), [industries]);
    const counts = useMemo(() => (search ? countByIndustry(search.index) : new Map<string, number>()), [search]);
    const featureOptions = useMemo(() => (search ? allFeatures(search.index) : []), [search]);
    const featureCounts = useMemo(() => {
        const counted = new Map<string, number>();
        for (const entry of search?.index.examples ?? [])
            for (const feature of entry.features) counted.set(feature, (counted.get(feature) ?? 0) + 1);
        return counted;
    }, [search]);

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
    if (!search) return <SodasLoader label="Loading examples" />;

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
    const total = search.index.examples.length;
    const rowHeight = ROW_HEIGHT + (entries.some((entry) => entry.thumbnail) ? THUMBNAIL_HEIGHT : 0);

    const changeIndustry = (next: string | undefined) => {
        setOwnIndustry(next);
        onIndustryChange?.(next);
    };
    const toggleFeature = (feature: string) =>
        setFeatures((current) =>
            current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature],
        );

    const grid = (
        <>
            {copyError && (
                <Alert color="red" role="alert" withCloseButton onClose={() => setCopyError(undefined)}>
                    {copyError}
                </Alert>
            )}
            {entries.length === 0 && <SheetEmpty>No example matches.</SheetEmpty>}
            <VirtualGrid
                label="Examples"
                items={entries}
                itemKey={(entry) => entry.id}
                rowHeight={rowHeight}
                gap={14}
                minColumnWidth={260}
                renderItem={(entry, _index, tabIndex) => (
                    <ExamplePanel
                        entry={entry}
                        industryTitle={byId.get(entry.industry)?.title ?? entry.industry}
                        industryIcon={byId.get(entry.industry)?.icon}
                        status={workspaceStatus(entry, workspaceOrigins)}
                        copies={workspaceCopies(entry, workspaceOrigins)}
                        incompatible={engineVersion !== undefined && !satisfiesEngine(engineVersion, entry.engine)}
                        thumbnailUrl={
                            entry.thumbnail
                                ? client.resolveFileUrl(entry, entry.versions[0].version, entry.thumbnail)
                                : undefined
                        }
                        busy={busyId === entry.id}
                        tabIndex={tabIndex}
                        onCopyAndOpen={() => void copyAndOpen(entry)}
                        onOpenCopy={onOpenCopy && (() => onOpenCopy(entry.id))}
                        onDetails={() => onShowDetails({id: entry.id, version: entry.versions[0].version})}
                    />
                )}
            />
        </>
    );

    // The Home featured row: the cards only.
    if (featured)
        return (
            <Stack gap="md" data-testid="example-gallery">
                {grid}
            </Stack>
        );

    return (
        <Stack gap={28} className={sheetClasses.tokens} data-testid="example-gallery">
            <SheetPageHeader eyebrow="Library · read-only" title="Examples" />
            <div className={classes.layout}>
                <aside className={cx(sheetClasses.facets, classes.facets)} aria-label="Filters">
                    <div className={sheetClasses.facetGroup} role="group" aria-label="Industry">
                        <div className={sheetClasses.eyebrow}>Industry</div>
                        <button
                            type="button"
                            className={sheetClasses.facet}
                            aria-pressed={industry === undefined}
                            onClick={() => changeIndustry(undefined)}
                        >
                            All industries
                            <span className={sheetClasses.facetCount}>{total}</span>
                        </button>
                        {industries.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={sheetClasses.facet}
                                aria-pressed={industry === item.id}
                                onClick={() => changeIndustry(item.id)}
                            >
                                <IndustryIcon name={item.icon ?? item.id} size={15} />
                                {item.title}
                                <span className={sheetClasses.facetCount}>{counts.get(item.id) ?? 0}</span>
                            </button>
                        ))}
                    </div>
                    <div className={sheetClasses.facetGroup} role="radiogroup" aria-label="Level">
                        <div className={sheetClasses.eyebrow}>Level</div>
                        {[{value: undefined, label: 'Any level'}, ...LEVELS].map((item) => (
                            <label key={item.label} className={sheetClasses.facet}>
                                <input
                                    type="radio"
                                    name="level"
                                    checked={level === item.value}
                                    onChange={() => setLevel(item.value)}
                                />
                                {item.label}
                            </label>
                        ))}
                    </div>
                    <div className={sheetClasses.facetGroup} role="group" aria-label="Features">
                        <div className={sheetClasses.eyebrow}>Features</div>
                        {featureOptions.map((feature) => (
                            <label key={feature} className={sheetClasses.facet}>
                                <input
                                    type="checkbox"
                                    checked={features.includes(feature)}
                                    onChange={() => toggleFeature(feature)}
                                />
                                <code className={classes.feature}>{feature}</code>
                                <span className={sheetClasses.facetCount}>{featureCounts.get(feature) ?? 0}</span>
                            </label>
                        ))}
                    </div>
                    <div className={sheetClasses.facetGroup} role="radiogroup" aria-label="Workspace">
                        <div className={sheetClasses.eyebrow}>Workspace</div>
                        {WORKSPACE_FACETS.map((item) => (
                            <label key={item.value} className={sheetClasses.facet}>
                                <input
                                    type="radio"
                                    name="workspace"
                                    checked={workspace === item.value}
                                    onChange={() => setWorkspace(item.value)}
                                />
                                {item.label}
                            </label>
                        ))}
                    </div>
                    {engineVersion && (
                        <div className={sheetClasses.facetGroup}>
                            <label className={sheetClasses.facet}>
                                <input
                                    type="checkbox"
                                    checked={compatible}
                                    onChange={(event) => setCompatible(event.currentTarget.checked)}
                                />
                                Works with my engine
                            </label>
                        </div>
                    )}
                </aside>
                <div className={classes.results}>
                    <div className={classes.toolbar}>
                        <TextInput
                            ref={searchInput}
                            className={classes.searchBox}
                            classNames={{input: classes.input}}
                            leftSection={<IconSearch size={15} />}
                            rightSection={<span className={classes.kbd}>/</span>}
                            rightSectionPointerEvents="none"
                            placeholder="Search name, feature, tag…"
                            aria-label="Search examples"
                            value={query}
                            onChange={(event) => {
                                setOwnQuery(event.currentTarget.value);
                                onQueryChange?.(event.currentTarget.value);
                            }}
                        />
                        <Select
                            classNames={{input: classes.input}}
                            w={170}
                            leftSection={<span className={classes.sortLabel}>Sort</span>}
                            leftSectionWidth={44}
                            aria-label="Sort"
                            data={SORTS}
                            value={sort ?? (query.trim() ? 'relevance' : 'name')}
                            allowDeselect={false}
                            onChange={(value) => setSort((value as ExampleSort | null) ?? undefined)}
                        />
                    </div>
                    <Text size="xs" c="dimmed" role="status" className={classes.count}>
                        {entries.length} {entries.length === 1 ? 'example' : 'examples'}
                    </Text>
                    {grid}
                </div>
            </div>
        </Stack>
    );
}
