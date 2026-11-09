import type {ExampleCoordinates} from '../../../src/components/example-library';
import type {ShellView} from '../../../src/components/shell';

/**
 * The pages of the hosted Modeler. The page components of the package know nothing of these routes: they report
 * navigation through callbacks, and the host turns a callback into a route.
 */
export type ModelerRoute =
    | {page: 'home'}
    | {page: 'examples'; industry?: string; query?: string}
    | {page: 'details'; example: ExampleCoordinates; industry?: string}
    | {page: 'workspace'}
    | {page: 'project'; projectPath: string; path?: string; view?: ShellView};

/** The view of a project path without `?view=`: the Flow view at the project root, the Boxed view of an element. */
export function defaultView(path: string | undefined): ShellView {
    return !path || path === '*' ? 'flow' : 'boxed';
}

export const SHELL_VIEWS: readonly ShellView[] = ['flow', 'boxed', 'code', 'tests', 'preview'];

/** The industry segment of a details URL when the industry is not known yet. */
export const ANY_INDUSTRY = 'all';

/** `loan-repayment@1.2.0` to coordinates; undefined for a segment without a version. */
export function parseCoordinates(segment: string): ExampleCoordinates | undefined {
    const at = segment.lastIndexOf('@');
    if (at <= 0 || at === segment.length - 1) return undefined;
    return {id: segment.slice(0, at), version: segment.slice(at + 1)};
}

/**
 * The URL of a route:
 *
 * - `/`, `/workspace`
 * - `/examples`, `/examples/<industry>`, with `?q=<query>`
 * - `/examples/<industry>/<id>@<version>`
 * - `/project/<projectPath>?view=flow` (the project home), `/project/<projectPath>/<root path>`, with `?view=<view>`
 *   (the Boxed view of an element is the default and has none)
 */
export function routePath(route: ModelerRoute): string {
    switch (route.page) {
        case 'home':
            return '/';
        case 'examples': {
            const base = route.industry ? `/examples/${encodeURIComponent(route.industry)}` : '/examples';
            return route.query ? `${base}?q=${encodeURIComponent(route.query)}` : base;
        }
        case 'details':
            return `/examples/${encodeURIComponent(route.industry ?? ANY_INDUSTRY)}/${route.example.id}@${route.example.version}`;
        case 'workspace':
            return '/workspace';
        case 'project': {
            const path = route.path && route.path !== '*' ? `/${encodeURI(route.path)}` : '';
            // The project home opens in the Flow view, where a workbook or a service is chosen.
            const view = route.view ?? (path ? undefined : 'flow');
            return `/project/${encodeURIComponent(route.projectPath)}${path}${view ? `?view=${view}` : ''}`;
        }
    }
}

/** The top navigation item that a route belongs to; Home and the projects have their own (the brand, a project tab). */
export function sectionOf(route: ModelerRoute): 'examples' | 'workspace' | undefined {
    if (route.page === 'details' || route.page === 'examples') return 'examples';
    return route.page === 'workspace' ? 'workspace' : undefined;
}

export type ProjectRoute = Extract<ModelerRoute, {page: 'project'}>;
