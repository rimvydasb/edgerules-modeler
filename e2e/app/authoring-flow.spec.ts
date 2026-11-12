import {test, expect, type Locator, type Page} from '@playwright/test';
import {LOAN_ORIGINATION_DSL} from '../../models/loan-origination/model';

// The whole authoring flow of the local Modeler (`npm run dev`), not a Storybook story: the app renders in `StrictMode`
// with a development React, which mounts, unmounts and mounts every effect again. A cell editor that commits on that
// remount closed the moment it opened, so no expression, no code cell and no test path could be edited in the app,
// while every Storybook spec (a production build) passed.
//
// One project goes the whole way: a model typed in the Code view, a function edited in the Boxed view and in the Code
// view, then a test that did not exist before, with assertions added, duplicated, retargeted and fixed.

const SLOW = {timeout: 30_000};

function explorer(page: Page): Locator {
    return page.getByRole('navigation', {name: 'Project explorer'});
}

async function createBlankProject(page: Page, name: string): Promise<void> {
    await page.goto('/workspace');
    await page.getByTestId('local-workspace').getByRole('button', {name: 'New project'}).first().click(SLOW);
    await page.getByRole('textbox', {name: 'Name'}).fill(name);
    await page.getByRole('button', {name: 'Create'}).click();
    await expect(page.getByRole('button', {name: `Project menu: ${name}`})).toBeVisible(SLOW);
}

// Replaces the whole text of the Code view. The view commits after an idle time.
async function replaceCode(page: Page, code: string): Promise<void> {
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(code);
}

// Opens the value cell of a Boxed row, replaces its expression and commits it with Enter.
async function editValue(page: Page, path: string, current: RegExp, next: string): Promise<void> {
    const row = page.getByTestId(`row-${path}`);
    await row.getByText(current).first().click();
    const editor = row.locator('.cm-content');
    // The bug: the editor opened, and the StrictMode remount committed and closed it again at once.
    await expect(editor).toBeVisible();
    await page.waitForTimeout(300);
    await expect(editor, 'the cell editor stays open after StrictMode mounts it twice').toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(next);
    await page.keyboard.press('Enter');
    await expect(editor).toHaveCount(0);
}

async function chooseRowMenu(page: Page, path: string, action: string): Promise<void> {
    await page.getByRole('button', {name: `row menu ${path}`, exact: true}).click();
    await page.getByRole('menuitem', {name: action}).click();
}

function assertion(page: Page, path: string): Locator {
    return page.getByRole('textbox', {name: `assertion ${path}`, exact: true});
}

async function fillCell(cell: Locator, text: string): Promise<void> {
    await cell.fill(text);
    await cell.press('Enter');
}

test('a model is written in Code, edited in Boxed and Code, and gets a new test with assertions', async ({page}) => {
    await createBlankProject(page, 'Loan origination');

    // Code view of the model: the whole model typed over the blank one.
    await page.getByRole('radio', {name: 'Code'}).click();
    await replaceCode(page, LOAN_ORIGINATION_DSL);
    await expect(explorer(page).getByText('borrowingCapacity(...)', {exact: true})).toBeVisible(SLOW);

    // Boxed view: the nested function and the result of the body.
    await explorer(page).getByText('borrowingCapacity(...)', {exact: true}).click();
    await page.getByRole('radio', {name: 'Boxed'}).click();
    for (const path of ['affordabilityForTerm', 'affordabilityForTerm.maxLoan', 'result']) {
        await expect(page.getByTestId(`row-borrowingCapacity.${path}`), path).toBeVisible(SLOW);
    }
    await editValue(
        page,
        'borrowingCapacity.result',
        /^for term in \[10, 15, 20, 25, 30\]/,
        'for term in [10, 20, 30] return affordabilityForTerm(householdIncome, householdDebtPayments, rate, term)',
    );
    await expect(page.getByTestId('row-borrowingCapacity.result')).toContainText('[10, 20, 30]');
    // A field of the nested function edits the same way.
    await editValue(page, 'borrowingCapacity.affordabilityForTerm.termYears', /^term$/, 'term + 0');
    await expect(page.getByTestId('row-borrowingCapacity.affordabilityForTerm.termYears')).toContainText('term + 0');

    // Code view of the function: the Boxed edits are there; a code edit goes back to the Boxed view.
    await page.getByRole('radio', {name: 'Code'}).click();
    const code = page.locator('.cm-content').first();
    await expect(code).toContainText('[10, 20, 30]');
    await expect(code).toContainText('termYears: term + 0');
    const text = await code.evaluate((element) => (element as HTMLElement).innerText);
    await replaceCode(page, text.replace('[10, 20, 30]', '[15, 30]').replace('term + 0', 'term'));
    await page.getByRole('radio', {name: 'Boxed'}).click();
    await expect(page.getByTestId('row-borrowingCapacity.result')).toContainText('[15, 30]', SLOW);
    await expect(page.getByTestId('row-borrowingCapacity.affordabilityForTerm.termYears')).not.toContainText('+ 0');

    // Tests view: the function has no tests yet.
    await page.getByRole('radio', {name: 'Tests'}).click();
    await page.getByText('Create Tests').click();
    await fillCell(page.getByRole('textbox', {name: 'input householdIncome'}), '6800');
    await fillCell(page.getByRole('textbox', {name: 'input householdDebtPayments'}), '250');
    await fillCell(page.getByRole('textbox', {name: 'input rate'}), '0.0425');
    await expect(page.getByTestId('validation-result[0].maxLoan')).toHaveText('307823', SLOW);
    const summary = page.getByTestId(/^assertion-summary-/);

    // A validation moved to the Assertions takes the actual value as its expected value.
    await chooseRowMenu(page, 'result[0].maxLoan', 'Move to Assertions');
    await expect(assertion(page, 'result[0].maxLoan')).toHaveValue('307823');
    await expect(summary).toHaveText('1/1');

    // A list is asserted as a whole: its expected value is the JSON of the list, not the "2 items" summary.
    await chooseRowMenu(page, 'result', 'Move to Assertions');
    await expect(assertion(page, 'result')).toHaveValue(/^\[\{"termYears":15,/);
    await expect(summary).toHaveText('2/2');

    // A new assertion: the duplicate of an indexed row is the next element of the list.
    await chooseRowMenu(page, 'result[0].maxLoan', 'Duplicate');
    await fillCell(assertion(page, 'result[1].maxLoan'), '411917');
    await expect(summary).toHaveText('3/3');

    // Retarget the new row in its path cell (a code cell editor): the expected value no longer matches.
    await page.getByRole('button', {name: 'path result[1].maxLoan', exact: true}).click();
    const pathEditor = page.getByTestId('path-editor-result[1].maxLoan').locator('.cm-content');
    await expect(pathEditor).toBeVisible();
    await page.waitForTimeout(300);
    await expect(pathEditor, 'the path editor stays open after StrictMode mounts it twice').toBeVisible();
    await pathEditor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('result[1].maxPayment');
    await page.keyboard.press('Enter');
    await expect(assertion(page, 'result[1].maxPayment')).toHaveAttribute('data-mismatch', 'true');
    await expect(summary).toHaveText('2/3');

    // Fix the expected value: every assertion passes.
    await fillCell(assertion(page, 'result[1].maxPayment'), '2810');
    await expect(summary).toHaveText('3/3');
    await page.getByRole('button', {name: 'Run all'}).click();
    await expect(summary).toHaveText('3/3');
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
});
