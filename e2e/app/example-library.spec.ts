import {test, expect} from '@playwright/test';

// The Examples page of the real local Modeler app against the PUBLISHED `rimvydasb/edgerules-examples` repository.
// An unreleased or malformed entry in the published `library.json` once made the whole library fail ("The example
// library did not load") while every other test passed: the failure state must never show, and examples must list.

const SLOW = {timeout: 30_000};
// The index the app loads: stories/support/examplesSource.ts.
const INDEX_URL = 'https://raw.githubusercontent.com/rimvydasb/edgerules-examples/main/library.json';

test('the Examples page lists the published examples and shows no load error', async ({page}) => {
    await page.goto('/examples');
    await expect(page.getByTestId('example-panel').first()).toBeVisible(SLOW);
    await expect(page.getByRole('alert').filter({hasText: 'The example library did not load'})).toHaveCount(0);
});

test('the home page shows no example library error', async ({page}) => {
    await page.goto('/');
    await expect(page.getByRole('button', {name: 'Browse examples'})).toBeVisible(SLOW);
    // Give the index request time to finish: a failure renders the alert after the request settles.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('alert').filter({hasText: 'The example library did not load'})).toHaveCount(0);
});

// The published repository changes without a change here, so this test reads the live index and copies EVERY listed
// example into the workspace: the index, the manifest, the model and the tests of each example must load.
test('every published example copies into the workspace', async ({page, request}) => {
    test.setTimeout(300_000);
    const response = await request.get(INDEX_URL);
    expect(response.ok(), 'library.json should be published').toBe(true);
    const index = (await response.json()) as {examples: {name: string; versions: {ref?: string}[]}[]};
    // A version without a `ref` is an unreleased draft: the app does not list it.
    const released = index.examples.filter((example) => example.versions.some((version) => version.ref));
    expect(released.length).toBeGreaterThan(0);

    for (const example of released) {
        await page.goto('/examples');
        await page.getByLabel('Search examples').fill(example.name, SLOW);
        const panel = page.getByTestId('example-panel').filter({hasText: example.name}).first();
        await panel.getByRole('button', {name: 'Copy and open'}).click(SLOW);
        await expect(page).toHaveURL(/\/project\//, SLOW);
        await expect(
            page.getByRole('button', {name: `Project menu: ${example.name}`}),
            `${example.name} should copy and open without an error`,
        ).toBeVisible(SLOW);
    }
});
