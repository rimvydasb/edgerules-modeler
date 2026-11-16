import {test, expect, type Page} from '../support/fixtures';
import {
    copyExample,
    crumbs,
    entry,
    expectLocation,
    expectProjectOpen,
    expectSaved,
    expectView,
    explorer,
    flowNode,
    LOAN_REPAYMENT,
    openExample,
    openProjectOverview,
    section,
    SLOW,
    view,
} from '../support/app';

// The Shell of a project over the published Loan Repayment example: the header (project menu, model path, settings,
// views, split screen), the project overview, the Project Explorer that follows the shown element, the README, and the
// settings of the model and of a workbook. Each change of the shown element is checked in the address bar too.

const PROJECT = '/project/loan-repayment';

async function saveSettings(page: Page, values: Record<string, string>): Promise<void> {
    const dialog = page.getByRole('dialog');
    for (const [label, value] of Object.entries(values)) await dialog.getByRole('textbox', {name: label}).fill(value);
    await dialog.getByRole('button', {name: 'Save'}).click();
    await expect(dialog).toHaveCount(0);
}

test.describe('the header', () => {
    test('shows the project menu, the settings, the views and then the split screen toggle', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        const views = page.getByRole('radiogroup', {name: 'View'}).getByRole('radio');
        await expect(views).toHaveText(['Overview', 'DRD', 'Boxed', 'Code', 'Tests']);
        const settings = (await page.getByRole('button', {name: 'Model settings'}).boundingBox())!;
        const first = (await views.first().boundingBox())!;
        const last = (await views.last().boundingBox())!;
        const split = (await page.getByTestId('shell-split-toggle').boundingBox())!;
        expect(settings.x).toBeLessThan(first.x);
        expect(last.x).toBeLessThan(split.x);

        await page.getByRole('button', {name: 'Project menu: Loan Repayment'}).click();
        await expect(page.getByRole('menuitem')).toHaveText([
            'Project Overview',
            'Tests Overview',
            'README.md',
            'View original example',
        ]);
    });

    test('the kind icon opens the main view: Flow for the model and a workbook, Boxed for a decision table', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await view(page, 'Boxed').click();
        await expectLocation(page, `${PROJECT}?view=boxed`);
        await page.getByRole('button', {name: 'Open in the Flow view'}).click();
        await expectView(page, 'Flow');
        await expectLocation(page, `${PROJECT}?view=flow`);
        await expect(explorer(page).getByRole('tree')).toBeVisible();

        await page.getByTestId('shell-workbook-mortgageBook').click();
        await view(page, 'Boxed').click();
        await expectLocation(page, `${PROJECT}/mortgageBook`);
        await expect(page.getByTestId('row-mortgageBook')).toBeVisible();
        await page.getByRole('button', {name: 'Open in the Flow view'}).click();
        await expectLocation(page, `${PROJECT}/mortgageBook?view=flow`);
        await expect(flowNode(page, 'mortgageBook.yearly')).toBeVisible(SLOW);

        await entry(page, 'ruleset', 'pricingTier').click();
        await view(page, 'Code').click();
        await expect(page.locator('.cm-content').first()).toContainText('ruleset pricingTier');
        await page.getByRole('button', {name: 'Open in the Boxed view'}).click();
        await expectView(page, 'Boxed');
        await expectLocation(page, `${PROJECT}/pricingTier`);
        await expect(crumbs(page)).toContainText('pricingTier(...)');
    });

    test('Project Overview of the project menu opens the overview from any element and view', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'pricingTier', view: 'code'});
        await openProjectOverview(page);
        await expectLocation(page, `${PROJECT}?view=flow`);
        await expect(page.getByTestId('shell-workbook-picker')).toBeVisible();

        await page.getByTestId('shell-workbook-mortgageBook').click();
        await expect(flowNode(page, 'mortgageBook.yearly')).toBeVisible(SLOW);
        await openProjectOverview(page);
        await expect(page.getByTestId('shell-workbook-picker')).toBeVisible();
        await expectLocation(page, `${PROJECT}?view=flow`);
    });
});

test.describe('the project overview', () => {
    test('shows the README, the service and a panel per workbook with its name, description and counts', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        const picker = page.getByTestId('shell-workbook-picker');
        const readme = picker.getByTestId('shell-readme-panel');
        await expect(readme.getByRole('heading', {name: 'Loan Repayment'})).toBeVisible();
        // Above the workbooks, at most 260px high, and cut off with a fade.
        const readmeBox = (await readme.boundingBox())!;
        const workbookBox = (await picker.getByTestId('shell-workbook-mortgageBook').boundingBox())!;
        expect(readmeBox.y + readmeBox.height).toBeLessThanOrEqual(workbookBox.y);
        expect(readmeBox.height).toBeLessThanOrEqual(261);
        await expect(readme.locator('[data-cut]')).toHaveCount(1);

        const mortgage = picker.getByTestId('shell-workbook-mortgageBook');
        await expect(mortgage).toHaveAccessibleName('Mortgage plan');
        await expect(mortgage).toContainText('A 250 000 mortgage over 25 years');
        await expect(mortgage).toContainText('1 input · 2 functions');
        const terms = picker.getByTestId('shell-workbook-termComparisonBook');
        await expect(terms).toHaveAccessibleName('15 vs 30 years');
        await expect(terms).toContainText('2 inputs · 3 functions');
        await expect(picker.getByTestId('shell-service-loanRepayment')).toContainText('1 argument');

        await picker.getByTestId('shell-service-loanRepayment').click();
        await expectLocation(page, `${PROJECT}/loanRepayment?view=flow`);
        await expect(page.getByTestId('parameter-node-loanRepayment.request')).toBeVisible(SLOW);
        await expect(entry(page, 'service', 'loanRepayment')).toHaveAttribute('aria-selected', 'true');
    });

    test('the tests card runs every suite of the project', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        const card = page.getByTestId('shell-tests-card');
        await expect(card).toContainText('3 suites');
        await expect(card).toContainText('13 not run');
        await card.getByRole('button', {name: 'Run all'}).click();
        await expect(card).toContainText('13 passed', SLOW);
        await expect(card).not.toContainText('failed');

        await card.getByRole('button', {name: 'All Tests'}).click();
        await expect(page.getByRole('heading', {name: 'Tests Overview'})).toBeVisible();
        await expectLocation(page, `${PROJECT}/tests:overview?view=tests`);
        // The project menu opens the same page.
        await page.goBack();
        await page.getByRole('button', {name: 'Project menu: Loan Repayment'}).click();
        await page.getByRole('menuitem', {name: 'Tests Overview'}).click();
        await expectLocation(page, `${PROJECT}/tests:overview?view=tests`);
    });
});

test.describe('the Project Explorer follows the shown element', () => {
    test('a service and a method opened from their Flow nodes expand their collapsed section and are selected', async ({
        page,
    }) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
        await expect(flowNode(page, 'mortgageBook.yearly')).toBeVisible(SLOW);
        await expect(entry(page, 'workbook', 'mortgageBook')).toHaveAttribute('aria-selected', 'true');

        await section(page, 'Service Methods').click();
        await section(page, 'Methods').click();
        await expect(entry(page, 'service', 'loanRepayment')).toBeHidden();
        await expect(entry(page, 'function', 'yearlySummary')).toBeHidden();

        await page.getByRole('button', {name: 'Open loanRepayment in boxed editor'}).click();
        await expectView(page, 'Boxed');
        await expectLocation(page, `${PROJECT}/loanRepayment`);
        await expect(entry(page, 'service', 'loanRepayment')).toHaveAttribute('aria-selected', 'true');
        await expect(entry(page, 'workbook', 'mortgageBook')).toHaveAttribute('aria-selected', 'false');

        await page.goBack();
        await expect(flowNode(page, 'mortgageBook.yearly')).toBeVisible(SLOW);
        await page.getByRole('button', {name: 'Open yearlySummary in boxed editor'}).click();
        await expectLocation(page, `${PROJECT}/yearlySummary`);
        await expect(entry(page, 'function', 'yearlySummary')).toBeVisible();
        await expect(entry(page, 'function', 'yearlySummary')).toHaveAttribute('aria-selected', 'true');
    });

    test('the tests of a subject and its method are selected in their own sections', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment', view: 'tests'});
        await expect(entry(page, 'test', 'loanRepayment')).toHaveAttribute('aria-selected', 'true', SLOW);
        await expect(entry(page, 'service', 'loanRepayment')).toHaveAttribute('aria-selected', 'false');
        await view(page, 'Boxed').click();
        await expect(entry(page, 'service', 'loanRepayment')).toHaveAttribute('aria-selected', 'true');
        await expect(entry(page, 'test', 'loanRepayment')).toHaveAttribute('aria-selected', 'false');
    });

    test('a type stays selected while its section collapses and opens again', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await entry(page, 'type', 'LoanRequest').click();
        await expectLocation(page, `${PROJECT}/LoanRequest`);
        await expect(entry(page, 'type', 'LoanRequest')).toHaveAttribute('aria-selected', 'true');
        await section(page, 'Types').click();
        await expect(entry(page, 'type', 'LoanRequest')).toBeHidden();
        // Another view of the same element keeps the section the user collapsed, and the selection.
        await view(page, 'Code').click();
        await page.getByRole('button', {name: 'Open in the Boxed view'}).click();
        await expect(entry(page, 'type', 'LoanRequest')).toBeHidden();
        await section(page, 'Types').click();
        await expect(entry(page, 'type', 'LoanRequest')).toHaveAttribute('aria-selected', 'true');
    });

    test('the search of the explorer narrows the entries', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await explorer(page).getByRole('textbox', {name: 'Search project'}).fill('payment');
        await expect(entry(page, 'function', 'monthlyPayment')).toBeVisible();
        await expect(entry(page, 'variable', 'samplePayment')).toBeVisible();
        await expect(entry(page, 'ruleset', 'pricingTier')).toHaveCount(0);
    });
});

test.describe('the Add buttons of the Project Explorer', () => {
    test('Methods offers a function and a ruleset; a new function opens in its Boxed view and is saved', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
        await expect(page.getByRole('menuitem')).toHaveText(['Function', 'Ruleset']);
        await page.getByRole('menuitem', {name: 'Function'}).click();
        const dialog = page.getByRole('dialog', {name: 'New function'});
        await dialog.getByRole('textbox', {name: 'Name'}).fill('downPayment');
        await dialog.getByRole('button', {name: 'Create'}).click();
        await expectLocation(page, `${PROJECT}/downPayment`);
        await expect(page.getByTestId('row-downPayment')).toBeVisible();
        await expect(entry(page, 'function', 'downPayment')).toHaveAttribute('aria-selected', 'true');

        await expectSaved(page, 'loan-repayment', 'func downPayment(');
        await page.reload();
        await expect(page.getByTestId('row-downPayment')).toBeVisible(SLOW);
    });

    test('a name that is taken is refused, and Cancel creates nothing', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
        await page.getByRole('menuitem', {name: 'Ruleset'}).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('textbox', {name: 'Name'}).fill('pricingTier');
        await dialog.getByRole('button', {name: 'Create'}).click();
        await expect(dialog).toBeVisible();
        await expect(entry(page, 'ruleset', 'pricingTier')).toHaveCount(1);
        await dialog.getByRole('button', {name: 'Cancel'}).click();
        await expect(dialog).toHaveCount(0);
        await expectLocation(page, `${PROJECT}?view=flow`);
    });
});

test.describe('the Boxed view and the split screen', () => {
    test('each element keeps its own description and test column toggles', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {view: 'boxed'});
        await page.getByTestId('row-*').getByRole('button', {name: 'Hide description'}).click();
        await expect(page.getByRole('button', {name: 'Show description'})).toBeVisible();

        await entry(page, 'ruleset', 'pricingTier').click();
        await expect(page.getByTestId('row-pricingTier')).toBeVisible();
        await expect(page.getByRole('button', {name: 'Hide description'})).toBeVisible();
        await page.getByRole('button', {name: 'Show test column'}).click();
        await expect(page.getByRole('button', {name: 'Hide test column'})).toBeVisible();

        await openProjectOverview(page);
        await view(page, 'Boxed').click();
        await expect(page.getByTestId('row-*').getByRole('button', {name: 'Show description'})).toBeVisible();
        await expect(page.getByRole('button', {name: 'Show test column'})).toBeVisible();

        await entry(page, 'ruleset', 'pricingTier').click();
        await expect(page.getByRole('button', {name: 'Hide test column'})).toBeVisible();
        await expect(page.getByTestId('row-pricingTier').locator('[data-column="test-results"]')).toBeVisible();
    });

    test('the split screen shows the selected node; Expand opens it in the Boxed view, the path leads back', async ({
        page,
    }) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
        const yearly = flowNode(page, 'mortgageBook.yearly');
        await expect(yearly).toBeVisible(SLOW);
        await yearly.click({position: {x: 30, y: 10}});
        const panel = page.getByTestId('shell-split-panel');
        await expect(panel.getByTestId('row-yearlySummary.result')).toBeVisible();
        await expect(panel.getByRole('button', {name: 'Show description'})).toBeVisible();
        await expect(panel.locator('[data-column="description"]')).toHaveCount(0);
        await expect(panel.locator('[data-column="test-results"]')).toHaveCount(0);

        // The split screen toggle hides the panel.
        await page.getByTestId('shell-split-toggle').click();
        await expect(panel).toHaveCount(0);
        await page.getByTestId('shell-split-toggle').click();
        await yearly.click({position: {x: 30, y: 10}});

        await page.getByTestId('shell-split-panel').getByRole('button', {name: 'Expand'}).click();
        await expect(crumbs(page)).toHaveText(/Loan Repayment.*Mortgage plan.*yearlySummary\(\.\.\.\)/);
        await expectView(page, 'Boxed');
        await expectLocation(page, `${PROJECT}/yearlySummary`);
        await crumbs(page).getByRole('button', {name: 'Mortgage plan'}).click();
        await expect(yearly).toBeVisible(SLOW);
        await expectLocation(page, `${PROJECT}/mortgageBook?view=flow`);
    });
});

test.describe('settings', () => {
    test('the settings dialog is a sharp sheet of glass that blurs the page behind it', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.getByRole('button', {name: 'Model settings'}).click();
        const dialog = page.getByRole('dialog', {name: 'Model settings'});
        const style = await dialog.evaluate((element) => {
            const computed = getComputedStyle(element);
            return {
                radius: computed.borderTopLeftRadius,
                blur: computed.backdropFilter || computed.getPropertyValue('-webkit-backdrop-filter'),
                background: computed.backgroundColor,
            };
        });
        expect(style.radius).toBe('0px');
        expect(style.blur).toContain('blur(');
        expect(style.background).toMatch(/rgba?\(.*,\s*0?\.\d+\)|color\(.*\/\s*0?\.\d+\)|oklab\(.*\/\s*0?\.\d+\)/);
        for (const button of ['Cancel', 'Save']) {
            const radius = await dialog
                .getByRole('button', {name: button})
                .evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
            expect(radius, button).toBe('0px');
        }
        await dialog.getByRole('button', {name: 'Cancel'}).click();
        await expect(dialog).toHaveCount(0);
    });

    test('the model settings set the name, version and description of the model, and keep them after a reload', async ({
        page,
    }) => {
        await openExample(page, LOAN_REPAYMENT, {view: 'boxed'});
        await expect(page.getByTestId('row-*').getByRole('heading')).toHaveText('Loan Repayment');
        // The Boxed Editor has no settings of its own: the Shell header has them.
        await expect(page.getByTestId('row-*').getByRole('button', {name: 'Model settings'})).toHaveCount(0);

        await page.getByRole('button', {name: 'Model settings'}).click();
        const dialog = page.getByRole('dialog', {name: 'Model settings'});
        await expect(dialog.getByRole('textbox', {name: 'Name'})).toHaveValue('Loan Repayment');
        await expect(dialog.getByRole('textbox', {name: 'Version'})).toHaveValue('1.2.0');
        await expect(dialog.getByRole('textbox', {name: 'Description'})).toHaveValue(/^Prices consumer loans/);
        await saveSettings(page, {Name: 'Retail Lending', Version: '1.3.0', Description: 'Prices retail loans'});

        await expect(page.getByTestId('row-*').getByRole('heading')).toHaveText('Retail Lending');
        await expect(page.getByRole('textbox', {name: 'description *'})).toHaveValue('Prices retail loans');

        // The model is saved: a reload keeps it. The URL of the project does not change with the model name.
        await expectSaved(page, 'loan-repayment', 'Retail Lending');
        await page.reload();
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expectLocation(page, `${PROJECT}?view=boxed`);
        await expect(page.getByTestId('row-*').getByRole('heading')).toHaveText('Retail Lending', SLOW);
        await page.getByRole('button', {name: 'Model settings'}).click();
        await expect(dialog.getByRole('textbox', {name: 'Version'})).toHaveValue('1.3.0');
    });

    test('the workbook settings rename the @Name of a workbook; a decision table has no settings', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
        await page.getByRole('button', {name: 'Workbook settings'}).click(SLOW);
        const dialog = page.getByRole('dialog', {name: 'Workbook settings'});
        await expect(dialog.getByRole('textbox', {name: 'Name'})).toHaveValue('Mortgage plan');
        await expect(dialog.getByRole('textbox', {name: 'Version'})).toHaveCount(0);
        await saveSettings(page, {Name: 'Family home', Description: 'The mortgage of a family home'});

        // The field keeps its name; its @Name gets the new one.
        await openProjectOverview(page);
        await view(page, 'Code').click();
        const code = page.locator('.cm-content').first();
        await code.click();
        await page.keyboard.press('ControlOrMeta+End');
        await expect(code).toContainText('@Name("Family home")');
        await expect(code).toContainText('workbook mortgageBook: {');

        await openProjectOverview(page);
        const mortgage = page.getByTestId('shell-workbook-mortgageBook');
        await expect(mortgage).toHaveAccessibleName('Family home');
        await expect(mortgage).toContainText('The mortgage of a family home');
        await expect(entry(page, 'workbook', 'mortgageBook')).toContainText('Family home');

        await entry(page, 'ruleset', 'pricingTier').click();
        await expect(page.getByTestId('row-pricingTier')).toBeVisible();
        await expect(page.getByTestId('shell-settings')).toHaveCount(0);
    });
});

test.describe('the README', () => {
    test('opens in the Preview view; a model: link opens that element', async ({page}) => {
        await copyExample(page, LOAN_REPAYMENT);
        await explorer(page).getByText('README.md', {exact: true}).click();
        await expect(page.getByRole('radio', {name: 'Preview'})).toBeChecked();
        await expect(page.getByRole('radiogroup', {name: 'View'}).getByRole('radio')).toHaveText(['Preview', 'Code']);
        await expect(crumbs(page)).toHaveText(/Loan Repayment.*README\.md/);
        await expect(page.locator('.cm-editor')).toHaveCount(0);
        const readmeUrl = page.url();

        await page.getByTestId('shell-document-preview').getByRole('link', {name: 'pricingTier'}).first().click();
        await expectLocation(page, `${PROJECT}/pricingTier`);
        await expect(page.getByTestId('row-pricingTier')).toBeVisible();
        await page.goBack();
        expect(page.url()).toBe(readmeUrl);
        await expect(page.getByTestId('shell-document-preview')).toBeVisible();
    });

    test('the README panel of the overview opens the README; an edit in Code is kept after a reload', async ({
        page,
    }) => {
        await copyExample(page, LOAN_REPAYMENT);
        await page.getByTestId('shell-readme-panel').getByRole('button', {name: 'Read README'}).click();
        await expect(page.getByRole('radio', {name: 'Preview'})).toBeChecked();
        await expect(page.getByTestId('shell-document-preview').getByRole('table').first()).toBeVisible();

        await page.getByRole('radio', {name: 'Code'}).click();
        const editor = page.locator('.cm-content');
        await expect(editor).toContainText('# Loan Repayment');
        await editor.click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.type('\nKept after a reload.\n');
        await page.getByRole('radio', {name: 'Preview'}).click();
        await expect(page.getByTestId('shell-document-preview')).toContainText('Kept after a reload.');

        await expectSaved(page, 'loan-repayment', 'Kept after a reload.');
        await page.reload();
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expect(page.getByTestId('shell-document-preview')).toContainText('Kept after a reload.', SLOW);
    });
});
