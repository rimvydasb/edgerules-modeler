import {Alert, Anchor, Button, Loader, Select, Stack, Text} from '@mantine/core';
import {
    IconBrandGithub,
    IconChevronRight,
    IconClock,
    IconCopy,
    IconExternalLink,
    IconFileText,
    IconInfoCircle,
    IconLink,
    IconPlus,
} from '@tabler/icons-react';
import {useEffect, useMemo, useState, type ReactElement} from 'react';
import {
    SheetAction,
    SheetGrid,
    SheetKeyValues,
    SheetLinkButton,
    SheetPageHeader,
    SheetPanel,
    SheetSection,
    SheetTokens,
    sheetClasses,
} from '#ui/sheet';
import {MarkdownView} from '../markdown-view';
import type {ProjectOrigin} from '../project-session';
import {ExamplePanel} from './ExamplePanel';
import {IndustryIcon} from './industryIcon';
import {LEVEL_LABELS} from './levels';
import {relatedExamples, workspaceCopies, workspaceStatus} from './libraryQuery';
import {satisfiesEngine} from './semver';
import type {ExampleCoordinates, LibraryClient, LibraryEntry, LoadedExample} from './types';
import {useLibraryIndex} from './useLibraryIndex';
import * as classes from './exampleDetails.module.css';

export interface ExampleDetailsProps {
    client: LibraryClient; // from createLibraryClient(source)
    example: ExampleCoordinates; // from the route; an unknown id or version shows "Example not found"
    onVersionChange?: (coordinates: ExampleCoordinates) => void; // the host updates the route
    engineVersion?: string; // version of the loaded engine, for the compatibility warning
    workspaceOrigins?: ProjectOrigin[]; // origins of the workspace projects, for the badge
    onCopy: (example: LoadedExample, open: boolean) => void; // "Copy and open" and "Copy to workspace"
    onOpenCopy?: (exampleId: string) => void; // "Open copy" of an example in the workspace; the host opens its newest copy
    onShowDetails: (coordinates: ExampleCoordinates) => void; // a related example
    onShowIndustry?: (industry: string | undefined) => void; // the "Examples / <industry>" crumbs; plain text without it
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
    onOpenCopy,
    onShowDetails,
    onShowIndustry,
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
    const copies = workspaceCopies(entry, workspaceOrigins);
    const incompatible = engineVersion !== undefined && !satisfiesEngine(engineVersion, entry.engine);
    const related = relatedExamples(search.index, entry);
    const currentReadme = readme?.key === key ? readme : undefined;
    const isNewest = entry.versions[0]?.version === version.version;

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

    const crumb = (label: string, target: string | undefined) =>
        onShowIndustry ? (
            <SheetLinkButton onClick={() => onShowIndustry(target)}>{label}</SheetLinkButton>
        ) : (
            <span>{label}</span>
        );

    return (
        <Stack gap="lg" className={sheetClasses.tokens} data-testid="example-details">
            <nav aria-label="Library path" className={classes.crumbs}>
                {crumb('Examples', undefined)}
                <IconChevronRight size={14} aria-hidden="true" />
                {crumb(industry?.title ?? entry.industry, entry.industry)}
                <IconChevronRight size={14} aria-hidden="true" />
                <span className={classes.crumbCurrent} aria-current="page">
                    {entry.name}
                </span>
            </nav>

            <SheetPageHeader
                icon={<IndustryIcon name={industry?.icon ?? entry.industry} size={22} />}
                title={entry.name}
                subtitle={entry.description}
                aside={
                    <>
                        <Select
                            classNames={{input: classes.versionInput}}
                            w={150}
                            leftSection={<IconClock size={14} aria-hidden="true" />}
                            aria-label="Version"
                            data={entry.versions.map((item, index) => ({
                                value: item.version,
                                label: index === 0 ? `${item.version} (latest)` : item.version,
                            }))}
                            value={version.version}
                            allowDeselect={false}
                            onChange={(next) => next && onVersionChange?.({id: entry.id, version: next})}
                        />
                        {status !== 'none' && onOpenCopy && (
                            <SheetAction
                                primary
                                icon={<IconExternalLink size={14} />}
                                onClick={() => onOpenCopy(entry.id)}
                            >
                                Open copy
                            </SheetAction>
                        )}
                        <SheetAction
                            primary={status === 'none' || !onOpenCopy}
                            busy={busy === 'open'}
                            icon={<IconCopy size={14} />}
                            onClick={() => void copy(true)}
                        >
                            Copy and open
                        </SheetAction>
                        <SheetAction
                            busy={busy === 'copy'}
                            icon={<IconPlus size={14} />}
                            onClick={() => void copy(false)}
                        >
                            Copy to workspace
                        </SheetAction>
                        {shareUrl && (
                            <SheetAction iconOnly icon={<IconLink size={16} />} onClick={() => void share()}>
                                {copied ? 'Link copied' : 'Share link'}
                            </SheetAction>
                        )}
                    </>
                }
            />

            {status !== 'none' && (
                <div className={classes.notice} role="status">
                    <IconInfoCircle size={16} aria-hidden="true" />
                    <span>
                        You have{' '}
                        <b>
                            {copies} {copies === 1 ? 'copy' : 'copies'}
                        </b>{' '}
                        of this example in your workspace.
                        {status === 'update-available' && ' A newer version is available.'}
                    </span>
                    {onOpenCopy && (
                        <SheetLinkButton onClick={() => onOpenCopy(entry.id)}>Open newest copy</SheetLinkButton>
                    )}
                </div>
            )}
            {!isNewest && (
                <Alert color="gray" role="status" py={6}>
                    You view version {version.version}; the newest version is {entry.versions[0].version}.
                </Alert>
            )}
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

            <div className={classes.columns}>
                <SheetPanel className={classes.readme}>
                    <div className={classes.readmeHead}>
                        <IconFileText size={14} aria-hidden="true" />
                        <span>README.md</span>
                    </div>
                    <div className={classes.readmeBody}>
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
                </SheetPanel>
                <Stack gap={12} component="aside" aria-label="Example metadata" className={classes.side}>
                    <SheetKeyValues
                        rows={[
                            ['Industry', industry?.title ?? entry.industry],
                            ['Level', LEVEL_LABELS[entry.level]],
                            ['Version', <code key="version">{version.version}</code>],
                            ['Released', <code key="released">{version.released}</code>],
                            ['Engine', <code key="engine">{entry.engine}</code>],
                            ...(entry.stats?.tests !== undefined ? [['Tests', entry.stats.tests] as const] : []),
                            ...(entry.stats?.lines !== undefined ? [['Lines', entry.stats.lines] as const] : []),
                            ['Id', <code key="id">{entry.id}</code>],
                        ]}
                    />
                    <div className={classes.features}>
                        <div className={sheetClasses.eyebrow}>Features</div>
                        <SheetTokens items={entry.features} />
                    </div>
                    {repositoryUrl && (
                        <Anchor
                            href={repositoryUrl(entry, version.ref)}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                            className={classes.github}
                        >
                            <IconBrandGithub size={14} aria-hidden="true" /> View on GitHub
                            <IconExternalLink size={13} aria-hidden="true" />
                        </Anchor>
                    )}
                </Stack>
            </div>

            {related.length > 0 && (
                <SheetSection label="Related examples" count={related.length}>
                    <SheetGrid>
                        {related.map((other) => (
                            <ExamplePanel
                                key={other.id}
                                entry={other}
                                industryTitle={industry?.title ?? other.industry}
                                industryIcon={industry?.icon}
                                status={workspaceStatus(other, workspaceOrigins)}
                                copies={workspaceCopies(other, workspaceOrigins)}
                                onCopyAndOpen={() =>
                                    void client.loadExample(other, other.versions[0].version).then(
                                        (loaded) => onCopy(loaded, true),
                                        (failure: unknown) => setActionError(message(failure)),
                                    )
                                }
                                onOpenCopy={onOpenCopy && (() => onOpenCopy(other.id))}
                                onDetails={() => onShowDetails({id: other.id, version: other.versions[0].version})}
                            />
                        ))}
                    </SheetGrid>
                </SheetSection>
            )}
        </Stack>
    );
}
