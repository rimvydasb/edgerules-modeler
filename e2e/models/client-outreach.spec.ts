import {test, expect} from '@playwright/test';
import {openStory} from '../support/storybook';

// The client outreach project holds an `optimise` element, which runs only with a solver. EdgeRules ships none: the
// host registers HiGHS when it opens the project. The Modeler story opens it as the app does, with no solver of its own
// (the Models/Client Outreach stories register one themselves, so they cannot catch a host that forgets to).

const SLOW = {timeout: 60_000};

test('Run all of a project with an optimisation finds the solver the host registered', async ({page}) => {
    await openStory(page, 'modeler--optimise-project-tests');
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);

    await page.getByRole('button', {name: 'Run all'}).click();

    await expect(page.getByTestId('missing-solver-banner')).toHaveCount(0);
    await expect(page.getByText('No optimisation solver registered')).toHaveCount(0);
    const summaries = page.getByTestId(/^assertion-summary-/);
    await expect(summaries.first()).toBeVisible(SLOW);
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
});
