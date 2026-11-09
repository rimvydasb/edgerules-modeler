import {Alert, Button, Skeleton, Stack, Text, Title} from '@mantine/core';
import {IconSitemap} from '@tabler/icons-react';
import {SheetLinkButton, SheetSection} from '#ui/sheet';
import {useCallback, type ReactElement} from 'react';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {ExampleGallery, IndustryGrid} from '../example-library';
import type {ExampleCoordinates, LibraryClient, LoadedExample} from '../example-library';
import {newestExamples, useLibraryIndex} from '../example-library/internal';
import {RecentProjects} from '../local-workspace';
import {useWorkspaceProjects} from '../local-workspace/internal';
import {ExampleRow} from './ExampleRow';
import {HeroSearch} from './HeroSearch';
import * as classes from './modelerHome.module.css';
import {beginnerExamples, NEW_AND_UPDATED, suggestionsFor, type Suggestion} from './homeModel';

export interface ModelerHomeProps {
    client: LibraryClient; // the example library
    repository: LocalProjectRepository; // the workspace, for "Continue" and project suggestions
    title?: string; // hero title, default "EdgeRules Modeler"
    tagline?: string; // hero tagline
    engineVersion?: string; // version of the loaded engine, for the compatibility warnings
    onSearch: (query: string) => void; // the host shows the Examples page with this query
    onSelectIndustry: (industry: string) => void; // the host shows /examples/<industry>
    onShowDetails: (coordinates: ExampleCoordinates) => void; // the host shows the example details page
    onCopy: (example: LoadedExample, open: boolean) => void; // "Copy and open" on a panel
    onOpenProject: (locator: ProjectLocator) => void; // a recent project or a project suggestion
    onNewProject: () => void; // "New project" and "Blank project"
    onShowAllProjects: () => void; // the host shows the Workspace page
    onShowAllExamples: () => void; // the host shows the Examples page
}

function SectionSkeleton({label}: {label: string}): ReactElement {
    return <Skeleton height={96} radius="sm" aria-label={`Loading ${label}`} data-testid="home-skeleton" />;
}

/** The Home page: hero search, Continue or Get started, industries, featured and new examples. */
export function ModelerHome({
    client,
    repository,
    title = 'EdgeRules Modeler',
    tagline,
    engineVersion,
    onSearch,
    onSelectIndustry,
    onShowDetails,
    onCopy,
    onOpenProject,
    onNewProject,
    onShowAllProjects,
    onShowAllExamples,
}: ModelerHomeProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const {projects} = useWorkspaceProjects(repository);
    const origins = projects?.flatMap((project) => (project.origin ? [project.origin] : []));
    const emptyWorkspace = projects !== undefined && projects.length === 0;
    const total = search?.index.examples.length;

    const suggestions = useCallback((query: string) => suggestionsFor(search, projects, query), [search, projects]);
    const pick = (suggestion: Suggestion) => {
        if (suggestion.kind === 'example') onShowDetails(suggestion.coordinates);
        else onOpenProject(suggestion.project.locator);
    };

    // "Open copy" of an example: the newest saved copy in the workspace.
    const openCopy = (exampleId: string) => {
        const copy = projects
            ?.filter((project) => project.origin?.id === exampleId)
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
        if (copy) onOpenProject(copy.locator);
    };
    const rowProps = {client, engineVersion, workspaceOrigins: origins, onCopy, onOpenCopy: openCopy, onShowDetails};

    return (
        <Stack gap={32} data-testid="modeler-home">
            <header className={classes.hero}>
                <div className={classes.heroTitle}>
                    <span className={classes.heroIcon} aria-hidden="true">
                        <IconSitemap size={26} />
                    </span>
                    <div>
                        <Title order={1} className={classes.heroHeading}>
                            {title}
                        </Title>
                        {tagline && <Text c="dimmed">{tagline}</Text>}
                    </div>
                </div>
                <HeroSearch
                    suggestions={suggestions}
                    placeholder={
                        total === undefined ? 'Search examples' : `Search ${total} examples and your projects  ( / )`
                    }
                    loading={!search && !error}
                    onSearch={onSearch}
                    onPick={pick}
                />
            </header>

            {emptyWorkspace ? (
                <SheetSection
                    label="Get started"
                    data-testid="home-get-started"
                    actions={<SheetLinkButton onClick={onNewProject}>Blank project</SheetLinkButton>}
                >
                    {search && <ExampleRow {...rowProps} search={search} entries={beginnerExamples(search)} />}
                    {!search && !error && <SectionSkeleton label="examples" />}
                </SheetSection>
            ) : projects === undefined ? (
                <SectionSkeleton label="projects" />
            ) : (
                <RecentProjects
                    repository={repository}
                    onOpen={onOpenProject}
                    onNewProject={onNewProject}
                    onShowAll={onShowAllProjects}
                />
            )}

            {error ? (
                <Alert color="red" title="The example library did not load" role="alert">
                    <Text size="sm">{error}</Text>
                    <Button mt="xs" size="compact-sm" onClick={retry}>
                        Retry
                    </Button>
                </Alert>
            ) : !search ? (
                <>
                    <SectionSkeleton label="industries" />
                    <SectionSkeleton label="featured examples" />
                </>
            ) : (
                <>
                    <SheetSection label="Industries" count={search.index.industries.length}>
                        <IndustryGrid client={client} onSelectIndustry={onSelectIndustry} />
                    </SheetSection>
                    <SheetSection
                        label="Featured examples"
                        actions={<SheetLinkButton onClick={onShowAllExamples}>See all examples →</SheetLinkButton>}
                    >
                        <ExampleGallery
                            client={client}
                            featured
                            engineVersion={engineVersion}
                            workspaceOrigins={origins}
                            onCopy={onCopy}
                            onOpenCopy={openCopy}
                            onShowDetails={onShowDetails}
                        />
                    </SheetSection>
                    <SheetSection label="New and updated">
                        <ExampleRow
                            {...rowProps}
                            search={search}
                            entries={newestExamples(search.index, NEW_AND_UPDATED)}
                        />
                    </SheetSection>
                </>
            )}
        </Stack>
    );
}
