import {Alert, Button, Skeleton, Stack, Text} from '@mantine/core';
import {IconArrowRight} from '@tabler/icons-react';
import {SheetPanelButton, SheetSection} from '#ui/sheet';
import {useCallback, type ReactElement} from 'react';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import type {ExampleCoordinates, LibraryClient, LoadedExample} from '../example-library';
import {featuredExamples, useLibraryIndex} from '../example-library/internal';
import {RecentProjects} from '../local-workspace';
import {useWorkspaceProjects} from '../local-workspace/internal';
import {ExampleRow} from './ExampleRow';
import {HeroSearch} from './HeroSearch';
import * as classes from './modelerHome.module.css';
import {HOME_EXAMPLES, suggestionsFor, type Suggestion} from './homeModel';

export interface ModelerHomeProps {
    client: LibraryClient; // the example library
    repository: LocalProjectRepository; // the workspace, for the recent projects and project suggestions
    engineVersion?: string; // version of the loaded engine, for the compatibility warnings
    onSearch: (query: string) => void; // the host shows the Examples page with this query
    onShowDetails: (coordinates: ExampleCoordinates) => void; // the host shows the example details page
    onCopy: (example: LoadedExample, open: boolean) => void; // "Copy and open" on a panel
    onOpenProject: (locator: ProjectLocator) => void; // a recent project or a project suggestion
    onShowAllProjects: () => void; // "Browse other projects": the host shows the Workspace page
    onShowAllExamples: () => void; // "Browse other examples": the host shows the Examples page
}

function SectionSkeleton({label}: {label: string}): ReactElement {
    return <Skeleton height={96} radius="sm" aria-label={`Loading ${label}`} data-testid="home-skeleton" />;
}

/** The Home page: the search box, the featured examples and the recent projects of the workspace. */
export function ModelerHome({
    client,
    repository,
    engineVersion,
    onSearch,
    onShowDetails,
    onCopy,
    onOpenProject,
    onShowAllProjects,
    onShowAllExamples,
}: ModelerHomeProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const {projects} = useWorkspaceProjects(repository);
    const origins = projects?.flatMap((project) => (project.origin ? [project.origin] : []));
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

    return (
        <Stack gap={32} data-testid="modeler-home">
            <HeroSearch
                suggestions={suggestions}
                placeholder={
                    total === undefined ? 'Search examples' : `Search ${total} examples and your projects  ( / )`
                }
                loading={!search && !error}
                onSearch={onSearch}
                onPick={pick}
            />

            {error ? (
                <Alert color="red" title="The example library did not load" role="alert">
                    <Text size="sm">{error}</Text>
                    <Button mt="xs" size="compact-sm" onClick={retry}>
                        Retry
                    </Button>
                </Alert>
            ) : !search ? (
                <SectionSkeleton label="examples" />
            ) : (
                <SheetSection label="Examples">
                    <ExampleRow
                        client={client}
                        engineVersion={engineVersion}
                        workspaceOrigins={origins}
                        onCopy={onCopy}
                        onOpenCopy={openCopy}
                        onShowDetails={onShowDetails}
                        search={search}
                        entries={featuredExamples(search.index).slice(0, HOME_EXAMPLES)}
                        trailing={
                            <SheetPanelButton className={classes.browse} onClick={onShowAllExamples}>
                                <IconArrowRight size={24} aria-hidden="true" />
                                Browse other examples
                            </SheetPanelButton>
                        }
                    />
                </SheetSection>
            )}

            {projects === undefined ? (
                <SectionSkeleton label="projects" />
            ) : (
                projects.length > 0 && (
                    <RecentProjects repository={repository} onOpen={onOpenProject} onShowAll={onShowAllProjects} />
                )
            )}
        </Stack>
    );
}
