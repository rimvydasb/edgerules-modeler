import {Alert, Anchor, Button, Group, Skeleton, Stack, Text, Title} from '@mantine/core';
import {useCallback, type ReactElement} from 'react';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {ExampleGallery, IndustryGrid} from '../example-library';
import type {ExampleCoordinates, LibraryClient, LoadedExample} from '../example-library';
import {newestExamples, useLibraryIndex} from '../example-library/internal';
import {RecentProjects} from '../local-workspace';
import {useWorkspaceProjects} from '../local-workspace/internal';
import {ExampleRow} from './ExampleRow';
import {HeroSearch} from './HeroSearch';
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
    return <Skeleton height={120} radius="md" aria-label={`Loading ${label}`} data-testid="home-skeleton" />;
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

    return (
        <Stack gap="xl" data-testid="modeler-home">
            <Stack align="center" gap="xs" py="lg">
                <Title order={1}>{title}</Title>
                {tagline && <Text c="dimmed">{tagline}</Text>}
                <HeroSearch
                    suggestions={suggestions}
                    placeholder={
                        total === undefined ? 'Search examples' : `Search ${total} examples: loan, scorecard ...`
                    }
                    loading={!search && !error}
                    onSearch={onSearch}
                    onPick={pick}
                />
            </Stack>

            {emptyWorkspace ? (
                <section aria-label="Get started" data-testid="home-get-started">
                    <Group justify="space-between" mb="xs">
                        <Text fw={600}>Get started</Text>
                        <Button size="compact-sm" variant="light" onClick={onNewProject}>
                            Blank project
                        </Button>
                    </Group>
                    {search && (
                        <ExampleRow
                            client={client}
                            search={search}
                            entries={beginnerExamples(search)}
                            engineVersion={engineVersion}
                            workspaceOrigins={origins}
                            onCopy={onCopy}
                            onShowDetails={onShowDetails}
                        />
                    )}
                    {!search && !error && <SectionSkeleton label="examples" />}
                </section>
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
                    <section aria-label="Industries">
                        <Text fw={600} mb="xs">
                            Industries
                        </Text>
                        <IndustryGrid client={client} onSelectIndustry={onSelectIndustry} />
                    </section>
                    <section aria-label="Featured examples">
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Featured examples</Text>
                            <Anchor component="button" type="button" size="sm" onClick={onShowAllExamples}>
                                See all examples →
                            </Anchor>
                        </Group>
                        <ExampleGallery
                            client={client}
                            featured
                            engineVersion={engineVersion}
                            workspaceOrigins={origins}
                            onCopy={onCopy}
                            onShowDetails={onShowDetails}
                        />
                    </section>
                    <section aria-label="New and updated">
                        <Text fw={600} mb="xs">
                            New and updated
                        </Text>
                        <ExampleRow
                            client={client}
                            search={search}
                            entries={newestExamples(search.index, NEW_AND_UPDATED)}
                            engineVersion={engineVersion}
                            workspaceOrigins={origins}
                            onCopy={onCopy}
                            onShowDetails={onShowDetails}
                        />
                    </section>
                </>
            )}
        </Stack>
    );
}
