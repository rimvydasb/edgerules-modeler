import {test, expect} from '@playwright/test';
import {openStory} from '../support/storybook';

// The Examples page of the Modeler stories (docs/stories/examples-library-story.md), against the published
// `rimvydasb/edgerules-examples` repository: search, the details preview, "Copy and open" into the Shell.

// The index loads from jsDelivr and the engine loads before the Shell shows: the first lookups wait longer.
const SLOW = {timeout: 30_000};

test('searches the gallery as the user types', async ({page}) => {
    await openStory(page, 'modeler--examples');
    const panels = page.getByTestId('example-panel');
    await expect(panels.first()).toBeVisible(SLOW);
    const all = await panels.count();

    await page.getByLabel('Search examples').fill('loan');
    await expect(panels.first()).toBeVisible();
    await expect(panels.first()).toContainText(/loan/i);
    expect(await panels.count()).toBeLessThanOrEqual(all);

    await page.getByLabel('Search examples').fill('zzz-no-such-example');
    await expect(page.getByText('No example matches.')).toBeVisible();
    await expect(panels).toHaveCount(0);
});

test('previews an example on its details page, with README and metadata', async ({page}) => {
    await openStory(page, 'modeler--examples');
    await page.getByLabel('Search examples').fill('loan repayment', SLOW);
    const panel = page.getByTestId('example-panel').filter({hasText: 'Loan repayment'}).first();
    await panel.getByRole('button', {name: 'Details'}).click(SLOW);

    await expect(page.getByTestId('modeler-route')).toHaveText(/^\/examples\/loan-repayment@/);
    // The related example panels have their own buttons: the page actions come first.
    await expect(page.getByRole('button', {name: 'Copy and open'}).first()).toBeVisible(SLOW);
    await expect(page.getByRole('button', {name: 'Copy to workspace'})).toBeVisible();
    // A read-only Library: no edit action.
    await expect(page.getByRole('button', {name: /edit/i})).toHaveCount(0);
});

test('Copy and open shows the copy in the Shell, with a way back to the Workspace', async ({page}) => {
    await openStory(page, 'modeler--examples');
    await page.getByLabel('Search examples').fill('loan repayment', SLOW);
    const panel = page.getByTestId('example-panel').filter({hasText: 'Loan repayment'}).first();
    await panel.getByRole('button', {name: 'Copy and open'}).click(SLOW);

    await expect(page.getByTestId('modeler-route')).toHaveText(/^\/project\//, SLOW);
    const crumb = page.getByTestId('shell').getByRole('button', {name: 'Workspace', exact: true});
    await expect(crumb).toBeVisible(SLOW);

    await crumb.click();
    await expect(page.getByTestId('modeler-route')).toHaveText('/workspace');
    await expect(page.getByTestId('project-panel')).toContainText('from loan-repayment@');
});
