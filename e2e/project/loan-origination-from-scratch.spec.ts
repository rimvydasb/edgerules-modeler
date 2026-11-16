import {test, expect, type Locator, type Page} from '../support/fixtures';
import {createBlankProject, entry, expectSaved, explorer, flowNode, replaceCode, SLOW} from '../support/app';
import {chooseRowAction, commitExpression, renameRow, replaceActiveExpression, valueCell} from '../support/boxed';
import {renameHeader, retypeHeader, expectHeaders} from '../support/columns';

// A first-time user builds the "Loan Origination" model of the EdgeRules playground (docs/reference/playground.md)
// from nothing, through the GUI only: no example copy, no fixture, no model pasted into the Code view of the project.
// The user also makes the mistakes a newcomer makes (an unknown type, a bad name, a reference to a thing that does not
// exist yet) and the Modeler must show what is wrong and let the user continue.

async function addToExplorer(page: Page, section: string, dialog: string, name: string, item?: string) {
    await explorer(page)
        .getByRole('button', {name: `Add to ${section}`})
        .click();
    if (item) await page.getByRole('menuitem', {name: item, exact: true}).click();
    const form = page.getByRole('dialog', {name: dialog});
    await form.getByRole('textbox', {name: 'Name'}).fill(name);
    await form.getByRole('button', {name: 'Create'}).click();
    await expect(form).toHaveCount(0);
}

/** Adds a field to the open type: the "(new field)" row, then its name, then its type. */
async function addTypeField(page: Page, type: string, name: string, typeExpression: string, first = false) {
    if (!first) {
        await page.getByText('(new field)').click();
        await renameRow(page, `${type}.field`, name);
    } else {
        await renameRow(page, `${type}.value`, name);
    }
    await commitExpression(page, `${type}.${name}`, typeExpression);
}

/** Adds a field with an expression to a facts, function or decision body: the "(new item)" row, name, expression. */
async function addBodyField(page: Page, owner: string, name: string, expression: string) {
    await page.getByText(/^\(new (item|field)\)$/).click();
    await renameRow(page, `${owner}.field`, name);
    await commitExpression(page, `${owner}.${name}`, expression);
    await expect(page.getByTestId(`row-error-${owner}.${name}`)).toHaveCount(0);
}

/** Edits the `index`-th cell (conditions first, then actions) of a rule row of a decision table. */
async function editTableCell(page: Page, row: string, index: number, value: string): Promise<void> {
    await valueCell(page, row).locator('span[tabindex="0"]').nth(index).click();
    await replaceActiveExpression(page, value);
    await page.keyboard.press('Enter');
}

/** The text of the Code view of the open element; the view is left on Boxed. */
async function modelCode(page: Page): Promise<string> {
    await page.getByRole('radio', {name: 'Code'}).click();
    const code = page.locator('.cm-content').first();
    await expect(code).toBeVisible();
    const text = await code.evaluate((element) => {
        const view = (element as HTMLElement & {cmView?: {view: {state: {doc: {toString(): string}}}}}).cmView;
        return view?.view.state.doc.toString() ?? (element as HTMLElement).innerText;
    });
    await page.getByRole('radio', {name: 'Boxed'}).click();
    return text;
}

/**
 * Creates a decision the way the GUI allows: a function with its argument in the Boxed view, `func` becomes `decision`
 * in the Code view (the explorer offers no "Add" for DECISIONS and no Boxed menu converts), then the fields are added
 * in the Boxed view. With `mistake`, the user first writes the first field in the function: a function cannot read the
 * results of a decision, the engine says so, and Escape gives the cell back.
 */
async function createDecision(
    page: Page,
    name: string,
    argument: {name: string; type: string},
    fields: [string, string][],
    mistake = false,
): Promise<void> {
    await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
    await page.getByRole('menuitem', {name: 'Function', exact: true}).click();
    const form = page.getByRole('dialog', {name: 'New function'});
    await form.getByRole('textbox', {name: 'Name'}).fill(name);
    await form.getByRole('button', {name: 'Create'}).click();
    await expect(form).toHaveCount(0);
    await page.getByRole('radio', {name: 'Boxed'}).click();
    await chooseRowAction(page, name, 'Add argument');
    await renameHeader(page, name, 'arg', argument.name);
    await retypeHeader(page, name, argument.name, argument.type);
    // A function with `result` only reads `func name(...): 0` in the Code view and cannot become a decision (E354): the
    // first field is added before.
    const [field, expression] = fields[0];
    await page.getByText(/^\(new (item|field)\)$/).click();
    await renameRow(page, `${name}.field`, field);
    if (mistake) {
        await valueCell(page, `${name}.${field}`).click();
        await replaceActiveExpression(page, expression);
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toContainText('E355');
        await page.keyboard.press('Escape');
        await expect(page.locator('.cm-editor')).toHaveCount(0);
        await expect(page.getByTestId(`row-${name}.${field}`)).toBeVisible();
    }

    await page.getByRole('radio', {name: 'Code'}).click();
    const code = page.locator('.cm-content').first();
    const text = await code.evaluate((element) => (element as HTMLElement).innerText);
    expect(text).toContain(`func ${name}(`);
    await replaceCode(page, text.replace('func ', 'decision '));
    await expect(entry(page, 'decision', name)).toBeVisible(SLOW);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('radio', {name: 'Boxed'}).click();

    for (const [index, [field, expression]] of fields.entries()) {
        if (index === 0) await commitExpression(page, `${name}.${field}`, expression);
        else await addBodyField(page, name, field, expression);
    }
    // `result: 0` of the new function is not wanted: it can be deleted once the function has other fields.
    await chooseRowAction(page, `${name}.result`, 'Delete');
    await expect(page.getByTestId(`row-${name}.result`)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
}

test.use({viewport: {width: 1680, height: 1000}});

async function fillCell(cell: Locator, text: string): Promise<void> {
    await cell.fill(text);
    await cell.press('Enter');
}

test('Loan Origination is entered from scratch', async ({page}) => {
    // One user, one long session: far more steps than the default 60 s of a test.
    test.setTimeout(240_000);
    await createBlankProject(page, 'Loan Origination');

    await test.step('types: Application first', async () => {
        await addToExplorer(page, 'Types', 'New type', 'Application');
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await addTypeField(page, 'Application', 'applicationDate', '<datetime>', true);
        await addTypeField(page, 'Application', 'propertyValue', '<number>');
        await addTypeField(page, 'Application', 'loanAmount', '<number>');
    });

    await test.step('mistake: a field of a type that does not exist yet', async () => {
        await page.getByText('(new field)').click();
        await renameRow(page, 'Application.field', 'applicants');
        await valueCell(page, 'Application.applicants').click();
        await replaceActiveExpression(page, '<Applicant[]>');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toContainText("unknown type 'Applicant'");
        // The user gives up: Escape closes the cell.
        await page.keyboard.press('Escape');
        await expect(page.locator('.cm-editor')).toHaveCount(0);
        // The failed edit leaves the field as it was created: a string. No error stays on the page.
        await expect(valueCell(page, 'Application.applicants')).toContainText('string');
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    await test.step('types: Applicant, with its owner written in the Code view', async () => {
        await addToExplorer(page, 'Types', 'New type', 'Applicant');
        await expect(page.getByTestId('row-Applicant.value')).toBeVisible();
        // Mistake: `owner application` typed as the name of a field. The name is refused with the reason and stays
        // open for another try.
        await page.getByTestId('row-Applicant.value').getByText('value', {exact: true}).first().click();
        await page.getByLabel('name Applicant.value').fill('owner application');
        await page.getByLabel('name Applicant.value').press('Enter');
        await expect(page.getByRole('alert')).toContainText('Names must start with a letter');
        await page.getByLabel('name Applicant.value').press('Escape');
        await expect(page.getByTestId('row-Applicant.value')).toBeVisible();
        await addTypeField(page, 'Applicant', 'name', '<string>', true);
        await addTypeField(page, 'Applicant', 'birthDate', '<date>');
        await addTypeField(page, 'Applicant', 'income', '<number, min: 0>');
        await addTypeField(page, 'Applicant', 'expense', '<number, min: 0>');
        await page.getByRole('radio', {name: 'Code'}).click();
        const code = page.locator('.cm-content').first();
        const text = await code.evaluate((element) => (element as HTMLElement).innerText);
        await replaceCode(page, text.replace('{', '{\n    owner application: <Application>'));
        // Mistake: the owner needs a parent that holds the applicants, and the parent does not hold them yet.
        await expect(page.getByRole('alert')).toContainText('E356', SLOW);
        await expect(page.getByRole('alert')).toContainText('The code is not applied');
    });

    await test.step('Application holds the applicants, then the owner is accepted', async () => {
        await explorer(page).getByText('Application', {exact: true}).click();
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await commitExpression(page, 'Application.applicants', '<Applicant[]>');
        await expect(valueCell(page, 'Application.applicants')).toContainText('Applicant[]');
        await expect(page.getByRole('alert')).toHaveCount(0);
        await explorer(page).getByText('Applicant', {exact: true}).click();
        await page.getByRole('radio', {name: 'Code'}).click();
        const code = page.locator('.cm-content').first();
        await expect(code).toContainText('birthDate');
        const text = await code.evaluate((element) => (element as HTMLElement).innerText);
        // The draft of the first attempt is still in the Code view, with the old error, although the cause is fixed.
        await expect(code).toContainText('owner application');
        await expect(page.getByRole('alert')).toContainText('E356');
        await expect(page.getByTestId('row-Applicant.application')).toHaveCount(0);
        // Any edit applies it again.
        await replaceCode(page, text + '\n');
        await expect(page.getByRole('alert')).toHaveCount(0, SLOW);
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await expect(page.getByTestId('row-Applicant.application')).toBeVisible(SLOW);
        await expect(valueCell(page, 'Applicant.application')).toContainText('owner');
    });

    await test.step('facts', async () => {
        await explorer(page).getByRole('button', {name: 'Add to Facts Library'}).click();
        const form = page.getByRole('dialog', {name: 'New fact'});
        await expect(form.getByRole('textbox', {name: 'Name'})).toHaveValue('ApplicantFacts');
        await form.getByRole('button', {name: 'Create'}).click();
        await expect(form).toHaveCount(0);
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await addBodyField(
            page,
            'ApplicantFacts',
            'age',
            'calendarDiff(applicant.birthDate, applicant.application.applicationDate.date).years',
        );
        await addBodyField(page, 'ApplicantFacts', 'disposableIncome', 'applicant.income - applicant.expense');

        await explorer(page).getByRole('button', {name: 'Add to Facts Library'}).click();
        const second = page.getByRole('dialog', {name: 'New fact'});
        await second.getByLabel('Type').click();
        await page.getByRole('option', {name: 'Application', exact: true}).click();
        await expect(second.getByRole('textbox', {name: 'Name'})).toHaveValue('ApplicationFacts');
        await second.getByRole('button', {name: 'Create'}).click();
        await expect(second).toHaveCount(0);
        await addBodyField(
            page,
            'ApplicationFacts',
            'loanToValue',
            'application.loanAmount / application.propertyValue',
        );
        await expect(explorer(page).getByText('ApplicationFacts', {exact: true})).toBeVisible();
    });

    await expectSaved(page, 'loan-origination', 'loanToValue: application.loanAmount / application.propertyValue');

    await test.step('rulesets', async () => {
        await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
        await page.getByRole('menuitem', {name: 'Ruleset', exact: true}).click();
        const form = page.getByRole('dialog', {name: 'New ruleset'});
        await form.getByRole('textbox', {name: 'Name'}).fill('creditScorecard');
        await form.getByRole('button', {name: 'Create'}).click();
        await expect(form).toHaveCount(0);
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await renameHeader(page, 'creditScorecard', 'value', 'age');
        await retypeHeader(page, 'creditScorecard', 'age', 'number');
        await chooseRowAction(page, 'creditScorecard', 'Add condition column');
        await renameHeader(page, 'creditScorecard', 'condition', 'income');
        await retypeHeader(page, 'creditScorecard', 'income', 'number');
        await renameHeader(page, 'creditScorecard', 'result', 'characteristic');
        await chooseRowAction(page, 'creditScorecard', 'Add action column');
        await renameHeader(page, 'creditScorecard', 'action', 'points');
        await expectHeaders(page, 'creditScorecard', ['age', 'income', 'characteristic', 'points']);
        for (let index = 0; index < 3; index += 1) await page.getByTestId('append-creditScorecard').click();

        // Mistake: the user types a string over the number of an action, as a newcomer does. The other rules and the
        // default still hold the number: the engine rejects the edit, says why and the model is not changed.
        await editTableCell(page, 'creditScorecard.rules[0]', 2, '"AGE"');
        await expect(page.getByRole('alert')).toContainText('E307');
        // The cell stays open on the rejected value; Escape cancels it and the model is as it was.
        await page.keyboard.press('Escape');
        await expect(valueCell(page, 'creditScorecard.rules[0]')).not.toContainText('"AGE"');
        await expect(page.getByRole('alert')).toHaveCount(0);

        // The way out the user finds: one rule is consistent with itself. The other rules go, the hit policy
        // "collect-matches" drops the default (the model has none), then the one rule is edited.
        await chooseRowAction(page, 'creditScorecard.rules[2]', 'Delete');
        await chooseRowAction(page, 'creditScorecard.rules[1]', 'Delete');
        await page.getByTestId('row-creditScorecard.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'collect-matches'}).click();
        await expect(page.getByTestId('row-creditScorecard.default')).toHaveCount(0);
        await editTableCell(page, 'creditScorecard.rules[0]', 3, '20');
        await editTableCell(page, 'creditScorecard.rules[0]', 2, '"AGE"');
        await editTableCell(page, 'creditScorecard.rules[0]', 0, '<= 25');
        await expect(page.getByRole('alert')).toHaveCount(0);
        // A new rule copies the actions of the first rule.
        await page.getByTestId('append-creditScorecard').click();
        await page.getByTestId('append-creditScorecard').click();
        await editTableCell(page, 'creditScorecard.rules[1]', 3, '30');
        await editTableCell(page, 'creditScorecard.rules[1]', 0, '> 25');
        await editTableCell(page, 'creditScorecard.rules[2]', 3, '30');
        await editTableCell(page, 'creditScorecard.rules[2]', 2, '"INCOME"');
        await editTableCell(page, 'creditScorecard.rules[2]', 1, '>= 1500');
        await expect(page.getByRole('alert')).toHaveCount(0);
        const scorecard = await modelCode(page);
        expect(scorecard).toContain('{ characteristic: "INCOME"; points: 30 }');
    });

    await test.step('ruleset eligibilityRules with an expression as a condition', async () => {
        await explorer(page).getByRole('button', {name: 'Add to Methods'}).click();
        await page.getByRole('menuitem', {name: 'Ruleset', exact: true}).click();
        const form = page.getByRole('dialog', {name: 'New ruleset'});
        await form.getByRole('textbox', {name: 'Name'}).fill('eligibilityRules');
        await form.getByRole('button', {name: 'Create'}).click();
        await expect(form).toHaveCount(0);
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await renameHeader(page, 'eligibilityRules', 'value', 'applicant');
        await retypeHeader(page, 'eligibilityRules', 'applicant', 'Applicant');
        await chooseRowAction(page, 'eligibilityRules', 'Add condition column');
        await renameHeader(page, 'eligibilityRules', 'condition', 'creditScore');
        await retypeHeader(page, 'eligibilityRules', 'creditScore', 'number');
        await renameHeader(page, 'eligibilityRules', 'result', 'reason');
        await expectHeaders(page, 'eligibilityRules', ['applicant', 'creditScore', 'reason']);
        await page.getByTestId('append-eligibilityRules').click();
        await page.getByTestId('row-eligibilityRules.hitPolicy').getByLabel('Change hit policy').click();
        await page.getByRole('menuitem', {name: 'collect-matches'}).click();
        await editTableCell(page, 'eligibilityRules.rules[0]', 2, '"INC_CHECK"');
        await editTableCell(page, 'eligibilityRules.rules[0]', 0, 'applicant.disposableIncome <= applicant.expense');
        // Mistake: the condition cell of an `Applicant` column is a test of the value of the column, not an expression.
        await expect(page.getByRole('alert')).toContainText('type mismatch');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('alert')).toHaveCount(0);
        // Three of the four rules test an expression; the fourth tests one argument.
        const expressionRules = [
            'applicant.disposableIncome <= applicant.expense',
            'applicant.income <= 1000',
            'applicant.age < 18',
        ];
        const reasons = ['"INC_CHECK"', '"MIN_INCOM"', '"AGE_CHECK"', '"SCREDIT_S"'];
        for (let index = 1; index < 4; index += 1) await page.getByTestId('append-eligibilityRules').click();
        for (let index = 0; index < 3; index += 1) {
            const row = `eligibilityRules.rules[${index}]`;
            await chooseRowAction(page, row, 'Switch to expression condition');
            await editTableCell(page, row, 1, reasons[index]);
            await editTableCell(page, row, 0, expressionRules[index]);
        }
        await editTableCell(page, 'eligibilityRules.rules[3]', 2, reasons[3]);
        await editTableCell(page, 'eligibilityRules.rules[3]', 1, '<= 10');
        await expect(page.getByRole('alert')).toHaveCount(0);
        const eligibility = await modelCode(page);
        expect(eligibility).toContain(
            'when: applicant.disposableIncome <= applicant.expense; then: { reason: "INC_CHECK" }',
        );
        expect(eligibility).toContain('{ when: { creditScore: ... <= 10 }; then: { reason: "SCREDIT_S" } }');
    });

    await test.step('decisions', async () => {
        await createDecision(page, 'ApplicantCreditScore', {name: 'applicant', type: 'Applicant'}, [
            ['scorecard', 'creditScorecard(age: applicant.age, income: applicant.income)'],
            ['score', 'sum(for line in scorecard return line.points)'],
        ]);
        await createDecision(
            page,
            'ApplicantEligibility',
            {name: 'applicant', type: 'Applicant'},
            [
                [
                    'declineReasons',
                    'for rule in eligibilityRules(applicant, applicant.ApplicantCreditScore.score) return rule.reason',
                ],
                ['eligible', 'count(declineReasons) = 0'],
            ],
            true,
        );
        await createDecision(page, 'ApplicationApproval', {name: 'application', type: 'Application'}, [
            ['loanToValueAcceptable', 'application.loanToValue <= 0.9'],
            [
                'allApplicantsEligible',
                'all(for applicant in application.applicants return applicant.ApplicantEligibility.eligible)',
            ],
            ['outcome', 'if loanToValueAcceptable and allApplicantsEligible then "APPROVE" else "DECLINE"'],
        ]);
    });

    await test.step('service approveApplication', async () => {
        await addToExplorer(page, 'Service Methods', 'New service', 'approveApplication');
        await page.getByRole('radio', {name: 'Boxed'}).click();
        await chooseRowAction(page, 'approveApplication', 'Add argument');
        await renameHeader(page, 'approveApplication', 'arg', 'application');
        await retypeHeader(page, 'approveApplication', 'application', 'Application');
        await expect(page.getByRole('alert')).toHaveCount(0);
        await addBodyField(page, 'approveApplication', 'outcome', 'application.ApplicationApproval.outcome');
        await addBodyField(
            page,
            'approveApplication',
            'declineReasons',
            'for applicant in application.applicants return applicant.ApplicantEligibility.declineReasons',
        );
        await chooseRowAction(page, 'approveApplication.result', 'Delete');
        await expect(page.getByRole('alert')).toHaveCount(0);
        const service = await modelCode(page);
        expect(service).toContain('outcome: application.ApplicationApproval.outcome');
    });

    await test.step('workbook example', async () => {
        await addToExplorer(page, 'Workbooks', 'New workbook', 'example');
        await page.getByRole('radio', {name: 'Boxed'}).click();
        // A context row has no type: the input is one expression that ends with .
        await addBodyField(
            page,
            'example',
            'application',
            '{applicationDate: datetime("2025-01-01T15:43:56"), propertyValue: 100000, loanAmount: 80000, ' +
                'applicants: [{name: "John Doe", birthDate: date("1990-06-05"), income: 1100, expense: 600}, ' +
                '{name: "Jane Doe", birthDate: date("1992-05-01"), income: 1500, expense: 300}]} as Application',
        );
        await addBodyField(
            page,
            'example',
            'creditScores',
            'for applicant in application.applicants return applicant.ApplicantCreditScore',
        );
        await addBodyField(
            page,
            'example',
            'eligibility',
            'for applicant in application.applicants return applicant.ApplicantEligibility',
        );
        await addBodyField(page, 'example', 'approval', 'application.ApplicationApproval');
        await addBodyField(page, 'example', 'response', 'approveApplication(application)');
        await expect(page.getByRole('alert')).toHaveCount(0);
        await page.getByRole('radio', {name: /^(Flow|Overview)$/}).click();
        // The whole window for the canvas: the split panel of a selected node would cover half of it.
        const split = page.getByTestId('shell-split-toggle');
        if ((await split.getAttribute('aria-pressed')) === 'true') await split.click();
        const pane = page.locator('.react-flow__pane');
        const palette = page.getByRole('navigation', {name: 'Node palette'});
        const handle = (id: string, name: string) => flowNode(page, id).locator(`[data-handleid="${name}"]`);
        const outputs = [
            ['output', 'example.approval', 'out:*', 900, 40],
            ['output2', 'example.creditScores', 'out:*', 900, 300],
            ['output3', 'example.response', 'out:outcome', 900, 560],
            ['output4', 'example.response', 'out:declineReasons', 900, 760],
        ] as const;
        for (const [id, from, pin, x, y] of outputs) {
            await palette.getByRole('button', {name: 'Add output', exact: true}).dragTo(pane, {targetPosition: {x, y}});
            await expect(flowNode(page, id)).toBeVisible(SLOW);
            // A dropped node lands where it is dropped, over any node there: "Arrange nodes" lays out the canvas again.
            await page.getByRole('button', {name: 'Arrange nodes'}).click();
            await handle(from, pin).dragTo(handle(id, 'in:value'));
        }
        // Four wires of `application` into the nodes that read it, and one wire into each of the four outputs.
        await expect(page.locator('.react-flow__edge')).toHaveCount(8, SLOW);
        // The values of the playground: John Doe's income check declines the joint application.
        const output = (id: string) => page.getByTestId(`output-node-${id}`);
        await expect(output('output').getByTestId('output-table')).toContainText('DECLINE', SLOW);
        await expect(output('output').getByTestId('output-table')).toContainText('allApplicantsEligible');
        await expect(output('output2').getByTestId('output-value')).toHaveText('2 rows × 2 columns');
        await expect(output('output2').getByTestId('output-table')).toContainText('60');
        await expect(output('output3').getByTestId('output-value')).toContainText('DECLINE');
        await expect(output('output4').getByTestId('output-table')).toContainText("['INC_CHECK']");
        await expectSaved(page, 'loan-origination', 'response: approveApplication(application)');
    });

    await test.step('workbook scorecardCheck, drawn in the Flow editor only', async () => {
        await addToExplorer(page, 'Workbooks', 'New workbook', 'scorecardCheck');
        await expect(page.getByTestId('flow-editor-empty')).toContainText('This flow has no nodes yet', SLOW);
        const pane = page.locator('.react-flow__pane');
        const palette = page.getByRole('navigation', {name: 'Node palette'});
        await palette
            .getByRole('button', {name: 'Add value input', exact: true})
            .dragTo(pane, {targetPosition: {x: 40, y: 60}});
        await palette
            .getByRole('button', {name: 'Add value input', exact: true})
            .dragTo(pane, {targetPosition: {x: 40, y: 260}});
        await palette
            .getByRole('button', {name: 'Add invocation', exact: true})
            .dragTo(pane, {targetPosition: {x: 480, y: 60}});
        await palette
            .getByRole('button', {name: 'Add output', exact: true})
            .dragTo(pane, {targetPosition: {x: 1100, y: 60}});
        await expect(flowNode(page, 'output')).toBeVisible(SLOW);
        const invocation = flowNode(page, 'scorecardCheck.node');
        await invocation.getByRole('button', {name: 'Select callee'}).click();
        await page.getByRole('option', {name: /^creditScorecard\(/}).click();
        await expect(invocation.getByRole('button', {name: 'Callee creditScorecard'})).toBeVisible();
        await page.getByRole('button', {name: 'Arrange nodes'}).click();
        // `out:*` of a value input into the argument pins; the ruleset result into the output.
        const link = (from: string, pin: string, to: string, target: string) =>
            flowNode(page, from)
                .locator(`[data-handleid="${pin}"]`)
                .dragTo(flowNode(page, to).locator(`[data-handleid="${target}"]`));
        await link('scorecardCheck.value', 'out:*', 'scorecardCheck.node', 'in:age');
        await link('scorecardCheck.value2', 'out:*', 'scorecardCheck.node', 'in:income');
        await link('scorecardCheck.node', 'out:result', 'output', 'in:value');
        await expect(page.locator('.react-flow__edge')).toHaveCount(3, SLOW);
        const result = page.getByTestId('output-node-output');
        await page.getByRole('button', {name: 'Value of scorecardCheck.value', exact: true}).click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('30');
        await page.keyboard.press('Enter');
        await page.getByRole('button', {name: 'Value of scorecardCheck.value2', exact: true}).click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('1200');
        await page.keyboard.press('Enter');
        await expect(result.getByTestId('output-table')).toContainText('AGE', SLOW);
        await expect(result.getByTestId('output-value')).toHaveText('1 row × 2 columns');

        // Mistake: a word for the income. The input accepts what the user types; the output says what is wrong.
        await page.getByRole('button', {name: 'Value of scorecardCheck.value2', exact: true}).click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('"rich"');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toContainText('E115');
        // The input stays open on the wrong value and the output keeps the last good result; the user types again.
        await expect(result.getByTestId('output-value')).toHaveText('1 row × 2 columns');
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('2000');
        await page.keyboard.press('Enter');
        await expect(result.getByTestId('output-value')).toHaveText('2 rows × 2 columns', SLOW);
        await expect(result.getByTestId('output-table')).toContainText('INCOME');
        await expectSaved(page, 'loan-origination', 'node: creditScorecard(age: value, income: value2)');
    });

    await test.step('tests of the ruleset creditScorecard', async () => {
        await entry(page, 'ruleset', 'creditScorecard').click();
        await page.getByRole('radio', {name: 'Tests'}).click();
        await page.getByText('Create Tests').click();
        await fillCell(page.getByRole('textbox', {name: 'input age', exact: true}), '30');
        await fillCell(page.getByRole('textbox', {name: 'input income', exact: true}), '1200');
        await expect(page.getByTestId('validation-[0].points')).toHaveText('30', SLOW);
        await expect(page.getByTestId('validation-[0].characteristic')).toHaveText('AGE');
        for (const row of ['[0].characteristic', '[0].points']) {
            await page.getByRole('button', {name: `row menu ${row}`, exact: true}).click();
            await page.getByRole('menuitem', {name: 'Move to Assertions'}).click();
        }
        await expect(page.getByTestId(/^assertion-summary-/)).toHaveText('2/2', SLOW);
        await page.getByRole('button', {name: 'Add test case'}).click();
        await fillCell(page.getByRole('textbox', {name: 'input age', exact: true}).nth(1), '20');
        await fillCell(page.getByRole('textbox', {name: 'input income', exact: true}).nth(1), '1600');
        await expect(page.getByTestId('validation-')).toHaveText(['1 item', '2 items'], SLOW);
        const assertion = (path: string, column = 0) =>
            page.getByRole('textbox', {name: `assertion ${path}`, exact: true}).nth(column);
        // Case 2 asserts both rows: the rows of case 1 are duplicated for the next index of the list.
        for (const row of ['[0].characteristic', '[0].points']) {
            await page.getByRole('button', {name: `row menu ${row}`, exact: true}).click();
            await page.getByRole('menuitem', {name: 'Duplicate'}).click();
        }
        await expect(page.getByTestId('row-[1].points')).toBeVisible();
        // The duplicates copy the expected values of case 1, which has no second row: its cells are flagged. They are
        // cleared.
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(2, SLOW);
        await fillCell(assertion('[1].characteristic', 0), '');
        await fillCell(assertion('[1].points', 0), '');
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0, SLOW);
        // Mistake: the points of the age rule for 20 years are typed with the wrong number.
        await fillCell(assertion('[0].points', 1), '200');
        await fillCell(assertion('[0].characteristic', 1), 'AGE');
        await fillCell(assertion('[1].characteristic', 1), 'INCOME');
        await fillCell(assertion('[1].points', 1), '30');
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(1, SLOW);
        await expect(page.getByTestId(/^assertion-summary-/).nth(1)).toHaveText('3/4');
        await fillCell(assertion('[0].points', 1), '20');
        await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(page.getByTestId(/^assertion-summary-/)).toHaveText(['2/2', '4/4'], SLOW);
        await expect(page.getByTestId('all-tests-passed').last()).toContainText('2 test cases passed.', SLOW);
        await expectSaved(page, 'loan-origination', '"[1].characteristic":"INCOME"');
    });

    await test.step('tests of the service approveApplication', async () => {
        await explorer(page).getByText('approveApplication(...)', {exact: true}).first().click();
        await page.getByRole('radio', {name: 'Tests'}).click();
        await page.getByText('Create Tests').click();
        const input = (path: string) => page.getByRole('textbox', {name: `input ${path}`, exact: true});
        await fillCell(input('application.applicationDate'), '2025-01-01T15:43:56');
        await fillCell(input('application.propertyValue'), '100000');
        await fillCell(input('application.loanAmount'), '80000');
        await fillCell(input('application.applicants[0].name'), 'John Doe');
        await fillCell(input('application.applicants[0].birthDate'), '1990-06-05');
        await fillCell(input('application.applicants[0].income'), '1100');
        await fillCell(input('application.applicants[0].expense'), '600');
        await expect(page.getByTestId('validation-outcome')).toHaveText('DECLINE', SLOW);
        await expect(page.getByTestId('validation-declineReasons[0][0]')).toHaveText('INC_CHECK');
        for (const row of ['outcome', 'declineReasons[0][0]']) {
            await page.getByRole('button', {name: `row menu ${row}`, exact: true}).click();
            await page.getByRole('menuitem', {name: 'Move to Assertions'}).click();
        }
        await expect(page.getByTestId(/^assertion-summary-/)).toHaveText('2/2', SLOW);

        // Case 2: Jane Doe alone, income 1500 against expenses of 300: approved, no decline reasons.
        await page.getByRole('button', {name: 'Add test case'}).click();
        const second = (path: string) => input(path).nth(1);
        await fillCell(second('application.applicationDate'), '2025-01-01T15:43:56');
        await fillCell(second('application.propertyValue'), '100000');
        await fillCell(second('application.loanAmount'), '80000');
        await fillCell(second('application.applicants[0].name'), 'Jane Doe');
        await fillCell(second('application.applicants[0].birthDate'), '1992-05-01');
        await fillCell(second('application.applicants[0].income'), '1500');
        await fillCell(second('application.applicants[0].expense'), '300');
        await fillCell(page.getByRole('textbox', {name: 'assertion outcome', exact: true}).nth(1), 'APPROVE');
        await page.getByRole('button', {name: 'Run all'}).click();
        await expect(page.getByTestId(/^assertion-summary-/)).toHaveText(['2/2', '1/1'], SLOW);
        await expect(page.getByTestId('all-tests-passed').last()).toContainText('2 test cases passed.', SLOW);
        await expectSaved(page, 'loan-origination', '"outcome":"APPROVE"');
        await page.reload();
        await expect(page.getByTestId(/^assertion-summary-/)).toHaveText(['2/2', '1/1'], SLOW);
    });
});
