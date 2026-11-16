import '@xyflow/react/dist/style.css';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type ReactElement,
    type ReactNode,
} from 'react';
import {Alert, Button, Modal, Text} from '@mantine/core';
import {IconDatabase, IconHome, IconLibrary, IconMoon, IconX} from '@tabler/icons-react';
import {MutableDecisionService} from '@edgerules/web/mutable';
import {
    ExampleDetails,
    ExampleGallery,
    type ExampleCoordinates,
    type LibraryIndex,
    type LoadedExample,
} from '../../../src/components/example-library';
import {addWorkspaceProject, LocalWorkspace} from '../../../src/components/local-workspace';
import {ModelerHome} from '../../../src/components/modeler-home';
import {SheetProjectMark, sheetClasses} from '../../../src/ui/sheet';
import {registerHighsSolver} from '../highsSolver';
import {
    createProjectSessionManager,
    isProjectError,
    ProjectProvider,
    type LocalProjectRepository,
    type ProjectDescriptor,
    type ProjectFactory,
    type ProjectLocator,
    type ProjectOrigin,
    type ProjectSession,
} from '../../../src/components/project-session';
import {Shell, type ShellView} from '../../../src/components/shell';
import {getModelContext, registerProjectTools, type ProjectToolsHandle} from '../../../src/components/webmcp';
import {useAgentToolsEnabled, WebMcpToggle} from './WebMcpToggle';
import {createExamplesClient, EXAMPLES_REPOSITORY_URL} from '../examplesSource';
import {defaultView, routePath, sectionOf, type ModelerRoute, type ProjectRoute} from './routes';
import {cx} from '../../../src/ui/cx';
import * as classes from './modelerHost.module.css';

const client = createExamplesClient();

export interface ModelerWorkspace {
    repository: LocalProjectRepository;
    factory: ProjectFactory;
}

/** How the host moves between pages: a router in the app, React state in Storybook. */
export interface ModelerNavigator {
    navigate: (route: ModelerRoute, options?: {replace?: boolean}) => void;
    // The URL of a route for real links (middle click, copy link); without it the top bar has buttons.
    href?: (route: ModelerRoute) => string;
    shareUrl?: (route: ModelerRoute) => string; // the absolute URL that "Share link" copies
}

type SessionManager = ReturnType<typeof createProjectSessionManager>;

/** A project tab of the top bar: the last route of the project, so the tab leads back to the same element. */
interface ProjectTab {
    route: ProjectRoute;
    name: string;
}

interface ModelerContextValue extends ModelerWorkspace, ModelerNavigator {
    manager: SessionManager;
    projects: ProjectDescriptor[];
    origins: ProjectOrigin[];
    index: LibraryIndex | undefined;
    copy: (example: LoadedExample, open: boolean) => Promise<void>;
    openCopy: (exampleId: string) => void;
    tabs: ProjectTab[]; // the projects that were opened, as shortcuts in the top bar
    closeTab: (projectPath: string) => void;
    showDetails: (example: ExampleCoordinates) => void;
}

const ModelerContext = createContext<ModelerContextValue | undefined>(undefined);

function useModeler(): ModelerContextValue {
    const value = useContext(ModelerContext);
    if (!value) throw new Error('Render the Modeler pages inside a ModelerProvider');
    return value;
}

/**
 * The state that the pages share: the workspace projects (reloaded on every route change), the library index and the
 * navigation. The pages are thin compositions of the package components over this state.
 */
export function ModelerProvider({
    repository,
    factory,
    navigate,
    href,
    shareUrl,
    route,
    children,
}: ModelerWorkspace & ModelerNavigator & {route: ModelerRoute; children: ReactNode}): ReactElement {
    const [projects, setProjects] = useState<ProjectDescriptor[]>();
    const [index, setIndex] = useState<LibraryIndex>();
    const [opened, setOpened] = useState<ProjectRoute[]>([]);
    const manager = useMemo(
        () => createProjectSessionManager({engine: MutableDecisionService, repository}),
        [repository],
    );

    const refresh = useCallback(async () => {
        const listed = await repository.list();
        setProjects([...listed].sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    }, [repository]);
    // The project list changes on other pages (a copy, a rename, a save): reload it on every page change.
    const page = route.page === 'project' ? `project:${route.projectPath}` : route.page;
    useEffect(() => {
        void refresh();
    }, [refresh, page]);
    // A project that was opened keeps its tab, with the last route in it, until the user closes the tab.
    useEffect(() => {
        if (route.page !== 'project') return;
        setOpened((tabs) => {
            const known = tabs.find((tab) => tab.projectPath === route.projectPath);
            if (!known) return [...tabs, route];
            return routePath(known) === routePath(route) ? tabs : tabs.map((tab) => (tab === known ? route : tab));
        });
    }, [route]);
    useEffect(() => {
        client.loadIndex().then(setIndex, () => undefined); // the pages show the index failure themselves
    }, []);

    // The pages edit the workspace (a rename, a duplicate, a delete on the Workspace page): the project list, and with it
    // the names of the project tabs, follows every change. The sessions of the Shell save through `repository` itself,
    // so an autosave does not list the workspace again.
    const workspace = useMemo<LocalProjectRepository>(() => {
        const after =
            <A extends unknown[], R>(write: (...args: A) => Promise<R>) =>
            async (...args: A): Promise<R> => {
                const result = await write(...args);
                await refresh();
                return result;
            };
        return {
            resource: repository.resource,
            locatorFor: (projectPath) => repository.locatorFor(projectPath),
            list: () => repository.list(),
            findByName: (name) => repository.findByName(name),
            load: (locator, revision) => repository.load(locator, revision),
            create: after((target, bundle) => repository.create(target, bundle)),
            save: after((locator, bundle, expected) => repository.save(locator, bundle, expected)),
            remove: after((locator) => repository.remove(locator)),
        };
    }, [repository, refresh]);

    const value = useMemo<ModelerContextValue>(() => {
        const listed = projects ?? [];
        const origins = listed.flatMap((project) => (project.origin ? [project.origin] : []));
        const names = new Map(listed.map((project) => [project.locator.projectPath, project.name]));
        // A tab of a project that is no longer in the workspace (deleted on the Workspace page) goes away. The tab of
        // the shown project stays, so a link to a missing project still shows where the user is.
        const shown = route.page === 'project' ? route.projectPath : undefined;
        const tabs = projects
            ? opened.filter((tab) => names.has(tab.projectPath) || tab.projectPath === shown)
            : opened;
        return {
            tabs: tabs.map((tab) => ({route: tab, name: names.get(tab.projectPath) ?? tab.projectPath})),
            closeTab: (projectPath) => {
                setOpened((tabs) => tabs.filter((tab) => tab.projectPath !== projectPath));
                if (route.page === 'project' && route.projectPath === projectPath) navigate({page: 'workspace'});
            },
            repository: workspace,
            factory,
            navigate,
            href,
            shareUrl,
            manager,
            projects: listed,
            origins,
            index,
            copy: async (example, open) => {
                const added = await addWorkspaceProject({repository: workspace, factory}, example.project);
                if (open) navigate({page: 'project', projectPath: added.locator.projectPath});
            },
            openCopy: (exampleId) => {
                const newest = listed.find((project) => project.origin?.id === exampleId);
                if (newest) navigate({page: 'project', projectPath: newest.locator.projectPath});
            },
            showDetails: (example) =>
                navigate({
                    page: 'details',
                    example,
                    industry: index?.examples.find((entry) => entry.id === example.id)?.industry,
                }),
        };
    }, [workspace, factory, navigate, href, shareUrl, manager, projects, opened, route, index, refresh]);

    return <ModelerContext.Provider value={value}>{children}</ModelerContext.Provider>;
}

const SECTIONS = [
    {section: 'home', label: 'Home', icon: IconHome, route: {page: 'home'}},
    {section: 'examples', label: 'Examples', icon: IconLibrary, route: {page: 'examples'}},
    {section: 'workspace', label: 'Workspace', icon: IconDatabase, route: {page: 'workspace'}},
] as const satisfies readonly {section: string; label: string; icon: unknown; route: ModelerRoute}[];

/** A plain click navigates in the page; a modified click (new tab, new window) keeps the browser default. */
function plainClick(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** A top bar link: a real link with a URL when the host has one, otherwise a button. */
function NavItem({
    route,
    className,
    current,
    children,
}: {
    route: ModelerRoute;
    className: string;
    current?: boolean;
    children: ReactNode;
}): ReactElement {
    const {navigate, href} = useModeler();
    if (!href)
        return (
            <button
                type="button"
                className={className}
                aria-current={current ? 'page' : undefined}
                onClick={() => navigate(route)}
            >
                {children}
            </button>
        );
    return (
        <a
            href={href(route)}
            className={className}
            aria-current={current ? 'page' : undefined}
            onClick={(event) => {
                if (!plainClick(event)) return;
                event.preventDefault();
                navigate(route);
            }}
        >
            {children}
        </a>
    );
}

const TITLES: Record<ModelerRoute['page'], string> = {
    home: 'Home',
    examples: 'Examples',
    details: 'Example',
    workspace: 'Workspace',
    project: 'Project',
};

/** The EdgeRules mark: three diamonds under a hanging star, in the current text color. */
function Mark({size = 22}: {size?: number}): ReactElement {
    return (
        <svg viewBox="0 0 500 500" width={size} height={size} aria-hidden="true" className={classes.mark}>
            <g fill="currentColor">
                <path d="M248 128 L330 210 L248 292 L166 210 Z" />
                <path d="M157 216 L239 298 L157 380 L75 298 Z" />
                <path d="M343 216 L425 298 L343 380 L261 298 Z" />
            </g>
            <g fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="square">
                <path d="M248 48 V116 M214 82 H282 M224 58 L272 106 M272 58 L224 106" />
                <path d="M157 392 V442 M141 432 H173" />
                <path d="M248 312 V372 M232 366 H264" />
                <path d="M343 392 V442 M327 432 H359" />
            </g>
        </svg>
    );
}

/**
 * The frame of every page: one top bar that says where you can go, never where you are (the Home, Examples and
 * Workspace links and one tab per opened project), and the page below it. A project fills the window under the bar;
 * the other pages sit in a centered column.
 */
export function ModelerFrame({route, children}: {route: ModelerRoute; children: ReactNode}): ReactElement {
    const {href, tabs, closeTab} = useModeler();
    const active = sectionOf(route);
    const [themeNotice, setThemeNotice] = useState(false);
    useEffect(() => {
        if (route.page !== 'project') document.title = `${TITLES[route.page]} · EdgeRules Modeler`;
    }, [route.page]);

    return (
        <div className={cx(classes.app, sheetClasses.tokens)} data-testid="modeler-app">
            <header className={classes.bar}>
                <NavItem route={{page: 'home'}} className={classes.brand}>
                    <span className={classes.brandIcon} aria-hidden="true">
                        <Mark />
                    </span>
                    <span className={classes.brandName}>EdgeRules</span>
                    <span className={classes.srOnly}> Modeler</span>
                </NavItem>
                <nav aria-label="Modeler" className={classes.nav}>
                    {SECTIONS.map(({section, label, icon: Icon, route: target}) => (
                        <NavItem
                            key={section}
                            route={target}
                            className={classes.navItem}
                            current={active === section || (section === 'home' && route.page === 'home')}
                        >
                            <Icon size={15} aria-hidden="true" />
                            <span className={classes.navLabel}>{label}</span>
                        </NavItem>
                    ))}
                    {tabs.length > 0 && <span className={classes.separator} aria-hidden="true" />}
                    {tabs.map(({route: target, name}) => {
                        const current = route.page === 'project' && route.projectPath === target.projectPath;
                        return (
                            <div key={target.projectPath} className={classes.tab} data-active={current || undefined}>
                                <NavItem route={target} className={classes.tabLink} current={current}>
                                    <SheetProjectMark name={name} size="xs" />
                                    <span className={classes.tabName}>{name}</span>
                                </NavItem>
                                <button
                                    type="button"
                                    className={classes.tabClose}
                                    aria-label={`Close ${name}`}
                                    title={`Close ${name}`}
                                    onClick={() => closeTab(target.projectPath)}
                                >
                                    <IconX size={13} aria-hidden="true" />
                                </button>
                            </div>
                        );
                    })}
                </nav>
                <span className={classes.spacer} />
                {/* The route of the in-memory host; the app shows it in the address bar instead. */}
                {!href && (
                    <span className={classes.route} data-testid="modeler-route">
                        {routePath(route)}
                    </span>
                )}
                <WebMcpToggle />
                <button
                    type="button"
                    className={classes.iconButton}
                    title="Theme"
                    aria-label="Switch to the night theme"
                    onClick={() => setThemeNotice(true)}
                >
                    <IconMoon size={16} aria-hidden="true" />
                </button>
            </header>
            <Modal opened={themeNotice} onClose={() => setThemeNotice(false)} title="Night theme" size="sm" centered>
                <Text size="sm">The night theme is not implemented yet. The Modeler has the light theme only.</Text>
                <Button mt="md" size="compact-md" color="dark" onClick={() => setThemeNotice(false)}>
                    OK
                </Button>
            </Modal>
            <main
                className={
                    route.page === 'project'
                        ? classes.projectMain
                        : route.page === 'home'
                          ? classes.mainWide
                          : classes.main
                }
            >
                {children}
            </main>
        </div>
    );
}

export function HomePage(): ReactElement {
    const {repository, factory, navigate, copy, showDetails} = useModeler();
    const createBlank = async (name: string) => {
        const added = await addWorkspaceProject({repository, factory}, {name, model: {dsl: '{}'}});
        navigate({page: 'project', projectPath: added.locator.projectPath});
    };
    return (
        <ModelerHome
            client={client}
            repository={repository}
            onSearch={(query) => navigate({page: 'examples', query})}
            onShowDetails={showDetails}
            onCopy={(example, open) => void copy(example, open)}
            onOpenProject={(locator) => navigate({page: 'project', projectPath: locator.projectPath})}
            onCreateProject={(name) => void createBlank(name)}
            onShowAllProjects={() => navigate({page: 'workspace'})}
            onShowAllExamples={() => navigate({page: 'examples'})}
            onShowIndustry={(industry) => navigate({page: 'examples', industry})}
        />
    );
}

export function ExamplesPage({industry, query}: {industry?: string; query?: string}): ReactElement {
    const {navigate, origins, copy, openCopy, showDetails} = useModeler();
    return (
        <ExampleGallery
            client={client}
            industry={industry}
            query={query}
            onIndustryChange={(next) => navigate({page: 'examples', industry: next, query})}
            // Every keystroke updates the URL, but only the industry tabs add history entries.
            onQueryChange={(next) => navigate({page: 'examples', industry, query: next || undefined}, {replace: true})}
            workspaceOrigins={origins}
            onCopy={(example, open) => void copy(example, open)}
            onOpenCopy={openCopy}
            onShowDetails={showDetails}
        />
    );
}

export function DetailsPage({example, industry}: {example: ExampleCoordinates; industry?: string}): ReactElement {
    const {navigate, origins, copy, openCopy, showDetails, shareUrl, index} = useModeler();
    const known = industry ?? index?.examples.find((entry) => entry.id === example.id)?.industry;
    return (
        <ExampleDetails
            client={client}
            example={example}
            onVersionChange={(next) => navigate({page: 'details', example: next, industry: known}, {replace: true})}
            workspaceOrigins={origins}
            onCopy={(loaded, open) => void copy(loaded, open)}
            onOpenCopy={openCopy}
            onShowDetails={showDetails}
            onShowIndustry={(next) => navigate({page: 'examples', industry: next})}
            shareUrl={shareUrl && ((target) => shareUrl({page: 'details', example: target, industry: known}))}
            repositoryUrl={(entry, ref) => EXAMPLES_REPOSITORY_URL(entry.path, ref)}
        />
    );
}

export function WorkspacePage(): ReactElement {
    const {repository, factory, navigate} = useModeler();
    return (
        <LocalWorkspace
            repository={repository}
            factory={factory}
            library={client}
            onOpen={(locator) => navigate({page: 'project', projectPath: locator.projectPath})}
            onBrowseExamples={() => navigate({page: 'examples'})}
        />
    );
}

// The session manager keeps one session per project and closes it on the first `close`. A page that opens a project
// twice (React StrictMode runs an effect twice; Back and Forward between two elements of one project) must not close
// the session that the other opening still shows: count the openings and close after the last one, a task later.
const openings = new WeakMap<ProjectSession, number>();

function retain(_manager: SessionManager, session: ProjectSession): void {
    openings.set(session, (openings.get(session) ?? 0) + 1);
}

function release(manager: SessionManager, session: ProjectSession): void {
    openings.set(session, (openings.get(session) ?? 1) - 1);
    setTimeout(() => {
        if ((openings.get(session) ?? 0) <= 0) void manager.close(session.getSnapshot().projectId);
    }, 0);
}

// The workspace is the store of the projects: every change is saved, a moment after the last one, so a reload or a
// closed tab never loses work. The changes of a page that is hidden or closed are saved at once.
const AUTOSAVE_DELAY_MS = 400;

function useAutosave(session: ProjectSession | undefined): void {
    useEffect(() => {
        if (!session) return undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // An invalid DSL draft blocks a save, and a save in flight is followed by the next one when it ends.
        const unsaved = () => {
            const snapshot = session.getSnapshot();
            return (
                snapshot.phase === 'ready' && snapshot.dirtySlices.length > 0 && snapshot.dslValidity.status === 'valid'
            );
        };
        const flush = () => {
            clearTimeout(timer);
            timer = undefined;
            if (!unsaved()) return;
            // A conflict (another tab saved first) shows in the session phase; it is never overwritten silently.
            session.save().catch((failure: unknown) => {
                if (!isProjectError(failure, 'conflict')) console.error('The project was not saved', failure);
            });
        };
        const schedule = () => {
            if (!unsaved()) return;
            clearTimeout(timer);
            timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
        };
        const hidden = () => document.visibilityState === 'hidden' && flush();
        const unsubscribe = session.subscribe(schedule);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', hidden);
        schedule();
        return () => {
            unsubscribe();
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', hidden);
            flush();
        };
    }, [session]);
}

// A path or view change that follows a user input within this time adds a history entry; a change without one (the
// Shell falls back from a removed or invalid path) replaces the entry, so Back never returns to a dead URL.
const USER_INPUT_WINDOW_MS = 1500;

/**
 * The Shell of one workspace project. The URL holds the root path and the view, so a link opens the same element and
 * Back and Forward move through the elements the user visited.
 */
export function ProjectPage({
    projectPath,
    path,
    view,
}: {
    projectPath: string;
    path?: string;
    view?: ShellView;
}): ReactElement {
    const {manager, repository, projects, index, navigate} = useModeler();
    const [opened, setOpened] = useState<{session?: ProjectSession; error?: string}>({});
    const locator = useMemo<ProjectLocator>(() => repository.locatorFor(projectPath), [repository, projectPath]);

    useEffect(() => {
        let session: ProjectSession | undefined;
        let cancelled = false;
        manager.open(locator).then(
            async (next) => {
                session = next;
                retain(manager, next);
                // EdgeRules ships no solver: a project with an `optimise` element runs only after the host registers one.
                if (next.engine.requiresSolver() && next.engine.solverHandler === undefined) {
                    // A failed load leaves the project open: the Tests view then shows the missing-solver banner.
                    await registerHighsSolver(next.engine).catch((failure: unknown) => console.error(failure));
                }
                if (cancelled) release(manager, next);
                else setOpened({session: next});
            },
            (failure: unknown) =>
                !cancelled && setOpened({error: failure instanceof Error ? failure.message : String(failure)}),
        );
        return () => {
            cancelled = true;
            setOpened({});
            if (session) release(manager, session);
        };
    }, [manager, locator]);

    useAutosave(opened.session);

    // The Shell reports a path and a view change of one click separately: merge them into one navigation.
    const current = useRef({path, view});
    current.current = {path, view};
    const pending = useRef<{path?: string; view?: ShellView} | undefined>(undefined);
    // No input yet: a change right after the page loads (a typed link to a removed path) is not the user's and must not
    // add a history entry. `performance.now()` starts at 0 on every page load, so 0 would read as a fresh input.
    const lastInput = useRef(Number.NEGATIVE_INFINITY);
    const change = (next: {path?: string; view?: ShellView}) => {
        const first = pending.current === undefined;
        pending.current = {...pending.current, ...next};
        if (!first) return;
        queueMicrotask(() => {
            const merged = {...current.current, ...pending.current};
            pending.current = undefined;
            navigate(
                {
                    page: 'project',
                    projectPath,
                    path: merged.path === '*' ? undefined : merged.path,
                    view: merged.view === defaultView(merged.path) ? undefined : merged.view,
                },
                {replace: performance.now() - lastInput.current > USER_INPUT_WINDOW_MS},
            );
        });
    };

    // The WebMCP tools of the open project, when the browser has `document.modelContext`. `open-in-editor` navigates
    // as a Project Explorer click does: a new history entry.
    const [tools, setTools] = useState<ProjectToolsHandle>();
    const agentTools = useAgentToolsEnabled();
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    useEffect(() => {
        const session = opened.session;
        if (!session || !agentTools) return undefined;
        const handle = registerProjectTools({
            modelContext: getModelContext(),
            session,
            navigation: {
                getFocus: () => {
                    const focused = current.current.path ?? '*';
                    return {path: focused, view: current.current.view ?? defaultView(focused)};
                },
                open: (next, nextView) =>
                    navigateRef.current({
                        page: 'project',
                        projectPath,
                        path: next === '*' ? undefined : next,
                        view: nextView === defaultView(next) ? undefined : nextView,
                    }),
            },
        });
        setTools(handle);
        return () => {
            handle.dispose();
            setTools(undefined);
        };
    }, [opened.session, projectPath, agentTools]);

    // `/project/<path>` without a view is the project home: show it as `?view=flow`.
    useEffect(() => {
        if (!view && (!path || path === '*')) navigate({page: 'project', projectPath}, {replace: true});
    }, [view, path, projectPath, navigate]);

    const name = opened.session?.getSnapshot().name;
    useEffect(() => {
        if (name) document.title = `${name} · EdgeRules Modeler`;
    }, [name]);

    if (opened.error)
        return (
            <div className={classes.main}>
                <Alert color="red" title="The project did not open" role="alert">
                    {projectPath}: {opened.error}
                    <div>
                        <Button mt="sm" size="compact-sm" onClick={() => navigate({page: 'workspace'})}>
                            Go to the Workspace
                        </Button>
                    </div>
                </Alert>
            </div>
        );
    if (!opened.session)
        return (
            // easter egg: while the project opens the mark sways
            <div className={classes.loading} role="status" aria-label="Opening project">
                <Mark size={52} />
                <span>Opening project…</span>
            </div>
        );

    const {origin} = opened.session.getSnapshot();
    const newest = origin && index?.examples.find((entry) => entry.id === origin.id)?.versions[0]?.version;
    return (
        <ProjectProvider session={opened.session}>
            <div
                className={classes.project}
                onPointerDownCapture={() => (lastInput.current = performance.now())}
                onKeyDownCapture={() => (lastInput.current = performance.now())}
            >
                <Shell
                    languageService={MutableDecisionService}
                    path={path ?? '*'}
                    onPathChange={(next) => change({path: next})}
                    view={view ?? defaultView(path)}
                    onViewChange={(next) => change({view: next})}
                    agentActivity={tools?.activity}
                    navigation={{
                        onBrowseExamples: () => navigate({page: 'examples'}),
                        onOpenProject: (next) => navigate({page: 'project', projectPath: next.projectPath}),
                        onShowOrigin: (target) =>
                            navigate({
                                page: 'details',
                                example: {id: target.id, version: target.version},
                                industry: index?.examples.find((entry) => entry.id === target.id)?.industry,
                            }),
                        recentProjects: projects,
                        originStatus: newest ? (newest === origin.version ? 'latest' : 'update-available') : undefined,
                    }}
                />
            </div>
        </ProjectProvider>
    );
}

/** The page of a route. */
export function ModelerPage({route}: {route: ModelerRoute}): ReactElement {
    switch (route.page) {
        case 'home':
            return <HomePage />;
        case 'examples':
            return <ExamplesPage industry={route.industry} query={route.query} />;
        case 'details':
            return <DetailsPage example={route.example} industry={route.industry} />;
        case 'workspace':
            return <WorkspacePage />;
        case 'project':
            return <ProjectPage projectPath={route.projectPath} path={route.path} view={route.view} />;
    }
}
