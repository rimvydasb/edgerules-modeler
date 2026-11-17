import {test, expect} from '../support/fixtures';
import {
    createBlankProject,
    entry,
    expectLocation,
    explorer,
    LOAN_REPAYMENT,
    openExample,
    replaceCode,
    SLOW,
    view,
} from '../support/app';
import {commitExpression, renameRow, valueCell} from '../support/boxed';

// The code editors of the app over the published Loan Repayment example: the Code view of the model and of an element
// (CodeEditor), and the expression cells of the Boxed view (CodeEditorCell), each backed by the language service of
// the real engine.

const ERROR_MARK = '.cm-lintRange-error, .cm-lintPoint-error';

test.describe('the Code view', () => {
    test('highlights EdgeRules: keywords, types, strings and numbers', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {view: 'code'});
        const editor = page.locator('.cm-content').first();
        await expect(editor).toContainText('type LoanRequest');
        for (const token of ['.tok-keyword', '.tok-typeName', '.tok-string', '.tok-number']) {
            await expect(editor.locator(token).first(), token).toBeVisible();
        }
    });

    test('Ctrl+Space completes the names of the model', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment', view: 'code'});
        const line = page.locator('.cm-line', {hasText: 'payment: if pricing.approved then annuity else 0'});
        await line.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' + ');
        await page.keyboard.press('Control+Space');
        const tooltip = page.locator('.cm-tooltip-autocomplete');
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText('pricingTier');
        await expect(tooltip).toContainText('monthlyPayment');
    });

    test('Ctrl+Click on a call selects the definition of the function', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {view: 'code'});
        const usage = page.locator('.cm-line', {hasText: 'func annualRate'}).first();
        await usage.click();
        await usage
            .locator('.tok-function', {hasText: 'pricingTier'})
            .first()
            .click({modifiers: ['ControlOrMeta']});
        await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('pricingTier');
    });

    test('Shift+Alt+F formats the code', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'sampleRequest', view: 'code'});
        const editor = page.locator('.cm-content').first();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.type('\n   badlyIndented:1');
        await page.keyboard.press('Shift+Alt+f');
        await expect(editor).toContainText('badlyIndented: 1');
        await expect(editor).not.toContainText('badlyIndented:1');
    });

    test('a syntax error is marked and never reaches the model; the fix does', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'monthlyPayment', view: 'code'});
        const editor = page.locator('.cm-content').first();
        const line = page.locator('.cm-line', {hasText: 'round(-pmt('}).first();
        await line.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' +');
        // A lint point after the trailing operator: it has no width, so it is counted, not seen.
        await expect(page.locator(ERROR_MARK)).not.toHaveCount(0, SLOW);

        // The Boxed view shows the committed model: the half-typed edit is not in it.
        await view(page, 'Boxed').click();
        await expect(page.getByRole('treegrid')).toContainText('round(-pmt(annualRate / 12, years * 12, amount), 2)');
        await expect(page.getByRole('treegrid')).not.toContainText(', 2) +');

        await view(page, 'Code').click();
        await expect(editor).toContainText(', 2) +');
        await page.locator('.cm-line', {hasText: 'round(-pmt('}).first().click();
        await page.keyboard.press('End');
        await page.keyboard.type(' 1');
        await expect(page.locator(ERROR_MARK)).toHaveCount(0, SLOW);
        await view(page, 'Boxed').click();
        await expect(page.getByRole('treegrid')).toContainText(', 2) + 1', SLOW);
    });
    test('a rejected draft of a type applies once another type fixes its cause', async ({page}) => {
        await createBlankProject(page, 'Owners');
        for (const name of ['Application', 'Applicant']) {
            await explorer(page).getByRole('button', {name: 'Add to Types'}).click();
            const form = page.getByRole('dialog', {name: 'New type'});
            await form.getByRole('textbox', {name: 'Name'}).fill(name);
            await form.getByRole('button', {name: 'Create'}).click();
            await expect(form).toHaveCount(0);
        }
        // The owner needs a parent that holds the applicants, and Application does not hold them yet (E356).
        await view(page, 'Code').click();
        const code = page.locator('.cm-content').first();
        await expect(code).toContainText('value');
        const text = await code.evaluate((element) => (element as HTMLElement).innerText);
        await replaceCode(page, text.replace('{', '{\n    owner application: <Application>'));
        await expect(page.getByTestId('shell-status')).toContainText('E356', SLOW);

        // Application gets the applicants in the Boxed view.
        await explorer(page).getByText('Application', {exact: true}).click();
        await view(page, 'Boxed').click();
        await renameRow(page, 'Application.value', 'applicants');
        await commitExpression(page, 'Application.applicants', '<Applicant[]>');
        await expect(valueCell(page, 'Application.applicants')).toContainText('Applicant[]');

        // Back in Applicant, the draft is applied: no error, and the owner field is in the model.
        await explorer(page).getByText('Applicant', {exact: true}).click();
        await view(page, 'Code').click();
        await expect(page.locator('.cm-content').first()).toContainText('owner application');
        await expect(page.getByTestId('shell-status')).toHaveCount(0, SLOW);
        await view(page, 'Boxed').click();
        await expect(page.getByTestId('row-Applicant.application')).toBeVisible(SLOW);
    });
});

test.describe('the expression cells of the Boxed view', () => {
    test('complete the names of the model and the fields of a record', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment'});
        await valueCell(page, 'loanRepayment.payment').click();
        const editor = page.locator('.cm-content');
        await expect(editor).toHaveCount(1);
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' + request.');
        const tooltip = page.locator('.cm-tooltip-autocomplete');
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText('amount');
        await expect(tooltip).toContainText('creditScore');
        await page.keyboard.press('Escape');
        await expect(editor).toHaveCount(0);
        await expect(valueCell(page, 'loanRepayment.payment')).toHaveText('if pricing.approved then annuity else 0');
    });

    test('mark a syntax error while typing; Escape cancels and keeps the old value', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment'});
        await valueCell(page, 'loanRepayment.payment').click();
        await page.locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.insertText('annuity +');
        await expect(page.locator(ERROR_MARK)).not.toHaveCount(0, SLOW);
        await page.keyboard.press('Escape');
        await expect(valueCell(page, 'loanRepayment.payment')).toHaveText('if pricing.approved then annuity else 0');
    });

    test('reject a name the model does not have on commit, and keep the model', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment'});
        await valueCell(page, 'loanRepayment.payment').click();
        await page.locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.insertText('annuity * noSuchName');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert', {name: 'annuity * noSuchName'})).toContainText(
            "unresolved reference 'noSuchName'",
            SLOW,
        );
        // The rejected edit stays a draft of the cell; the model keeps the old expression.
        await view(page, 'Code').click();
        await expect(page.locator('.cm-content').first()).toContainText(
            'payment: if pricing.approved then annuity else 0',
        );
        await expect(page.locator('.cm-content').first()).not.toContainText('noSuchName');
    });

    test('Enter commits a cell; the Code view shows the edit', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment'});
        await valueCell(page, 'loanRepayment.payment').click();
        await page.locator('.cm-content').click();
        await page.keyboard.press('End');
        await page.keyboard.type(' + 1');
        await page.keyboard.press('Enter');
        await expect(page.locator('.cm-editor')).toHaveCount(0);
        await expect(valueCell(page, 'loanRepayment.payment')).toHaveText(
            'if pricing.approved then annuity else 0 + 1',
        );

        await view(page, 'Code').click();
        await expectLocation(page, '/project/loan-repayment/loanRepayment?view=code');
        await expect(page.locator('.cm-content').first()).toContainText('else 0 + 1');
        await expect(entry(page, 'service', 'loanRepayment')).toHaveAttribute('aria-selected', 'true');
    });
});
