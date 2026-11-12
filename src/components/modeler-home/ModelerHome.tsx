import {Alert, Button, Skeleton, Stack, Text} from '@mantine/core';
import {IconChevronRight, IconLibrary, IconPlus} from '@tabler/icons-react';
import {SheetLinkButton, SheetSection, sheetClasses} from '#ui/sheet';
import {cx} from '#ui/cx';
import {useCallback, useState, type ReactElement} from 'react';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import type {ExampleCoordinates, LibraryClient, LoadedExample} from '../example-library';
import {countByIndustry, featuredExamples, IndustryIcon, useLibraryIndex} from '../example-library/internal';
import {RecentProjects} from '../local-workspace';
import {ProjectDialog, useWorkspaceProjects} from '../local-workspace/internal';
import {ExampleRow} from './ExampleRow';
import {HeroSearch} from './HeroSearch';
import * as classes from './modelerHome.module.css';
import {HOME_EXAMPLES, HOME_PROJECTS, suggestionsFor, type Suggestion} from './homeModel';

export interface ModelerHomeProps {
    client: LibraryClient; // the example library
    repository: LocalProjectRepository; // the workspace, for the recent projects and project suggestions
    engineVersion?: string; // version of the loaded engine, for the compatibility warnings and the footer
    onSearch: (query: string) => void; // the host shows the Examples page with this query
    onShowDetails: (coordinates: ExampleCoordinates) => void; // the host shows the example details page
    onCopy: (example: LoadedExample, open: boolean) => void; // "Copy and open" on a panel
    onOpenProject: (locator: ProjectLocator) => void; // a recent project or a project suggestion
    onCreateProject?: (name: string) => void; // "New project": the host adds a blank project and opens it
    onShowAllProjects: () => void; // "All projects": the host shows the Workspace page
    onShowAllExamples: () => void; // "All examples" and "Browse examples": the host shows the Examples page
    onShowIndustry?: (industry: string) => void; // an industry tile: the host shows the Examples page of it
}

function SectionSkeleton({label}: {label: string}): ReactElement {
    return <Skeleton height={140} radius="md" aria-label={`Loading ${label}`} data-testid="home-skeleton" />;
}

/** The Home page: the hero with the search box, the recent projects, the featured examples and the industries. */
export function ModelerHome({
    client,
    repository,
    engineVersion,
    onSearch,
    onShowDetails,
    onCopy,
    onOpenProject,
    onCreateProject,
    onShowAllProjects,
    onShowAllExamples,
    onShowIndustry,
}: ModelerHomeProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    const {projects} = useWorkspaceProjects(repository);
    const [creating, setCreating] = useState(false);
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

    const industries = search?.index.industries ?? [];
    const counts = search ? countByIndustry(search.index) : new Map<string, number>();

    return (
        <Stack gap={0} className={cx(sheetClasses.tokens, classes.home)} data-testid="modeler-home">
            <section className={classes.hero}>
                <div className={sheetClasses.eyebrow}>EdgeRules Modeler</div>
                <h1 className={classes.heroTitle}>
                    Model, test and run
                    <br />
                    business decisions.
                </h1>
                <p className={classes.heroText}>
                    Start from a worked example or a blank project. Everything runs and stays in this browser.
                </p>
                <HeroSearch
                    suggestions={suggestions}
                    placeholder={
                        total === undefined
                            ? 'Search examples'
                            : `Search ${total} ${total === 1 ? 'example' : 'examples'}${
                                  projects
                                      ? ` and ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
                                      : ''
                              }`
                    }
                    loading={!search && !error}
                    onSearch={onSearch}
                    onPick={pick}
                />
                <div className={classes.quick}>
                    {onCreateProject && (
                        <button
                            type="button"
                            className={cx(classes.button, classes.buttonPrimary)}
                            onClick={() => setCreating(true)}
                        >
                            <IconPlus size={16} aria-hidden="true" />
                            New project
                        </button>
                    )}
                    <button type="button" className={classes.button} onClick={onShowAllExamples}>
                        <IconLibrary size={16} aria-hidden="true" />
                        Browse examples
                    </button>
                </div>
            </section>

            <div className={classes.sections}>
                {projects === undefined ? (
                    <SectionSkeleton label="projects" />
                ) : (
                    projects.length > 0 && (
                        <RecentProjects
                            repository={repository}
                            limit={HOME_PROJECTS}
                            library={client}
                            onOpen={onOpenProject}
                            onShowAll={onShowAllProjects}
                        />
                    )
                )}

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
                    <SheetSection
                        label="Examples"
                        count={total}
                        actions={
                            <SheetLinkButton onClick={onShowAllExamples}>
                                All examples <IconChevronRight size={14} aria-hidden="true" />
                            </SheetLinkButton>
                        }
                    >
                        <ExampleRow
                            client={client}
                            engineVersion={engineVersion}
                            workspaceOrigins={origins}
                            onCopy={onCopy}
                            onOpenCopy={openCopy}
                            onShowDetails={onShowDetails}
                            search={search}
                            entries={featuredExamples(search.index).slice(0, HOME_EXAMPLES)}
                        />
                    </SheetSection>
                )}

                {search && industries.length > 0 && onShowIndustry && (
                    <SheetSection label="Industries">
                        <div className={classes.industries} data-testid="industry-tiles">
                            {industries.map((industry) => {
                                const count = counts.get(industry.id) ?? 0;
                                return (
                                    <button
                                        key={industry.id}
                                        type="button"
                                        className={classes.industry}
                                        aria-label={`${industry.title}, ${count} ${count === 1 ? 'example' : 'examples'}`}
                                        onClick={() => onShowIndustry(industry.id)}
                                    >
                                        <span className={classes.industryIcon}>
                                            <IndustryIcon name={industry.icon ?? industry.id} size={17} />
                                        </span>
                                        <span className={classes.industryText}>
                                            <b>{industry.title}</b>
                                            <small>
                                                {count} {count === 1 ? 'example' : 'examples'}
                                            </small>
                                        </span>
                                        <IconChevronRight size={16} aria-hidden="true" />
                                    </button>
                                );
                            })}
                        </div>
                    </SheetSection>
                )}
            </div>

            <footer className={classes.footer}>
                <span>EdgeRules Modeler{engineVersion ? ` · engine ${engineVersion}` : ''}</span>
            </footer>

            {creating && onCreateProject && (
                <ProjectDialog
                    title="New blank project"
                    submitLabel="Create"
                    initialName="Untitled project"
                    onCancel={() => setCreating(false)}
                    onSubmit={(name) => {
                        setCreating(false);
                        onCreateProject(name);
                    }}
                />
            )}
        </Stack>
    );
}
