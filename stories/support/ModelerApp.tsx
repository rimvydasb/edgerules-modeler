import '@xyflow/react/dist/style.css';
import {useCallback, useEffect, useMemo, useState, type ReactElement} from 'react';
import {Anchor, Group, Loader, Text} from '@mantine/core';
import {init, MutableDecisionService} from '@edgerules/web/mutable';
import {
    ExampleDetails,
    ExampleGallery,
    type ExampleCoordinates,
    type LoadedExample,
} from '../../src/components/example-library';
import {LocalWorkspace} from '../../src/components/local-workspace';
import {addWorkspaceProject} from '../../src/components/local-workspace';
import {ModelerHome} from '../../src/components/modeler-home';
import {
    createProjectSessionManager,
    ProjectProvider,
    type ProjectDescriptor,
    type ProjectLocator,
    type ProjectOrigin,
    type ProjectSession,
} from '../../src/components/project-session';
import {Shell} from '../../src/components/shell';
import {createExamplesClient, EXAMPLES_REPOSITORY_URL} from './examplesSource';
import type {openStoryWorkspace} from './workspaceStory';

export type ModelerRoute =
    | {page: 'home'}
    | {page: 'examples'; industry?: string; query?: string}
    | {page: 'details'; example: ExampleCoordinates}
    | {page: 'workspace'}
    | {page: 'project'; locator: ProjectLocator};

export type StoryWorkspace = Awaited<ReturnType<typeof openStoryWorkspace>>;

const client = createExamplesClient();
const PAGES = [
    {page: 'home', label: 'Home'},
    {page: 'examples', label: 'Examples'},
    {page: 'workspace', label: 'Workspace'},
] as const;

/** The route as a path, the way the host Modeler shows it. */
export function routePath(route: ModelerRoute): string {
    switch (route.page) {
        case 'home':
            return '/';
        case 'examples':
            return route.industry ? `/examples/${route.industry}` : '/examples';
        case 'details':
            return `/examples/${route.example.id}@${route.example.version}`;
        case 'workspace':
            return '/workspace';
        case 'project':
            return `/project/${route.locator.projectPath}`;
    }
}

function ProjectPage({
    locator,
    manager,
    projects,
    origins,
    go,
}: {
    locator: ProjectLocator;
    manager: ReturnType<typeof createProjectSessionManager>;
    projects: ProjectDescriptor[];
    origins: Map<string, boolean>;
    go: (route: ModelerRoute) => void;
}): ReactElement {
    const [session, setSession] = useState<ProjectSession>();
    useEffect(() => {
        let opened: ProjectSession | undefined;
        let cancelled = false;
        void manager.open(locator).then((next) => {
            opened = next;
            if (!cancelled) setSession(next);
        });
        return () => {
            cancelled = true;
            setSession(undefined);
            if (opened) void manager.close(opened.getSnapshot().projectId);
        };
    }, [manager, locator]);

    if (!session) return <Loader size="sm" aria-label="Opening project" />;
    const {origin} = session.getSnapshot();
    return (
        <ProjectProvider session={session}>
            <div style={{height: 'calc(100vh - 56px)'}}>
                <Shell
                    languageService={MutableDecisionService}
                    navigation={{
                        onShowWorkspace: () => go({page: 'workspace'}),
                        onBrowseExamples: () => go({page: 'examples'}),
                        onOpenProject: (next) => go({page: 'project', locator: next}),
                        onShowOrigin: (target) =>
                            go({page: 'details', example: {id: target.id, version: target.version}}),
                        recentProjects: projects,
                        originStatus: origin ? (origins.get(origin.id) ? 'latest' : 'update-available') : undefined,
                    }}
                />
            </div>
        </ProjectProvider>
    );
}

/**
 * The hosted Modeler as `edgerules-modeler` composes it: a top navigation bar and one page component per route. The
 * route lives in React state, not in a router; the page components only report navigation through callbacks.
 */
export function ModelerApp({
    repository,
    factory,
    initialRoute = {page: 'home'},
}: StoryWorkspace & {initialRoute?: ModelerRoute}): ReactElement {
    const [route, setRoute] = useState<ModelerRoute>(initialRoute);
    const [projects, setProjects] = useState<ProjectDescriptor[]>([]);
    const [newest, setNewest] = useState<Map<string, boolean>>(new Map());
    const manager = useMemo(
        () => createProjectSessionManager({engine: MutableDecisionService, repository}),
        [repository],
    );

    const refresh = useCallback(async () => {
        await init();
        const listed = await repository.list();
        setProjects([...listed].sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    }, [repository]);
    useEffect(() => {
        void refresh();
    }, [refresh, route]);

    // `true` when the workspace holds the newest version of an example.
    useEffect(() => {
        void client.loadIndex().then((index) => {
            const latest = new Map<string, boolean>();
            for (const project of projects) {
                const origin = project.origin;
                const entry = origin && index.examples.find((candidate) => candidate.id === origin.id);
                if (origin && entry)
                    latest.set(
                        origin.id,
                        entry.versions[0].version === origin.version || latest.get(origin.id) === true,
                    );
            }
            setNewest(latest);
        });
    }, [projects]);

    const origins = useMemo<ProjectOrigin[]>(
        () => projects.flatMap((project) => (project.origin ? [project.origin] : [])),
        [projects],
    );

    const copy = async (example: LoadedExample, open: boolean) => {
        const added = await addWorkspaceProject({repository, factory}, example.project);
        setRoute(open ? {page: 'project', locator: added.locator} : route);
        await refresh();
    };
    const details = (example: ExampleCoordinates) => setRoute({page: 'details', example});
    const open = (locator: ProjectLocator) => setRoute({page: 'project', locator});

    return (
        <div data-testid="modeler-app">
            <Group h={56} px="md" gap="lg" style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}>
                <Text fw={700}>EdgeRules</Text>
                {PAGES.map(({page, label}) => (
                    <Anchor
                        key={page}
                        component="button"
                        type="button"
                        fw={route.page === page ? 700 : 400}
                        onClick={() => setRoute({page})}
                    >
                        {label}
                    </Anchor>
                ))}
                <Text size="xs" c="dimmed" ml="auto" data-testid="modeler-route">
                    {routePath(route)}
                </Text>
            </Group>
            <div style={{padding: route.page === 'project' ? 0 : 16}}>
                {route.page === 'home' && (
                    <ModelerHome
                        client={client}
                        repository={repository}
                        tagline="Decision models in the browser"
                        onSearch={(query) => setRoute({page: 'examples', query})}
                        onSelectIndustry={(industry) => setRoute({page: 'examples', industry})}
                        onShowDetails={details}
                        onCopy={(example, openIt) => void copy(example, openIt)}
                        onOpenProject={open}
                        onNewProject={() => setRoute({page: 'workspace'})}
                        onShowAllProjects={() => setRoute({page: 'workspace'})}
                        onShowAllExamples={() => setRoute({page: 'examples'})}
                    />
                )}
                {route.page === 'examples' && (
                    <ExampleGallery
                        client={client}
                        industry={route.industry}
                        query={route.query}
                        onIndustryChange={(industry) => setRoute({...route, industry})}
                        onQueryChange={(query) => setRoute({...route, query})}
                        workspaceOrigins={origins}
                        onCopy={(example, openIt) => void copy(example, openIt)}
                        onShowDetails={details}
                    />
                )}
                {route.page === 'details' && (
                    <ExampleDetails
                        client={client}
                        example={route.example}
                        onVersionChange={details}
                        workspaceOrigins={origins}
                        onCopy={(example, openIt) => void copy(example, openIt)}
                        onShowDetails={details}
                        shareUrl={(example) => `https://modeler.example/examples/${example.id}@${example.version}`}
                        repositoryUrl={(entry, ref) => EXAMPLES_REPOSITORY_URL(entry.path, ref)}
                    />
                )}
                {route.page === 'workspace' && (
                    <LocalWorkspace
                        repository={repository}
                        factory={factory}
                        library={client}
                        onOpen={open}
                        onBrowseExamples={() => setRoute({page: 'examples'})}
                    />
                )}
                {route.page === 'project' && (
                    <ProjectPage
                        locator={route.locator}
                        manager={manager}
                        projects={projects}
                        origins={newest}
                        go={setRoute}
                    />
                )}
            </div>
        </div>
    );
}
