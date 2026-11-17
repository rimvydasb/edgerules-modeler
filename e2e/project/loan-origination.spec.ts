import {test, expect, type Page} from '../support/fixtures';
import {
    copyExample,
    crumbs,
    expectLocation,
    expectSaved,
    explorer,
    LOAN_ORIGINATION,
    openExample,
    SLOW,
    view,
} from '../support/app';
import {chooseRowAction, valueCell} from '../support/boxed';
import {expectHeaders, renameHeader, retypeHeader} from '../support/columns';

// The published Loan Origination example in the app: the largest model of the suite (types, facts, decision tables,
// nested functions, a service with 38 tests, two workbooks with charts) over the real engine.

const PROJECT = '/project/loan-origination';

test('the Project Explorer lists every element; a method with arguments reads name(...), one without name()', async ({
    page,
}) => {
    await copyExample(page, LOAN_ORIGINATION);
    const nav = explorer(page);
    for (const name of [
        'Applicant',
        'Application',
        'LoanTerms',
        'ApplicantFacts',
        'ApplicationFacts',
        'sampleDecision',
        'Joint mortgage application',
        'Borrowing capacity',
    ]) {
        await expect(nav.getByText(name, {exact: true}).first(), name).toBeVisible();
    }
    for (const method of [
        'applicantScorecard(...)',
        'decisionMatrix(...)',
        'loanOriginationDecision(...)',
        'policyRules(...)',
        'ApplicantScore(...)',
        'LoanDecision(...)',
    ]) {
        await expect(nav.getByText(method, {exact: true}).first(), method).toBeVisible();
    }
    await expect(nav.getByText('creditPolicy()', {exact: true})).toBeVisible();
    await expect(nav.getByText('affordability()', {exact: true})).toHaveCount(0);
});

test.describe('the arguments of a function', () => {
    const ARGUMENTS = ['householdIncome', 'householdDebtPayments', 'loanAmount', 'rate', 'termYears'];

    test.beforeEach(async ({page}) => {
        await copyExample(page, LOAN_ORIGINATION);
        // `.first()`: the method; `affordability(...)` is listed again under Tests.
        await explorer(page).getByText('affordability(...)', {exact: true}).first().click();
        await expectLocation(page, `${PROJECT}/affordability`);
        await expect(crumbs(page)).toContainText('affordability(...)');
    });

    test('show above the body', async ({page}) => {
        await expectHeaders(page, 'affordability', ARGUMENTS);
        for (const field of ['payment', 'stressedRate', 'stressedPayment', 'dsti', 'maxPayment', 'maxLoan']) {
            await expect(page.getByTestId(`row-affordability.${field}`), field).toBeVisible();
        }
    });

    test('a rename migrates the references of the body and is saved', async ({page}) => {
        await renameHeader(page, 'affordability', 'rate', 'annualRate');
        await expectHeaders(page, 'affordability', [
            'householdIncome',
            'householdDebtPayments',
            'loanAmount',
            'annualRate',
            'termYears',
        ]);
        await expect(valueCell(page, 'affordability.stressedRate')).toContainText('annualRate');
        await expectSaved(page, 'loan-origination', 'annualRate');
    });

    // `LoanDecision` and `borrowingCapacity` call `affordability` with a number term: the engine rejects an edit that
    // breaks a caller, and the editor shows why.
    test('a retype that breaks the callers is rejected visibly', async ({page}) => {
        await retypeHeader(page, 'affordability', 'termYears', 'string');
        await expect(page.getByLabel('Change type of termYears')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.getByTestId('row-affordability').getByRole('alert')).toContainText(
            "argument 'termYears' expects string, found number",
        );
    });

    test('an argument the callers do not supply is rejected visibly', async ({page}) => {
        await chooseRowAction(page, 'affordability', 'Add argument');
        await expect(page.getByTestId('row-affordability').getByRole('alert')).toContainText(
            "function 'affordability' expects 6 argument(s) but 5 argument(s) were supplied",
        );
        await expectHeaders(page, 'affordability', ARGUMENTS);
    });
});

test('the scorecard decision table shows a column per characteristic', async ({page}) => {
    await openExample(page, LOAN_ORIGINATION, {path: 'applicantScorecard'});
    await expect(page.getByTestId('row-applicantScorecard')).toBeVisible();
    for (const column of ['age', 'employment', 'yearsEmployed', 'bureauScore', 'delinquencies', 'points']) {
        await expect(page.getByTestId(`column-applicantScorecard-${column}`), column).toBeVisible();
    }
});

test('the facts of a type open as their own root, not as the type', async ({page}) => {
    await copyExample(page, LOAN_ORIGINATION);
    await explorer(page)
        .getByRole('treeitem', {name: /Facts Library/})
        .getByText('ApplicantFacts', {exact: true})
        .click();
    await expectLocation(page, `${PROJECT}/ApplicantFacts`);
    await expect(crumbs(page)).toContainText('facts');
    await expect(page.getByTestId('row-ApplicantFacts')).toBeVisible();
    for (const field of ['age', 'disposableIncome']) {
        await expect(page.getByTestId(`row-ApplicantFacts.${field}`), field).toBeVisible();
    }
});

test.describe('the workbooks', () => {
    test('Joint mortgage application charts both scorecards and shows the decision and the offer', async ({page}) => {
        await openExample(page, LOAN_ORIGINATION, {path: 'originationBook', view: 'flow'});
        await expect(page.getByRole('img', {name: 'Main applicant scorecard'})).toBeVisible(SLOW);
        await expect(page.getByRole('img', {name: 'Co-applicant scorecard'})).toBeVisible();

        const decision = page.getByTestId('output-node-output');
        await expect(decision.getByTestId('output-value')).toHaveText('2 fields');
        await expect(decision.getByTestId('output-table')).toContainText('APPROVE');
        await expect(page.getByTestId('output-node-output2').getByTestId('output-table')).toContainText('1473.81');
        await expect(page.getByTestId('output-node-output4').getByTestId('output-table')).toContainText('C');
    });

    test('Borrowing capacity charts the largest affordable loan by term', async ({page}) => {
        await openExample(page, LOAN_ORIGINATION, {path: 'capacityBook', view: 'flow'});
        await expect(page.getByRole('img', {name: 'Largest affordable loan'})).toBeVisible(SLOW);
        await expect(page.getByTestId('output-node-output').getByTestId('output-value')).toHaveText(
            '5 rows × 3 columns',
        );
    });
});

async function openServiceTests(page: Page): Promise<void> {
    await openExample(page, LOAN_ORIGINATION, {path: 'loanOriginationDecision', view: 'tests'});
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
    // The cases run on their own when the subject opens: wait for every result.
    await expect(page.getByTestId(/^assertion-summary-/)).toHaveCount(6, SLOW);
    await expect(page.getByRole('button', {name: 'Run all'})).not.toHaveAttribute('aria-busy', 'true');
}

test.describe('the tests of the service', () => {
    test('the joint and single applications pass when run', async ({page}) => {
        await openServiceTests(page);
        const summaries = page.getByTestId(/^assertion-summary-/);
        await page.getByRole('button', {name: 'Run all'}).click();
        for (let index = 0; index < 6; index++) await expect(summaries.nth(index)).toHaveText('11/11');
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
    });

    test('Run all shows "All tests passed" in the bottom-right corner and closes it after 3 seconds', async ({
        page,
    }) => {
        await openServiceTests(page);
        const notification = page.getByTestId('all-tests-passed');
        // Opening the tests runs them, but only "Run all" reports.
        await expect(notification).toHaveCount(0);

        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(notification).toBeVisible(SLOW);
        const shownAt = Date.now();
        await expect(notification).toContainText('All tests passed');
        await expect(notification).toContainText('6 test cases passed.');

        // The pointer stays away from the notification: hovering would hold it open.
        await page.mouse.move(0, 0);
        const box = (await notification.boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(viewport.width - (box.x + box.width)).toBeLessThan(48);
        expect(viewport.height - (box.y + box.height)).toBeLessThan(48);

        await page.waitForTimeout(Math.max(0, 2_000 - (Date.now() - shownAt)));
        await expect(notification).toBeVisible();
        await expect(notification).toHaveCount(0, {timeout: 3_000});
        expect(Date.now() - shownAt).toBeGreaterThanOrEqual(2_500);
    });

    test('a failing case shows its mismatch, Run all shows no notification, and the fix is saved', async ({page}) => {
        await openServiceTests(page);
        const assertion = page.getByLabel(/^assertion /).first();
        const expected = await assertion.inputValue();
        await assertion.fill('999999999');
        await assertion.press('Enter');
        await expect(page.locator('[data-mismatch="true"]')).not.toHaveCount(0, SLOW);

        const runAll = page.getByRole('button', {name: 'Run all'});
        await runAll.click();
        await expect(runAll).not.toHaveAttribute('aria-busy', 'true', SLOW);
        await page.waitForTimeout(1_000);
        await expect(page.getByTestId('all-tests-passed')).toHaveCount(0);
        await expect(page.getByTestId(/^assertion-summary-/).first()).toHaveText('10/11');

        await expectSaved(page, 'loan-origination', '999999999');
        await page.reload();
        await expect(page.getByTestId(/^assertion-summary-/).first()).toHaveText('10/11', SLOW);
        await page
            .getByLabel(/^assertion /)
            .first()
            .fill(expected);
        await page
            .getByLabel(/^assertion /)
            .first()
            .press('Enter');
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
    });

    test('the rows of a list are generated with zero-based indexes, at every depth', async ({page}) => {
        await openServiceTests(page);
        for (const row of [
            'application.applicants[0].name',
            'application.applicants[1].bureauScore',
            'applicants[0].scorecard.bins[0].points',
            'applicants[0].policy.rules[0].passed',
        ]) {
            await expect(page.getByTestId(`row-${row}`), row).toBeVisible();
        }
    });

    test('a path cell completes the paths of the subject, marks an unknown segment, and duplicates the next index', async ({
        page,
    }) => {
        await openServiceTests(page);
        // A valid path is not marked when its cell opens.
        await page.getByLabel('path application.applicants[0].name').click();
        const editor = page.getByTestId('path-editor-application.applicants[0].name').locator('.cm-content');
        await expect(editor).toBeVisible();
        await page.waitForTimeout(300);
        await expect(page.locator('.cm-lintRange-error, .cm-lintPoint-error')).toHaveCount(0);

        await editor.click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('application.');
        const popup = page.locator('.cm-tooltip-autocomplete');
        await expect(popup).toBeVisible();
        await expect(popup).toContainText('application.applicants');
        // Paths only: no built-in functions.
        await expect(popup).not.toContainText('(');
        // The popup opens over the rows below it: every point of it must be the popup itself, not a sticky cell.
        const covered = await popup.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return [0.1, 0.35, 0.6, 0.9].filter((fraction) => {
                const topmost = document.elementFromPoint(
                    rect.left + rect.width / 2,
                    rect.top + rect.height * fraction,
                );
                return topmost === null || !element.contains(topmost);
            });
        });
        expect(covered).toEqual([]);

        // Escape cancels the cell, even with the popup open: the path is unchanged.
        await page.keyboard.press('Escape');
        await expect(editor).toHaveCount(0);
        await expect(page.getByTestId('row-application.applicants[0].name')).toBeVisible();

        await page.getByLabel('path application.applicants[0].name').click();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('application.applicants[0].nope');
        await expect(page.locator('.cm-lintRange-error')).toHaveText('nope');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('row-application.applicants[0].name')).toBeVisible();

        await page.getByLabel('row menu application.applicants[0].name').click();
        await page.getByRole('menuitem', {name: 'Duplicate'}).click();
        // The next free index of the list, right below the duplicated row: `applicants[1]` is taken.
        await expect
            .poll(() =>
                page
                    .getByTestId(/^row-application\.applicants\[\d\]\.name$/)
                    .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.testid)),
            )
            .toEqual([
                'row-application.applicants[0].name',
                'row-application.applicants[2].name',
                'row-application.applicants[1].name',
            ]);
    });
});

test('the rows a run discovers stay valid when the Tests view is left and opened again', async ({page}) => {
    // The Tests view of the project root is the suite of the model.
    await openExample(page, LOAN_ORIGINATION, {view: 'tests'});
    // A workbook is an opaque invocation call site: its rows are not in the schema, the first run finds them.
    const discovered = page.getByTestId('row-capacityBook.capacity.result');
    await expect(discovered).toBeVisible(SLOW);
    await expect(page.locator('[data-invalid="true"]')).toHaveCount(0);

    await view(page, 'Boxed').click();
    await expect(page.getByTestId('tests-grid')).toHaveCount(0);
    await view(page, 'Tests').click();
    await page
        .getByRole('button', {name: /^Open tests of /})
        .first()
        .click(SLOW);
    // The bug: opening the view again derived the schema rows only, and flagged every discovered row as dropped.
    await expect(discovered).toBeVisible(SLOW);
    await expect(page.locator('[data-invalid="true"]')).toHaveCount(0);
});
