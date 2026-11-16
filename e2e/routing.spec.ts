import {test, expect, type Page} from './support/fixtures';
import {
    copyExample,
    crumbs,
    entry,
    expectLocation,
    expectProjectOpen,
    expectView,
    explorer,
    LOAN_ORIGINATION,
    LOAN_REPAYMENT,
    openProjectOverview,
    SLOW,
    topBar,
    view,
} from './support/app';

// The URL is the route of the Modeler (app/router.tsx, stories/support/modeler/routes.ts): every page and every
// element of a project has its own link, the address bar follows every click, and Back, Forward, a reload and a typed
// link open the same page again.

function searchParam(page: Page, name: string): string | null {
    return new URL(page.url()).searchParams.get(name);
}

async function expectTitle(page: Page, title: string): Promise<void> {
    await expect(page).toHaveTitle(`${title} · EdgeRules Modeler`);
}

test.describe('the pages of the top bar', () => {
    test('Home, Examples and Workspace are real links, and each click updates the address bar and the title', async ({
        page,
    }) => {
        await page.goto('/');
        await expectTitle(page, 'Home');
        const bar = topBar(page);
        await expect(bar.getByRole('link', {name: 'Home'})).toHaveAttribute('href', '/');
        await expect(bar.getByRole('link', {name: 'Examples'})).toHaveAttribute('href', '/examples');
        await expect(bar.getByRole('link', {name: 'Workspace'})).toHaveAttribute('href', '/workspace');
        await expect(page.getByRole('link', {name: 'EdgeRules Modeler'})).toHaveAttribute('href', '/');
        await expect(bar.getByRole('link', {name: 'Home'})).toHaveAttribute('aria-current', 'page');

        await bar.getByRole('link', {name: 'Examples'}).click();
        await expectLocation(page, '/examples');
        await expectTitle(page, 'Examples');
        await expect(bar.getByRole('link', {name: 'Examples'})).toHaveAttribute('aria-current', 'page');
        await expect(bar.getByRole('link', {name: 'Home'})).not.toHaveAttribute('aria-current', 'page');

        await bar.getByRole('link', {name: 'Workspace'}).click();
        await expectLocation(page, '/workspace');
        await expectTitle(page, 'Workspace');
        await expect(bar.getByRole('link', {name: 'Workspace'})).toHaveAttribute('aria-current', 'page');

        await page.getByRole('link', {name: 'EdgeRules Modeler'}).click();
        await expectLocation(page, '/');
        await expectTitle(page, 'Home');

        // Back and Forward walk the same pages.
        await page.goBack();
        await expectLocation(page, '/workspace');
        await page.goBack();
        await expectLocation(page, '/examples');
        await expect(page.getByTestId('example-panel').first()).toBeVisible(SLOW);
        await page.goForward();
        await expectLocation(page, '/workspace');
        await expect(page.getByText('No projects yet')).toBeVisible();
    });

    test('a modified click on a top bar link opens the page in a new tab and keeps this one', async ({
        page,
        context,
    }) => {
        await page.goto('/');
        const opened = context.waitForEvent('page');
        await topBar(page)
            .getByRole('link', {name: 'Examples'})
            .click({modifiers: ['ControlOrMeta']});
        const tab = await opened;
        await tab.waitForLoadState();
        expect(new URL(tab.url()).pathname).toBe('/examples');
        await expectLocation(page, '/');
    });

    test('the Home page leads to the examples, a search, an industry and the workspace', async ({page}) => {
        await page.goto('/');
        await page.getByRole('button', {name: 'Browse examples'}).click(SLOW);
        await expectLocation(page, '/examples');

        await page.goto('/');
        await page.getByRole('combobox', {name: 'Search examples and projects'}).fill('loan');
        await page.keyboard.press('Enter');
        await expectLocation(page, /^\/examples\?q=loan$/);
        await expect(page.getByLabel('Search examples')).toHaveValue('loan');

        await page.goto('/');
        await page
            .getByRole('region', {name: 'Industries'})
            .getByRole('button', {name: /^Financial,/})
            .click(SLOW);
        await expectLocation(page, '/examples/financial');
        await expect(page.getByRole('button', {name: /^Financial \d+$/})).toHaveAttribute('aria-pressed', 'true');

        await page.goto('/');
        await page.getByRole('region', {name: 'Examples'}).getByRole('button', {name: 'All examples'}).click(SLOW);
        await expectLocation(page, '/examples');
    });

    test('a page that does not exist says so and leads Home', async ({page}) => {
        for (const path of ['/nope', '/examples/financial/loan-repayment', '/project']) {
            await page.goto(path);
            await expect(page.getByText('Page not found')).toBeVisible(SLOW);
            await expect(page.getByText(`${path} is not a page of the Modeler.`)).toBeVisible();
        }
        await page.getByRole('button', {name: 'Go to Home'}).click();
        await expectLocation(page, '/');
    });
});

test.describe('the example library', () => {
    test('an industry adds a history entry; the search replaces it', async ({page}) => {
        await page.goto('/examples');
        await expect(page.getByTestId('example-panel').first()).toBeVisible(SLOW);
        await page.getByRole('button', {name: /^Financial \d+$/}).click();
        await expectLocation(page, '/examples/financial');

        await page.getByLabel('Search examples').fill('loan re');
        await expect.poll(() => searchParam(page, 'q')).toBe('loan re');
        expect(new URL(page.url()).pathname).toBe('/examples/financial');
        await page.getByLabel('Search examples').fill('');
        await expectLocation(page, '/examples/financial');
        await page.getByLabel('Search examples').fill('loan');
        await expect.poll(() => searchParam(page, 'q')).toBe('loan');

        // Every keystroke replaced the entry: Back leaves the industry, Forward restores the last query.
        await page.goBack();
        await expectLocation(page, '/examples');
        await expect(page.getByLabel('Search examples')).toHaveValue('');
        await page.goForward();
        await expect.poll(() => searchParam(page, 'q')).toBe('loan');
        await expect(page.getByLabel('Search examples')).toHaveValue('loan');

        // A typed link with a query opens the filtered gallery.
        await page.goto('/examples?q=repayment');
        await expect(page.getByLabel('Search examples')).toHaveValue('repayment');
        await expect(page.getByTestId('example-panel')).toHaveCount(1, SLOW);
        await expect(page.getByTestId('example-panel')).toContainText(LOAN_REPAYMENT.name);
    });

    test('details, the library path and the version picker each have their own URL', async ({page}) => {
        await page.goto('/examples/financial');
        const panel = page.getByTestId('example-panel').filter({hasText: LOAN_REPAYMENT.name});
        await panel.getByRole('button', {name: 'Details'}).click(SLOW);
        await expectLocation(page, `/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);
        await expectTitle(page, 'Example');
        await expect(topBar(page).getByRole('link', {name: 'Examples'})).toHaveAttribute('aria-current', 'page');

        const path = page.getByRole('navigation', {name: 'Library path'});
        await path.getByRole('button', {name: 'Financial'}).click();
        await expectLocation(page, '/examples/financial');
        await page.goBack();
        await expectLocation(page, `/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);
        await path.getByRole('button', {name: 'Examples'}).click();
        await expectLocation(page, '/examples');

        // An older version has its own link; picking the latest replaces the URL instead of adding an entry.
        await page.goto('/examples/financial/loan-origination@2.0.0');
        await expect(page.getByRole('combobox', {name: 'Version'})).toHaveValue('2.0.0', SLOW);
        await page.getByRole('combobox', {name: 'Version'}).click();
        await page.getByRole('option', {name: '2.0.1 (latest)'}).click();
        await expectLocation(page, '/examples/financial/loan-origination@2.0.1');
        await page.goBack();
        await expectLocation(page, '/examples');
    });

    test('a details link of an unknown industry segment still opens the example', async ({page}) => {
        // `all` is the industry segment of a details URL when the industry is not known yet.
        await page.goto(`/examples/all/loan-repayment@${LOAN_REPAYMENT.version}`);
        await expect(page.getByRole('heading', {name: LOAN_REPAYMENT.name, level: 2})).toBeVisible(SLOW);
        await page.getByRole('navigation', {name: 'Library path'}).getByRole('button', {name: 'Financial'}).click();
        await expectLocation(page, '/examples/financial');
    });

    test('an example that is not in the library says so', async ({page}) => {
        await page.goto('/examples/financial/no-such-example@1.0.0');
        await expect(page.getByText('Example not found')).toBeVisible(SLOW);
        await expect(page.getByText('no-such-example@1.0.0 is not in the library.')).toBeVisible();
    });
});

test.describe('a project', () => {
    test('Copy and open adds a project tab whose link follows the last element of the project', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await expectTitle(page, LOAN_REPAYMENT.name);
        const tab = topBar(page).getByRole('link', {name: LOAN_REPAYMENT.name});
        await expect(tab).toHaveAttribute('href', '/project/loan-repayment?view=flow');
        await expect(tab).toHaveAttribute('aria-current', 'page');

        await entry(page, 'ruleset', 'pricingTier').click();
        await expectLocation(page, '/project/loan-repayment/pricingTier');
        await expect(tab).toHaveAttribute('href', '/project/loan-repayment/pricingTier');

        // On another page the tab leads back to the same element.
        await topBar(page).getByRole('link', {name: 'Examples'}).click();
        await expectLocation(page, '/examples');
        await expect(tab).not.toHaveAttribute('aria-current', 'page');
        await tab.click();
        await expectLocation(page, '/project/loan-repayment/pricingTier');
        await expect(page.getByTestId('row-pricingTier')).toBeVisible(SLOW);

        // Closing the tab of the shown project goes to the Workspace and removes the tab.
        await topBar(page)
            .getByRole('button', {name: `Close ${LOAN_REPAYMENT.name}`})
            .click();
        await expectLocation(page, '/workspace');
        await expect(tab).toHaveCount(0);
    });

    test('every explorer click and view switch is a history entry; Back, Forward and a reload follow them', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await entry(page, 'ruleset', 'pricingTier').click();
        await expectLocation(page, '/project/loan-repayment/pricingTier');
        await expectView(page, 'Boxed');
        await view(page, 'Code').click();
        await expectLocation(page, '/project/loan-repayment/pricingTier?view=code');
        await view(page, 'Tests').click();
        await expectLocation(page, '/project/loan-repayment/pricingTier?view=tests');
        // An explorer click opens a method in its Boxed view.
        await entry(page, 'function', 'monthlyPayment').click();
        await expectLocation(page, '/project/loan-repayment/monthlyPayment');
        await expect(crumbs(page)).toContainText('monthlyPayment(...)');
        await expectView(page, 'Boxed');

        await page.goBack();
        await expectLocation(page, '/project/loan-repayment/pricingTier?view=tests');
        await expect(crumbs(page)).toContainText('pricingTier(...)');
        await expectView(page, 'Tests');
        await page.goBack();
        await expectLocation(page, '/project/loan-repayment/pricingTier?view=code');
        await expectView(page, 'Code');
        await page.goBack();
        await expectLocation(page, '/project/loan-repayment/pricingTier');
        await expectView(page, 'Boxed');
        await page.goBack();
        await expectLocation(page, '/project/loan-repayment?view=flow');
        await expect(page.getByTestId('shell-workbook-picker')).toBeVisible();
        await page.goForward();
        await expectLocation(page, '/project/loan-repayment/pricingTier');

        await page.reload();
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expectLocation(page, '/project/loan-repayment/pricingTier');
        await expect(page.getByTestId('row-pricingTier')).toBeVisible();
        await expect(entry(page, 'ruleset', 'pricingTier')).toHaveAttribute('aria-selected', 'true');
    });

    test('a typed link opens a nested element in a view, and the model path leads back up', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.goto('/project/loan-repayment/mortgageBook.yearly?view=code');
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expectView(page, 'Code');
        await expect(crumbs(page)).toHaveText(/Loan Repayment.*mortgageBook.*yearly/);
        await expect(page.locator('.cm-content').first()).toContainText('yearlySummary(schedule: repayment.schedule)');

        await crumbs(page).getByRole('button', {name: 'mortgageBook'}).click();
        await expectLocation(page, '/project/loan-repayment/mortgageBook?view=code');
        await openProjectOverview(page);
        await expectLocation(page, '/project/loan-repayment?view=flow');
        await page.getByTestId('shell-workbook-mortgageBook').click();
        await expectLocation(page, '/project/loan-repayment/mortgageBook?view=flow');
    });

    test('a link without a view opens the project home in the Flow view and an element in the Boxed view', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.goto('/project/loan-repayment');
        await expectLocation(page, '/project/loan-repayment?view=flow');
        await expectView(page, 'Flow');
        // The project home replaced the typed link: Back leaves the project.
        await page.goBack();
        await expectLocation(page, '/project/loan-repayment?view=flow');

        await page.goto('/project/loan-repayment/monthlyPayment');
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expectView(page, 'Boxed');
        await expectLocation(page, '/project/loan-repayment/monthlyPayment');
    });

    test('a link with an unknown view opens the default view and drops the view from the address bar', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.goto('/project/loan-repayment/monthlyPayment?view=bogus');
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expectView(page, 'Boxed');
        await expectLocation(page, '/project/loan-repayment/monthlyPayment');
    });

    test('a link to an element that does not exist falls back to the project home, and Back skips it', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.goto('/project/loan-repayment/monthlyPayment?view=code');
        await expectView(page, 'Code');
        await page.goto('/project/loan-repayment/doesNotExist');
        await expectLocation(page, '/project/loan-repayment?view=flow');
        await expect(page.getByTestId('shell-workbook-picker')).toBeVisible(SLOW);
        await page.goBack();
        await expectLocation(page, '/project/loan-repayment/monthlyPayment?view=code');
    });

    test('a link to a project that is not in the workspace says so and leads to the Workspace', async ({page}) => {
        // A first visit: the stable example paths do not exist until the user copies the example.
        await page.goto(`/project/${LOAN_ORIGINATION.id}`);
        const alert = page.getByRole('alert').filter({hasText: 'The project did not open'});
        await expect(alert).toBeVisible(SLOW);
        await expect(alert).toContainText(`No local project at '${LOAN_ORIGINATION.id}'`);
        await alert.getByRole('button', {name: 'Go to the Workspace'}).click();
        await expectLocation(page, '/workspace');
    });

    test('the Workspace and the Home page open a project by its link', async ({page}) => {
        await copyExample(page, LOAN_ORIGINATION);
        await page.goto('/workspace');
        await page.getByTestId('project-panel').getByRole('link', {name: LOAN_ORIGINATION.name}).click(SLOW);
        await expectLocation(page, '/project/loan-origination?view=flow');
        await expectProjectOpen(page, LOAN_ORIGINATION.name);
        await expect(explorer(page)).toBeVisible();

        // The Home page lists the recent projects too.
        await page.goto('/');
        await page
            .getByRole('region', {name: 'Recent projects'})
            .getByRole('link', {name: LOAN_ORIGINATION.name})
            .click(SLOW);
        await expectLocation(page, '/project/loan-origination?view=flow');
    });
});
