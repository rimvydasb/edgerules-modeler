import {test, expect, type Page} from '../support/fixtures';
import {
    createBlankProject,
    crumbs,
    entry,
    expectLocation,
    expectSaved,
    explorer,
    LOAN_ORIGINATION,
    LOAN_REPAYMENT,
    openExample,
    SLOW,
    view,
} from '../support/app';
import {
    appendListItem,
    chooseRowAction,
    columnHeaders,
    commitExpression,
    dragRow,
    renameRow,
    replaceActiveExpression,
    valueCell,
} from '../support/boxed';
import {expectHeaders, renameHeader, retypeHeader} from '../support/columns';

// The Boxed view of the app: a model built row by row from a blank project, and the structural edits of the published
// examples (renames that migrate references, decision tables, rejected edits). The app renders in StrictMode, where a
// cell editor that commits on the second mount closes the moment it opens.

async function editTableCell(page: Page, row: string, index: number, value: string): Promise<void> {
    await valueCell(page, row).locator('span[tabindex="0"]').nth(index).click();
    await replaceActiveExpression(page, value);
    await page.keyboard.press('Enter');
}

async function modelCode(page: Page): Promise<string> {
    await view(page, 'Code').click();
    const code = page.locator('.cm-content').first();
    await expect(code).toBeVisible();
    // CodeMirror renders the lines in view only: read the whole document from its state.
    return code.evaluate((element) => {
        const view = (element as HTMLElement & {cmView?: {view: {state: {doc: {toString(): string}}}}}).cmView;
        return view?.view.state.doc.toString() ?? (element as HTMLElement).innerText;
    });
}

test('a blank project becomes a loan decisioning model, row by row, and survives failed edits on the way', async ({
    page,
}) => {
    test.setTimeout(240_000);
    await createBlankProject(page, 'Lending');
    await view(page, 'Boxed').click();
    await expectLocation(page, '/project/lending?view=boxed');
    await expect(page.getByTestId('row-*')).toBeVisible();

    await test.step('a context, a type and a typed field', async () => {
        await page.getByTestId('append-*').click();
        await chooseRowAction(page, 'field', 'Convert to context');
        await renameRow(page, 'field', 'application');
        for (const [name, value] of [
            ['applicationDate', '@"2026-03-01"'],
            ['loanAmount', '250000'],
            ['propertyValue', '320000'],
        ]) {
            await page.getByTestId('append-application').click();
            const path = await renameRow(page, 'application.field', name);
            await commitExpression(page, path, value);
        }
        await chooseRowAction(page, '*', 'Add type');
        await renameRow(page, 'Type', 'Applicant');
        for (const name of ['name', 'age', 'income']) {
            await chooseRowAction(page, 'Applicant', 'Add field');
            const path = await renameRow(page, 'Applicant.field', name);
            await commitExpression(page, path, `<${name === 'name' ? 'string' : 'number'}>`);
        }
        await page.getByTestId('append-application').click();
        const applicant = await renameRow(page, 'application.field', 'applicant');
        await commitExpression(page, applicant, '<Applicant, required: true>');
        // The explorer lists what the Boxed view creates.
        await expect(entry(page, 'type', 'Applicant')).toBeVisible();
    });

    await test.step('a list and a relation', async () => {
        await chooseRowAction(page, '*', 'Add list');
        await renameRow(page, 'list', 'requiredDocuments');
        for (const [index, value] of ['"payslip"', '"bank-statement"', '"property-valuation"'].entries()) {
            await appendListItem(page, 'requiredDocuments', index, value);
        }
        await chooseRowAction(page, '*', 'Add relation');
        await renameRow(page, 'relation', 'collateralProperties');
        for (let index = 0; index < 3; index += 1) await chooseRowAction(page, 'collateralProperties', 'Add column');
        await renameHeader(page, 'collateralProperties', 'column', 'address');
        await renameHeader(page, 'collateralProperties', 'column2', 'value');
        await renameHeader(page, 'collateralProperties', 'column3', 'propertyType');
        await editTableCell(page, 'collateralProperties[0]', 2, '"residential"');
        await editTableCell(page, 'collateralProperties[0]', 1, '320000');
        await editTableCell(page, 'collateralProperties[0]', 0, '{ street: "Gedimino 9"; city: "Vilnius" }');
        await page.getByTestId('append-collateralProperties').click();
        await expect(page.getByTestId('row-collateralProperties[1]')).toBeVisible();
        await commitExpression(page, 'collateralProperties[1].address.street', '"Laisves 12"');
        await commitExpression(page, 'collateralProperties[1].address.city', '"Kaunas"');
    });

    await test.step('functions with arguments; a parse error and a broken call are rejected and recovered', async () => {
        await chooseRowAction(page, '*', 'Add function');
        await renameRow(page, 'function', 'monthlyPayment');
        for (let index = 0; index < 3; index += 1) await chooseRowAction(page, 'monthlyPayment', 'Add argument');
        for (const [from, to] of [
            ['arg', 'amount'],
            ['arg2', 'annualRate'],
            ['arg3', 'years'],
        ] as const) {
            await renameHeader(page, 'monthlyPayment', from, to);
            await retypeHeader(page, 'monthlyPayment', to, 'number');
        }
        await expectHeaders(page, 'monthlyPayment', ['amount', 'annualRate', 'years']);
        await commitExpression(page, 'monthlyPayment.result', 'amount * (1 + annualRate * years) / (12 * years)');

        // A parse error stays in the cell with its message; the fix commits.
        await valueCell(page, 'monthlyPayment.result').click();
        await replaceActiveExpression(page, 'amount /');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toContainText('Expected a value after "/"');
        await replaceActiveExpression(page, 'amount * (1 + annualRate * years) / (12 * years)');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toHaveCount(0);

        // The body reads `years`: deleting it is rejected with a visible error.
        await chooseRowAction(page, 'monthlyPayment', 'Delete "years" argument');
        await expect(page.getByTestId('row-error-monthlyPayment')).toBeVisible();
        await expectHeaders(page, 'monthlyPayment', ['amount', 'annualRate', 'years']);
        // An unused argument is added and deleted.
        await chooseRowAction(page, 'monthlyPayment', 'Add argument');
        await renameHeader(page, 'monthlyPayment', 'arg', 'unused');
        await chooseRowAction(page, 'monthlyPayment', 'Delete "unused" argument');
        await expectHeaders(page, 'monthlyPayment', ['amount', 'annualRate', 'years']);

        await chooseRowAction(page, 'application', 'Add function');
        await renameRow(page, 'application.function', 'loanToValue');
        await chooseRowAction(page, 'application.loanToValue', 'Add argument');
        await chooseRowAction(page, 'application.loanToValue', 'Add argument');
        await renameHeader(page, 'application.loanToValue', 'arg', 'amount');
        await renameHeader(page, 'application.loanToValue', 'arg2', 'value');
        await retypeHeader(page, 'application.loanToValue', 'amount', 'number');
        await retypeHeader(page, 'application.loanToValue', 'value', 'number');
        await commitExpression(page, 'application.loanToValue.result', 'amount / value');
    });

    await test.step('a decision table with conditions, actions, rules and a default', async () => {
        await chooseRowAction(page, '*', 'Add decision table');
        await renameRow(page, 'decisionTable', 'riskTier');
        for (let index = 0; index < 3; index += 1) await chooseRowAction(page, 'riskTier', 'Add condition column');
        for (let index = 0; index < 2; index += 1) await chooseRowAction(page, 'riskTier', 'Add action column');
        for (const [from, to] of [
            ['condition', 'age'],
            ['condition2', 'income'],
            ['condition3', 'ltv'],
        ] as const) {
            await renameHeader(page, 'riskTier', from, to);
            await retypeHeader(page, 'riskTier', to, 'number');
        }
        await renameHeader(page, 'riskTier', 'action', 'tier');
        await renameHeader(page, 'riskTier', 'action2', 'maxExposure');
        for (let index = 0; index < 3; index += 1) await page.getByTestId('append-riskTier').click();
        for (const [row, values] of [
            ['riskTier.rules[0]', ['18..25', '< 30000', '> 0.8', '"high"', '1000000']],
            ['riskTier.rules[1]', ['26..64', '>= 30000', '', '"medium"', '5000000']],
            ['riskTier.rules[2]', ['>= 65', '', '', '"low"', '2000000']],
        ] as const) {
            for (let index = values.length - 1; index >= 0; index -= 1)
                await editTableCell(page, row, index, values[index]);
        }
        for (const [index, value] of ['"declined"', '0'].entries())
            await editTableCell(page, 'riskTier.default', index, value);

        await page.getByTestId('row-riskTier.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'best-match'}).click();
        await page.getByTestId('row-riskTier.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'first-match'}).click();

        await chooseRowAction(page, '*', 'Add field');
        await renameRow(page, 'field', 'riskResult');
        await commitExpression(page, 'riskResult', 'riskTier(age: 20, income: 25000, ltv: 0.9)');
    });

    await test.step('renames migrate every reference; rules are moved, duplicated and deleted', async () => {
        await renameRow(page, 'application', 'loanApplication');
        await renameRow(page, 'loanApplication.loanAmount', 'requestedAmount');
        await renameHeader(page, 'collateralProperties', 'propertyType', 'usageType');
        await expect(valueCell(page, 'riskResult')).toContainText('riskTier');

        // The order of the rules is checked after every step: a drag that does not land would go unnoticed.
        const tiers = () =>
            page
                .getByTestId(/^row-riskTier\.rules\[\d+\]$/)
                .evaluateAll((rows) => rows.map((row) => row.textContent?.match(/"(high|medium|low)"/)?.[1] ?? '-'));
        await expect.poll(tiers).toEqual(['high', 'medium', 'low']);
        await dragRow(page, 'riskTier.rules[1]', 'riskTier.rules[0]');
        await expect.poll(tiers).toEqual(['medium', 'high', 'low']);
        await chooseRowAction(page, 'riskTier.rules[0]', 'Duplicate');
        await expect.poll(tiers).toEqual(['medium', 'medium', 'high', 'low']);
        await chooseRowAction(page, 'riskTier.rules[1]', 'Delete');
        await expect.poll(tiers).toEqual(['medium', 'high', 'low']);
        await dragRow(page, 'riskTier.rules[1]', 'riskTier.rules[0]');
        await expect.poll(tiers).toEqual(['high', 'medium', 'low']);
        // A new rule has no conditions and the actions of the first rule; appended last, it changes nothing for a
        // first-match table.
        await page.getByTestId('append-riskTier').click();
        await expect.poll(tiers).toEqual(['high', 'medium', 'low', 'high']);
        await chooseRowAction(page, 'riskTier.rules[3]', 'Delete');
        await expect.poll(tiers).toEqual(['high', 'medium', 'low']);
        await chooseRowAction(page, 'riskTier', 'Add condition column');
        const added = (await columnHeaders(page, 'riskTier')).find(
            (name) => !['age', 'income', 'ltv', 'tier', 'maxExposure'].includes(name),
        );
        expect(added).toBeTruthy();
        await chooseRowAction(page, 'riskTier', `Delete "${added}" column`);
        await expectHeaders(page, 'riskTier', ['age', 'income', 'ltv', 'tier', 'maxExposure']);
    });

    await test.step('the model is saved, the Code view shows it, and its tests show the computed values', async () => {
        const code = await modelCode(page);
        for (const text of [
            'type Applicant',
            'loanApplication: {',
            'requestedAmount: 250000',
            'func monthlyPayment(amount: number, annualRate: number, years: number)',
            'ruleset riskTier(',
            'riskResult: riskTier(age: 20, income: 25000, ltv: 0.9)',
        ]) {
            expect(code, text).toContain(text);
        }
        await expectSaved(page, 'lending', 'riskResult: riskTier(age: 20, income: 25000, ltv: 0.9)');
        await page.reload();
        await expect(page.locator('.cm-content').first()).toContainText('ruleset riskTier', SLOW);

        await view(page, 'Tests').click();
        await page.getByRole('menuitem', {name: 'Create Tests'}).click();
        await expectLocation(page, '/project/lending?view=tests');
        await expect(page.getByTestId('validation-riskResult.tier')).toHaveText('high', SLOW);
        await expect(page.getByTestId('validation-loanApplication.requestedAmount')).toHaveText('250000');
    });
});

test.describe('a decision table of a published example', () => {
    test.beforeEach(async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'pricingTier'});
        await expect(page.getByTestId('row-pricingTier.rules[0]')).toBeVisible(SLOW);
        await page.getByRole('button', {name: 'Show test column'}).click();
    });

    test('a new first rule changes what the table decides, and its own tests report it', async ({page}) => {
        const summary = page.getByTestId('header-row');
        await page.getByTestId('append-pricingTier').click();
        await expect(page.getByTestId('row-pricingTier.rules[4]')).toBeVisible();
        // creditScore, years, tier, premium, approved.
        for (const [index, value] of [...['>= 300', '', '"flat"', '0.01', 'true'].entries()].reverse()) {
            await editTableCell(page, 'pricingTier.rules[4]', index, value);
        }
        await dragRow(page, 'pricingTier.rules[4]', 'pricingTier.rules[0]');
        await expect(page.getByTestId('row-pricingTier.rules[0]')).toContainText('"flat"');

        // Every case now hits the first rule: the tests of the table fail.
        await view(page, 'Tests').click();
        await expectLocation(page, '/project/loan-repayment/pricingTier?view=tests');
        await expect(page.locator('[data-mismatch="true"]').first()).toBeVisible(SLOW);

        // Deleting the rule restores the table.
        await view(page, 'Boxed').click();
        await chooseRowAction(page, 'pricingTier.rules[0]', 'Delete');
        await expect(page.getByTestId('row-pricingTier.rules[0]')).not.toContainText('"flat"');
        await view(page, 'Tests').click();
        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0, SLOW);
        await expect(summary).toHaveCount(0);
    });

    test('the default row is edited in place and has no Delete or Duplicate', async ({page}) => {
        await expect(page.getByTestId('row-pricingTier.default')).toBeVisible();
        await expect(
            page.getByTestId('row-pricingTier.default').getByRole('button', {name: 'Open row actions'}),
        ).toHaveCount(0);

        await editTableCell(page, 'pricingTier.default', 0, '"manual review"');
        await expect(page.getByTestId('row-pricingTier.default')).toContainText('"manual review"');
        await expectSaved(page, 'loan-repayment', 'tier: \\"manual review\\"');
    });

    test('a broken condition is rejected visibly and the table keeps working', async ({page}) => {
        await valueCell(page, 'pricingTier.rules[0]').locator('span[tabindex="0"]').first().click();
        await replaceActiveExpression(page, '>= ');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert').first()).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('row-pricingTier.rules[0]')).toContainText('>= 760');
        // An unrelated edit still commits.
        await editTableCell(page, 'pricingTier.rules[1]', 2, '0.008');
        await expect(page.getByTestId('row-pricingTier.rules[1]')).toContainText('0.008');
    });
});

test.describe('renames in a published example migrate every reference', () => {
    test('renaming a function renames its calls, its tests and its explorer entry', async ({page}) => {
        await openExample(page, LOAN_ORIGINATION, {path: 'affordability'});
        await renameRow(page, 'affordability', 'repaymentCapacity');
        await expectLocation(page, '/project/loan-origination/repaymentCapacity');
        await expect(crumbs(page)).toContainText('repaymentCapacity(...)');
        await expect(entry(page, 'function', 'repaymentCapacity')).toHaveAttribute('aria-selected', 'true');
        await expect(entry(page, 'function', 'affordability')).toHaveCount(0);
        await expect(entry(page, 'test', 'repaymentCapacity')).toBeVisible();

        await entry(page, 'decision', 'LoanDecision').click();
        await expect(valueCell(page, 'LoanDecision.affordability')).toContainText('repaymentCapacity(');

        // The tests of the function followed it and still pass.
        await entry(page, 'test', 'repaymentCapacity').click();
        await expectLocation(page, '/project/loan-origination/repaymentCapacity?view=tests');
        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(page.getByTestId(/^assertion-summary-/).first()).toBeVisible(SLOW);
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);

        await expectSaved(page, 'loan-origination', 'func repaymentCapacity(');
        await page.reload();
        await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
        await expect(explorer(page).getByText('repaymentCapacity(...)', {exact: true}).first()).toBeVisible();
    });

    test('renaming a field of a decision renames the reads of every other decision', async ({page}) => {
        await openExample(page, LOAN_ORIGINATION, {path: 'HouseholdRisk'});
        await renameRow(page, 'HouseholdRisk.score', 'weakestScore');
        await expect(valueCell(page, 'HouseholdRisk.grade')).toContainText('riskGrade(weakestScore)');
        await entry(page, 'service', 'loanOriginationDecision').click();
        // A service opens in its Flow view: the return node reads the renamed field.
        await expectLocation(page, '/project/loan-origination/loanOriginationDecision?view=flow');
        await expect(page.getByRole('button', {name: 'Value of householdScore'})).toHaveText(
            'application.HouseholdRisk.weakestScore',
            SLOW,
        );
        // The service tests still pass with the renamed field.
        await view(page, 'Tests').click();
        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(page.getByTestId(/^assertion-summary-/).first()).toHaveText('11/11', SLOW);
    });
});

test('deleting a row that others read names the broken reference until it is repaired', async ({page}) => {
    await openExample(page, LOAN_REPAYMENT, {view: 'boxed'});
    await chooseRowAction(page, 'sampleRequest', 'Delete');
    const banner = page.getByRole('alert').filter({hasText: 'sampleRequest'}).first();
    await expect(banner).toBeVisible(SLOW);
    // An unrelated edit is still accepted while the reference is broken.
    await chooseRowAction(page, '*', 'Add field');
    await expect(page.getByTestId('row-field')).toBeVisible();
    await commitExpression(
        page,
        'samplePayment',
        'loanRepayment(request: { amount: 25000; years: 3; creditScore: 700 }).payment',
    );
    await expect(page.getByRole('alert').filter({hasText: 'sampleRequest'})).toHaveCount(0);
});

test.describe('a new decision table', () => {
    test.beforeEach(async ({page}) => {
        await createBlankProject(page, 'Rules');
        await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
        await page.getByRole('menuitem', {name: 'Ruleset', exact: true}).click();
        const form = page.getByRole('dialog', {name: 'New ruleset'});
        await form.getByRole('textbox', {name: 'Name'}).fill('scorecard');
        await form.getByRole('button', {name: 'Create'}).click();
        await expect(form).toHaveCount(0);
        await view(page, 'Boxed').click();
        await expect(page.getByTestId('row-scorecard.default')).toBeVisible(SLOW);
    });

    test('collect-matches on a table without rules keeps the default result as its first rule', async ({page}) => {
        await expect(page.getByTestId('row-scorecard.rules[0]')).toHaveCount(0);
        await page.getByTestId('row-scorecard.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'collect-matches'}).click();
        // The engine refuses a ruleset with no rules and no default (E308): the default becomes a rule that matches
        // every value.
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByTestId('row-scorecard.default')).toHaveCount(0);
        await expect(page.getByTestId('row-scorecard.rules[0]')).toBeVisible();
        await expect(page.getByTestId('row-scorecard.hitPolicy')).toContainText('collect-matches');
        expect(await modelCode(page)).toContain('hitPolicy: "collect-matches"');
    });

    test('a rejected cell is checked again when the model changes, and applies once the cause is gone', async ({
        page,
    }) => {
        await page.getByTestId('append-scorecard').click();
        await page.getByTestId('append-scorecard').click();
        await expect(page.getByTestId('row-scorecard.rules[1]')).toBeVisible();
        // The other rule and the default hold a number: a string in one rule is rejected.
        await editTableCell(page, 'scorecard.rules[0]', 1, '"AGE"');
        await expect(page.getByRole('alert')).toContainText('E307');
        await expect(page.locator('.cm-editor')).toHaveCount(1);

        // One cause of the error goes; the default still holds a number: the error stays.
        await chooseRowAction(page, 'scorecard.rules[1]', 'Delete');
        await expect(page.getByTestId('row-scorecard.rules[1]')).toHaveCount(0);
        await expect(page.getByRole('alert')).toContainText('E307');

        // "collect-matches" drops the default: the cell is consistent with the model now and applies.
        await page.getByTestId('row-scorecard.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'collect-matches'}).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.locator('.cm-editor')).toHaveCount(0);
        await expect(valueCell(page, 'scorecard.rules[0]')).toContainText('"AGE"');
        expect(await modelCode(page)).toContain('"AGE"');
    });
});
