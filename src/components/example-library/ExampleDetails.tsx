import {Alert, Anchor, Badge, Button, Group, Loader, Select, SimpleGrid, Stack, Text, Title} from '@mantine/core';
import {useEffect, useMemo, useState, type ReactElement} from 'react';
import {MarkdownView} from '../markdown-view';
import type {ProjectOrigin} from '../project-session';
import {ExamplePanel} from './ExamplePanel';
import {relatedExamples, workspaceStatus} from './libraryQuery';
import {satisfiesEngine} from './semver';
import type {ExampleCoordinates, LibraryClient, LibraryEntry, LoadedExample} from './types';
import {useLibraryIndex} from './useLibraryIndex';

export interface ExampleDetailsProps {
    client: LibraryClient; // from createLibraryClient(source)
    example: ExampleCoordinates; // from the route; an unknown id or version shows "Example not found"
    onVersionChange?: (coordinates: ExampleCoordinates) => void; // the host updates the route
    engineVersion?: string; // version of the loaded engine, for the compatibility warning
    workspaceOrigins?: ProjectOrigin[]; // origins of the workspace projects, for the badge
    onCopy: (example: LoadedExample, open: boolean) => void; // "Copy and open" and "Copy to workspace"
    onShowDetails: (coordinates: ExampleCoordinates) => void; // a related example
    shareUrl?: (coordinates: ExampleCoordinates) => string; // the URL that "Share link" copies; no button without it
    repositoryUrl?: (entry: LibraryEntry, ref: string) => string; // the "View on GitHub" link; no link without it
}

function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** The Example details page: actions, version selector, rendered README, metadata and related examples. */
export function ExampleDetails({
    client,
    example,
    onVersionChange,
    engineVersion,
    workspaceOrigins,
    onCopy,
    onShowDetails,
    shareUrl,
    repositoryUrl,
}: ExampleDetailsProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const entry = search?.index.examples.find((candidate) => candidate.id === example.id);
    const version = entry?.versions.find((candidate) => candidate.version === example.version);

    const [readme, setReadme] = useState<{key: string; text?: string; error?: string}>();
    const [busy, setBusy] = useState<'open' | 'copy'>();
    const [actionError, setActionError] = useState<string | undefined>();
    const [copied, setCopied] = useState(false);
    const key = `${example.id}@${example.version}`;

    useEffect(() => {
        if (!entry || !version) return;
        let cancelled = false;
        client.loadReadme(entry, version.version).then(
            (text) => !cancelled && setReadme({key, text}),
            (failure: unknown) => !cancelled && setReadme({key, error: message(failure)}),
        );
        return () => {
            cancelled = true;
        };
    }, [client, entry, version, key]);

    const resolveUrl = useMemo(
        () =>
            entry && version
                ? (relative: string) => client.resolveFileUrl(entry, version.version, relative)
                : undefined,
        [client, entry, version],
    );

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
    if (!search) return <Loader size="sm" aria-label="Loading example" />;
    if (!entry || !version)
        return (
            <Alert color="gray" title="Example not found">
                {key} is not in the library.
            </Alert>
        );

    const industry = search.index.industries.find((item) => item.id === entry.industry);
    const status = workspaceStatus(entry, workspaceOrigins);
    const incompatible = engineVersion !== undefined && !satisfiesEngine(engineVersion, entry.engine);
    const related = relatedExamples(search.index, entry);
    const currentReadme = readme?.key === key ? readme : undefined;

    const copy = async (open: boolean) => {
        setBusy(open ? 'open' : 'copy');
        setActionError(undefined);
        try {
            onCopy(await client.loadExample(entry, version.version), open);
        } catch (failure) {
            setActionError(message(failure));
        } finally {
            setBusy(undefined);
        }
    };

    const share = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl(example));
            setCopied(true);
        } catch (failure) {
            setActionError(message(failure));
        }
    };

    return (
        <Stack gap="md" data-testid="example-details">
            <Text size="sm" c="dimmed">
                Examples / {industry?.title ?? entry.industry} / {entry.name}
            </Text>
            <Group justify="space-between" align="flex-start">
                <div>
                    <Title order={2}>{entry.name}</Title>
                    <Text c="dimmed">{entry.description}</Text>
                    <Group gap={4} mt={4}>
                        {status === 'in-workspace' && (
                            <Badge color="green" variant="light">
                                ✓ In workspace
                            </Badge>
                        )}
                        {status === 'update-available' && (
                            <Badge color="yellow" variant="light">
                                Update available
                            </Badge>
                        )}
                    </Group>
                </div>
                <Select
                    label="Version"
                    data={entry.versions.map((item) => item.version)}
                    value={version.version}
                    allowDeselect={false}
                    w={140}
                    onChange={(next) => next && onVersionChange?.({id: entry.id, version: next})}
                />
            </Group>
            <Group>
                <Button loading={busy === 'open'} onClick={() => void copy(true)}>
                    Copy and open
                </Button>
                <Button variant="default" loading={busy === 'copy'} onClick={() => void copy(false)}>
                    Copy to workspace
                </Button>
                {shareUrl && (
                    <Button variant="default" onClick={() => void share()}>
                        {copied ? 'Link copied' : 'Share link'}
                    </Button>
                )}
            </Group>
            {incompatible && (
                <Alert color="yellow" title="Engine version" role="status">
                    This example needs the engine {entry.engine}; the loaded engine is {engineVersion}. You can still
                    copy it.
                </Alert>
            )}
            {actionError && (
                <Alert color="red" role="alert" withCloseButton onClose={() => setActionError(undefined)}>
                    {actionError}
                </Alert>
            )}
            <SimpleGrid cols={{base: 1, md: 3}}>
                <div style={{gridColumn: 'span 2'}}>
                    {!currentReadme && <Loader size="sm" aria-label="Loading README" />}
                    {currentReadme?.error && (
                        <Alert color="red" role="alert">
                            README.md: {currentReadme.error}
                        </Alert>
                    )}
                    {currentReadme?.text !== undefined && (
                        <MarkdownView markdown={currentReadme.text} resolveUrl={resolveUrl} />
                    )}
                </div>
                <Stack gap={4} component="aside" aria-label="Example metadata">
                    <Text size="sm">Level: {entry.level}</Text>
                    <Text size="sm">Features: {entry.features.join(', ')}</Text>
                    {entry.stats && (
                        <Text size="sm">
                            {entry.stats.tests ?? 0} tests · {entry.stats.lines ?? 0} lines
                        </Text>
                    )}
                    <Text size="sm">Engine: {entry.engine}</Text>
                    <Text size="sm">Released: {version.released}</Text>
                    {repositoryUrl && (
                        <Anchor href={repositoryUrl(entry, version.ref)} target="_blank" rel="noreferrer" size="sm">
                            View on GitHub →
                        </Anchor>
                    )}
                </Stack>
            </SimpleGrid>
            {related.length > 0 && (
                <Stack gap="xs">
                    <Text fw={600}>Related examples</Text>
                    <SimpleGrid cols={{base: 1, sm: 3}}>
                        {related.map((other) => (
                            <ExamplePanel
                                key={other.id}
                                entry={other}
                                industryTitle={industry?.title ?? other.industry}
                                status={workspaceStatus(other, workspaceOrigins)}
                                onCopyAndOpen={() =>
                                    void client.loadExample(other, other.versions[0].version).then(
                                        (loaded) => onCopy(loaded, true),
                                        (failure: unknown) => setActionError(message(failure)),
                                    )
                                }
                                onDetails={() => onShowDetails({id: other.id, version: other.versions[0].version})}
                            />
                        ))}
                    </SimpleGrid>
                </Stack>
            )}
        </Stack>
    );
}
