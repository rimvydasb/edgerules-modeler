import {useCallback, useMemo, type ReactElement} from 'react';
import {Alert, Button} from '@mantine/core';
import {
    createRootRouteWithContext,
    createRoute,
    createRouter,
    notFound,
    Outlet,
    useMatches,
    useRouter,
    type RouterHistory,
} from '@tanstack/react-router';
import type {ShellView} from '../src/components/shell';
import {
    ModelerFrame,
    ModelerPage,
    ModelerProvider,
    type ModelerWorkspace,
} from '../stories/support/modeler/ModelerHost';
import {
    ANY_INDUSTRY,
    parseCoordinates,
    routePath,
    SHELL_VIEWS,
    type ModelerRoute,
} from '../stories/support/modeler/routes';

/**
 * The routes of the local Modeler. The page components of the package report navigation through callbacks; this file
 * is the only place that knows URLs. `routePath` (stories/support/modeler/routes.ts) builds the same URLs back.
 */
const rootRoute = createRootRouteWithContext<ModelerWorkspace>()({
    component: Root,
    notFoundComponent: NotFound,
});

const homeRoute = createRoute({getParentRoute: () => rootRoute, path: '/', component: RoutePage});

function validateQuery(search: Record<string, unknown>): {q?: string} {
    return search.q === undefined || search.q === '' ? {} : {q: String(search.q)};
}

const examplesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/examples',
    validateSearch: validateQuery,
    component: RoutePage,
});

const industryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/examples/$industry',
    validateSearch: validateQuery,
    component: RoutePage,
});

const detailsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/examples/$industry/$example',
    beforeLoad: ({params}) => {
        if (!parseCoordinates(params.example)) throw notFound();
    },
    component: RoutePage,
});

const workspaceRoute = createRoute({getParentRoute: () => rootRoute, path: '/workspace', component: RoutePage});

function validateView(search: Record<string, unknown>): {view?: ShellView} {
    return SHELL_VIEWS.includes(search.view as ShellView) ? {view: search.view as ShellView} : {};
}

const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/project/$projectPath',
    validateSearch: validateView,
    component: RoutePage,
});

// The root path of an element of the project: `/project/loan-origination/applicant.calculateAge?view=flow`.
const projectElementRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/project/$projectPath/$',
    validateSearch: validateView,
    component: RoutePage,
});

const routeTree = rootRoute.addChildren([
    homeRoute,
    examplesRoute,
    industryRoute,
    detailsRoute,
    workspaceRoute,
    projectRoute,
    projectElementRoute,
]);

export function createModelerRouter(workspace: ModelerWorkspace, history?: RouterHistory) {
    return createRouter({routeTree, context: workspace, history, defaultPreload: false, scrollRestoration: true});
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createModelerRouter>;
    }
}

export interface Match {
    routeId: string;
    params: Record<string, string>;
    search: Record<string, unknown>;
}

/** The Modeler route of the deepest URL match; the Home page when nothing matches. */
export function toModelerRoute(match: Match | undefined): ModelerRoute {
    const params = match?.params ?? {};
    // The search of a match keeps every key of the URL: validate the ones a page reads.
    const query = validateQuery(match?.search ?? {}).q;
    const view = validateView(match?.search ?? {}).view;
    switch (match?.routeId) {
        case examplesRoute.id:
            return {page: 'examples', ...(query && {query})};
        case industryRoute.id:
            return {page: 'examples', industry: params.industry, ...(query && {query})};
        case detailsRoute.id: {
            const example = parseCoordinates(params.example);
            if (!example) return {page: 'home'}; // the details route answers "not found" for it
            return {page: 'details', example, ...(params.industry !== ANY_INDUSTRY && {industry: params.industry})};
        }
        case workspaceRoute.id:
            return {page: 'workspace'};
        case projectRoute.id:
        case projectElementRoute.id:
            return {
                page: 'project',
                projectPath: params.projectPath,
                ...(params._splat && {path: params._splat}),
                ...(view && {view}),
            };
        default:
            return {page: 'home'};
    }
}

function useModelerRoute(): ModelerRoute {
    // A string selection keeps the route stable between renders of the same URL.
    const match = useMatches({
        select: (matches) => {
            const last = matches.at(-1);
            return last ? JSON.stringify({routeId: last.routeId, params: last.params, search: last.search}) : '';
        },
    });
    return useMemo(() => toModelerRoute(match ? (JSON.parse(match) as Match) : undefined), [match]);
}

function Root(): ReactElement {
    const router = useRouter();
    const route = useModelerRoute();
    const navigate = useCallback(
        (next: ModelerRoute, options?: {replace?: boolean}) =>
            void router.navigate({href: routePath(next), replace: options?.replace}),
        [router],
    );
    const shareUrl = useCallback((next: ModelerRoute) => new URL(routePath(next), window.location.origin).href, []);
    return (
        <ModelerProvider
            {...router.options.context}
            navigate={navigate}
            href={routePath}
            shareUrl={shareUrl}
            route={route}
        >
            <ModelerFrame route={route}>
                <Outlet />
            </ModelerFrame>
        </ModelerProvider>
    );
}

function RoutePage(): ReactElement {
    return <ModelerPage route={useModelerRoute()} />;
}

function NotFound(): ReactElement {
    const router = useRouter();
    return (
        <Alert color="gray" title="Page not found" m="xl">
            {window.location.pathname} is not a page of the Modeler.
            <div>
                <Button mt="sm" size="compact-sm" onClick={() => void router.navigate({to: '/'})}>
                    Go to Home
                </Button>
            </div>
        </Alert>
    );
}
