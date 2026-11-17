import {test, expect} from './support/fixtures';
import {expectLocation, expectProjectOpen, LOAN_REPAYMENT, SLOW, topBar} from './support/app';

// The example library against the PUBLISHED `rimvydasb/edgerules-examples` repository (stories/support/examplesSource.ts):
// the gallery, the details page and the copy into the workspace. An unreleased or malformed entry of the published
// `library.json` once made the whole library fail ("The example library did not load") while every other test passed.

const LOAD_ERROR = 'The example library did not load';

test('the Home page and the gallery list the published examples without a load error', async ({page}) => {
    await page.goto('/');
    const featured = page.getByRole('region', {name: 'Examples'});
    await expect(featured.getByRole('link', {name: LOAN_REPAYMENT.name})).toBeVisible(SLOW);
    await expect(page.getByRole('alert').filter({hasText: LOAD_ERROR})).toHaveCount(0);

    await page.goto('/examples');
    const panels = page.getByTestId('example-panel');
    await expect(panels.first()).toBeVisible(SLOW);
    await expect(page.getByRole('alert').filter({hasText: LOAD_ERROR})).toHaveCount(0);
    // The count of the status line is the count of the panels.
    const count = await panels.count();
    await expect(page.getByRole('status')).toHaveText(`${count} examples`);
});

test('the gallery narrows as the user types and says when nothing matches', async ({page}) => {
    await page.goto('/examples');
    const panels = page.getByTestId('example-panel');
    await expect(panels.first()).toBeVisible(SLOW);
    const all = await panels.count();

    await page.getByLabel('Search examples').fill('loan');
    await expect(panels.first()).toContainText(/loan/i);
    expect(await panels.count()).toBeLessThan(all);

    await page.getByLabel('Search examples').fill('zzz-no-such-example');
    await expect(page.getByText('No example matches.')).toBeVisible();
    await expect(panels).toHaveCount(0);

    await page.getByLabel('Search examples').fill('');
    await expect(panels).toHaveCount(all);
});

test('the details page shows the README and the actions of a read-only library', async ({page, context}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);
    await expect(page.getByRole('heading', {name: LOAN_REPAYMENT.name, level: 2})).toBeVisible(SLOW);
    await expect(page.getByRole('heading', {name: 'Inputs and outputs'})).toBeVisible();
    await expect(page.getByRole('combobox', {name: 'Version'})).toHaveValue(`${LOAN_REPAYMENT.version} (latest)`);
    // The related example panels have their own buttons: the page actions come first.
    await expect(page.getByRole('button', {name: 'Copy and open'}).first()).toBeVisible();
    await expect(page.getByRole('button', {name: 'Copy to workspace'})).toBeVisible();
    await expect(page.getByRole('button', {name: /edit/i})).toHaveCount(0);

    // "Share link" copies the absolute link of this version of the example.
    await page.getByRole('button', {name: 'Share link'}).click();
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(new URL(`/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`, page.url()).href);
});

test('Copy to workspace stays on the page; the library then opens the copy instead of copying it again', async ({
    page,
}) => {
    await page.goto(`/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);
    await page.getByRole('button', {name: 'Copy to workspace'}).click(SLOW);
    await expect(page.getByRole('button', {name: 'Open copy'}).first()).toBeVisible(SLOW);
    await expectLocation(page, `/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);

    // The gallery marks the example as copied.
    await topBar(page).getByRole('link', {name: 'Examples'}).click();
    const copied = page.getByTestId('example-panel').filter({hasText: LOAN_REPAYMENT.name});
    await expect(copied.getByText(/In workspace|Update available/)).toBeVisible(SLOW);
    await page.getByRole('radio', {name: 'In my workspace'}).click();
    await expect(page.getByTestId('example-panel')).toHaveCount(1);

    await copied.getByRole('button', {name: 'Open copy'}).click();
    await expectLocation(page, '/project/loan-repayment?view=flow');
    await expectProjectOpen(page, LOAN_REPAYMENT.name);

    // The Workspace lists the one copy with its origin.
    await topBar(page).getByRole('link', {name: 'Workspace'}).click();
    await expect(page.getByTestId('project-panel')).toHaveCount(1);
    await expect(page.getByTestId('project-panel')).toContainText(`loan-repayment@${LOAN_REPAYMENT.version}`);
});

test('the copy links back to its example: "View original example" opens the details of the copied version', async ({
    page,
}) => {
    await page.goto('/examples/financial/loan-origination@2.0.0');
    await page.getByRole('button', {name: 'Copy and open'}).first().click(SLOW);
    await expectLocation(page, '/project/loan-origination?view=flow');
    await expectProjectOpen(page, 'Loan Origination');
    await page.getByRole('button', {name: 'Project menu: Loan Origination'}).click();
    await page.getByRole('menuitem', {name: 'View original example'}).click();
    await expectLocation(page, '/examples/financial/loan-origination@2.0.0');
});

// The published repository changes without a change here, so this test reads the live index and copies EVERY released
// example into the workspace: the index, the manifest, the model and the tests of each example must load and open.
test('every published example copies into the workspace and opens', async ({page, request}) => {
    test.setTimeout(300_000);
    const response = await request.get(
        'https://raw.githubusercontent.com/rimvydasb/edgerules-examples/main/library.json',
    );
    expect(response.ok(), 'library.json should be published').toBe(true);
    const index = (await response.json()) as {
        examples: {id: string; name: string; industry: string; versions: {version: string; ref?: string}[]}[];
    };
    // A version without a `ref` is an unreleased draft: the app does not list it.
    const released = index.examples.flatMap((example) => {
        const version = example.versions.find((candidate) => candidate.ref);
        return version ? [{...example, version: version.version}] : [];
    });
    expect(released.length).toBeGreaterThan(0);

    for (const example of released) {
        await page.goto(`/examples/${example.industry}/${example.id}@${example.version}`);
        await page.getByRole('button', {name: 'Copy and open'}).first().click(SLOW);
        // The path of a copy is made from its name.
        await expectLocation(page, /^\/project\/[a-z0-9-]+\?view=flow$/);
        await expect(
            page.getByRole('button', {name: `Project menu: ${example.name}`}),
            `${example.name} should copy and open without an error`,
        ).toBeVisible(SLOW);
        await expect(page.getByRole('alert')).toHaveCount(0);
    }
});
