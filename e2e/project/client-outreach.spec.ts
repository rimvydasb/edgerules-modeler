import {test, expect} from '../support/fixtures';
import {CLIENT_OUTREACH, copyExample, entry, expectLocation, SLOW, view} from '../support/app';

// The published Client Outreach example holds an `optimise` element, which runs only with a solver. EdgeRules ships
// none: the app registers HiGHS when it opens the project. Only the app can catch a host that forgets to.

// HiGHS loads its own WASM the first time a project needs it.
const SOLVER = {timeout: 60_000};

test.beforeEach(async ({page}) => {
    await copyExample(page, CLIENT_OUTREACH);
    await expectLocation(page, '/project/client-outreach?view=flow');
});

test('Run all of the project solves the optimisation with the solver of the app, and every test passes', async ({
    page,
}) => {
    const card = page.getByTestId('shell-tests-card');
    await expect(card).toContainText('6 suites');
    await card.getByRole('button', {name: 'Run all'}).click();
    await expect(card).toContainText('22 passed', SOLVER);
    await expect(card).not.toContainText('failed');
    await expect(page.getByText('No optimisation solver registered')).toHaveCount(0);
});

test('the tests of the service run in the Tests view without a missing-solver banner', async ({page}) => {
    await entry(page, 'test', 'contactPlan').click();
    await expectLocation(page, '/project/client-outreach/contactPlan?view=tests');
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
    await page.getByRole('button', {name: 'Run all'}).click();
    await expect(page.getByTestId(/^assertion-summary-/).first()).toBeVisible(SOLVER);
    await expect(page.getByTestId('missing-solver-banner')).toHaveCount(0);
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
});

test('the workbook plans the day: the optimisation runs on the canvas', async ({page}) => {
    await page.getByTestId('shell-workbook-outreachBook').click();
    await expectLocation(page, '/project/client-outreach/outreachBook?view=flow');
    await expect(page.locator('.react-flow__node').first()).toBeVisible(SLOW);
    const outputs = page.locator('[data-testid^="output-node-"]');
    await expect(outputs.first()).toBeVisible(SLOW);
    // Every wired output has its value, and no node shows an error of the solver.
    await expect(outputs.getByTestId('output-value').filter({hasText: /^(…|—)?$/})).toHaveCount(0, SOLVER);
    await expect(outputs.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/no optimisation solver/i)).toHaveCount(0);
});

test('the optimise element opens in the Boxed and in the Code view', async ({page}) => {
    await entry(page, 'optimise', 'contactMix').click();
    await expectLocation(page, '/project/client-outreach/contactMix');
    await expect(page.getByTestId('row-contactMix')).toBeVisible(SLOW);
    await view(page, 'Code').click();
    await expect(page.locator('.cm-content').first()).toContainText('optimise contactMix');
});
