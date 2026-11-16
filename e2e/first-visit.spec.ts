import {test, expect} from './support/fixtures';
import {copyExample, LOAN_REPAYMENT, SLOW} from './support/app';

// Every test of this suite is the first visit of a new user (e2e/support/fixtures.ts). These tests prove it: the
// browser has nothing stored and nothing cached, and the app keeps the visitor's device clean until the user creates
// something.

test('a first visit has no cookies, no stored data and a cold HTTP cache', async ({page, context}) => {
    expect(await context.cookies(), 'no cookie before the visit').toEqual([]);

    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Model, test and run business decisions.'})).toBeVisible(SLOW);
    await page.waitForLoadState('networkidle');

    const state = await page.evaluate(async () => ({
        cookie: document.cookie,
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        serviceWorkers: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
        // A resource of the app with a body but no transfer came from the HTTP cache.
        cached: performance
            .getEntriesByType('resource')
            .map((entry) => entry as PerformanceResourceTiming)
            .filter((entry) => entry.name.startsWith(location.origin) && entry.decodedBodySize > 0)
            .filter((entry) => entry.transferSize === 0)
            .map((entry) => entry.name),
    }));
    expect(state.cookie, 'the app sets no cookie').toBe('');
    expect(await context.cookies()).toEqual([]);
    expect(state.localStorage).toEqual([]);
    expect(state.sessionStorage).toEqual([]);
    expect(state.serviceWorkers).toBe(0);
    expect(state.cached, 'nothing of the app comes from the HTTP cache').toEqual([]);

    // The workspace is empty: no project of an earlier visit.
    await page.goto('/workspace');
    await expect(page.getByText('No projects yet')).toBeVisible(SLOW);
});

test('two tests never share a workspace: a project of another test is not here', async ({page}) => {
    // Every other spec copies this example; a shared browser profile would list one of those copies.
    await page.goto('/workspace');
    await expect(page.getByText('No projects yet')).toBeVisible(SLOW);
    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBeLessThanOrEqual(1);
});

test('a copied project is stored in IndexedDB only, and the app still sets no cookie', async ({page, context}) => {
    await copyExample(page, LOAN_REPAYMENT);
    const databases = await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name));
    expect(databases).toEqual(['edgerules-modeler-dev']);
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});
