import {describe, expect, it} from 'vitest';
import {createMemoryHistory} from '@tanstack/react-router';
import type {ModelerWorkspace} from '../../stories/support/modeler/ModelerHost';
import {routePath, type ModelerRoute} from '../../stories/support/modeler/routes';
import {createModelerRouter, toModelerRoute, type Match} from '../router';

// The router only matches URLs here; the pages, and so the workspace, are never rendered.
const WORKSPACE = {} as ModelerWorkspace;

async function routeOf(href: string): Promise<ModelerRoute | 'not-found'> {
    const router = createModelerRouter(WORKSPACE, createMemoryHistory({initialEntries: [href]}));
    await router.load();
    const last = router.state.matches.at(-1);
    // No route matched (only the root), or the route threw `notFound()` before it loaded.
    if (!last || last.routeId === '__root__' || last.status !== 'success') return 'not-found';
    return toModelerRoute(last as unknown as Match);
}

describe('Modeler URLs', () => {
    const routes: [string, ModelerRoute][] = [
        ['/', {page: 'home'}],
        ['/examples', {page: 'examples'}],
        ['/examples?q=loan%20scorecard', {page: 'examples', query: 'loan scorecard'}],
        ['/examples/financial', {page: 'examples', industry: 'financial'}],
        ['/examples/financial?q=loan', {page: 'examples', industry: 'financial', query: 'loan'}],
        [
            '/examples/financial/loan-repayment@1.2.0',
            {page: 'details', industry: 'financial', example: {id: 'loan-repayment', version: '1.2.0'}},
        ],
        ['/examples/all/loan-repayment@1.2.0', {page: 'details', example: {id: 'loan-repayment', version: '1.2.0'}}],
        ['/workspace', {page: 'workspace'}],
        ['/project/loan-origination', {page: 'project', projectPath: 'loan-origination'}],
        ['/project/loan-origination?view=flow', {page: 'project', projectPath: 'loan-origination', view: 'flow'}],
        [
            '/project/loan-origination/applicant.calculateAge?view=code',
            {page: 'project', projectPath: 'loan-origination', path: 'applicant.calculateAge', view: 'code'},
        ],
        [
            '/project/loan-origination/doc:README.md?view=preview',
            {page: 'project', projectPath: 'loan-origination', path: 'doc:README.md', view: 'preview'},
        ],
    ];

    it.each(routes)('%s is a route, and the route builds the same URL', async (href, route) => {
        expect(await routeOf(href)).toEqual(route);
        expect(routePath(route)).toBe(href);
    });

    it('ignores an unknown view', async () => {
        expect(await routeOf('/project/p?view=nope')).toEqual({page: 'project', projectPath: 'p'});
    });

    it('has no page for an unknown URL or an example without a version', async () => {
        expect(await routeOf('/nowhere')).toBe('not-found');
        expect(await routeOf('/examples/financial/loan-repayment')).toBe('not-found');
    });
});
