import {test, expect, type Locator, type Page} from '../support/fixtures';
import {
    expectLocation,
    expectProjectOpen,
    expectSaved,
    flowNode,
    LOAN_REPAYMENT,
    openExample,
    SLOW,
} from '../support/app';

// The Flow view of a workbook: the canvas of the Mortgage plan of the published Loan Repayment example, and a new
// workbook built on an empty canvas from the node palette. Every change is a change of the model: it recalculates
// the outputs and is saved.

const PROJECT = '/project/loan-repayment';

// The split view shares the window with the canvas: a wide desktop window leaves the canvas room for a few nodes.
test.use({viewport: {width: 1680, height: 1000}});

function handle(page: Page, nodeId: string, handleId: string): Locator {
    return flowNode(page, nodeId).locator(`[data-handleid="${handleId}"]`);
}

function paletteItem(page: Page, name: string): Locator {
    return page.getByRole('navigation', {name: 'Node palette'}).getByRole('button', {name, exact: true});
}

async function box(locator: Locator) {
    const result = await locator.boundingBox();
    if (!result) throw new Error('element has no box');
    return result;
}

function overlaps(a: {x: number; y: number; width: number; height: number}, b: typeof a): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function openMortgagePlan(page: Page): Promise<void> {
    await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
    await expect(flowNode(page, 'mortgageBook.yearly')).toBeVisible(SLOW);
}

async function editValue(page: Page, name: string, text: string): Promise<void> {
    await page.getByRole('button', {name: `Value of ${name}`}).click();
    await expect(page.getByTestId(`value-editor-${name}`).locator('.cm-content')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
}

const payment = (page: Page) => page.getByTestId('output-node-output').getByTestId('output-value');

test.describe('the canvas of a workbook', () => {
    test('draws every node, its wires and the output values in data-flow columns', async ({page}) => {
        await openMortgagePlan(page);
        for (const id of [
            'object-input-node-mortgageBook.mortgage',
            'function-node-mortgageBook.repayment',
            'function-node-mortgageBook.yearly',
            'output-node-output',
            'chart-node-chart',
        ]) {
            await expect(page.getByTestId(id), id).toBeVisible();
        }
        await expect(page.locator('.react-flow__edge')).toHaveCount(7);
        await expect(payment(page)).toHaveText('1354.35');
        await expect
            .poll(async () => {
                const [input, repayment, yearly] = await Promise.all(
                    ['mortgageBook.mortgage', 'mortgageBook.repayment', 'mortgageBook.yearly'].map((id) =>
                        box(flowNode(page, id)),
                    ),
                );
                return input.x + input.width < repayment.x && repayment.x + repayment.width < yearly.x;
            })
            .toBe(true);
        await expect(page.getByRole('button', {name: 'Zoom In'})).toBeVisible();
        await expect(page.getByRole('button', {name: 'Fit View'})).toBeVisible();
        await expect(page.locator('.react-flow__minimap')).toBeVisible();
    });

    test('Arrange nodes puts back a node that was dragged onto another', async ({page}) => {
        await openMortgagePlan(page);
        const target = await box(flowNode(page, 'mortgageBook.repayment'));
        const title = await box(page.getByTestId('function-node-mortgageBook.yearly').locator('strong').first());
        await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + 40, target.y + 20, {steps: 8});
        await page.mouse.up();
        expect(
            overlaps(
                await box(flowNode(page, 'mortgageBook.repayment')),
                await box(flowNode(page, 'mortgageBook.yearly')),
            ),
        ).toBe(true);

        await page.getByRole('button', {name: 'Arrange nodes'}).click();
        await expect
            .poll(async () =>
                overlaps(
                    await box(flowNode(page, 'mortgageBook.repayment')),
                    await box(flowNode(page, 'mortgageBook.yearly')),
                ),
            )
            .toBe(false);
    });

    test('an input value recalculates every output that reads it, and is saved', async ({page}) => {
        await openMortgagePlan(page);
        await editValue(page, 'amount', '200000');
        await expect(page.getByRole('button', {name: 'Value of amount'})).toHaveText('200000');
        await expect(payment(page)).toHaveText('1083.48');
        // An expression is a value too.
        await editValue(page, 'amount', '100000 + 100000');
        await expect(payment(page)).toHaveText('1083.48');

        await expectSaved(page, 'loan-repayment', '100000 + 100000');
        await page.reload();
        await expect(page.getByRole('button', {name: 'Value of amount'})).toHaveText('100000 + 100000', SLOW);
        await expect(payment(page)).toHaveText('1083.48');
    });

    test('an invalid value shows the error and leaves the outputs; Escape restores the value', async ({page}) => {
        await openMortgagePlan(page);
        await editValue(page, 'years', '25 +');
        const input = page.getByTestId('object-input-node-mortgageBook.mortgage');
        await expect(input.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('value-editor-years')).toBeVisible();
        await expect(payment(page)).toHaveText('1354.35');

        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', {name: 'Value of years'})).toHaveText('25');
        await expect(input.getByRole('alert')).toHaveCount(0);
    });

    test('typing in a value does not delete the selected node', async ({page}) => {
        await openMortgagePlan(page);
        await page.getByRole('button', {name: 'Value of years'}).click();
        await expect(page.getByTestId('value-editor-years').locator('.cm-content')).toBeFocused();
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('20');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('object-input-node-mortgageBook.mortgage')).toBeVisible();
        await expect(page.getByRole('button', {name: 'Value of years'})).toHaveText('20');
        await expect(payment(page)).not.toHaveText('1354.35');
    });

    test('Delete keeps a model node, removes an output, and a deleted wire turns the node into a draft', async ({
        page,
    }) => {
        await openMortgagePlan(page);
        await page.getByTestId('object-input-node-mortgageBook.mortgage').locator('strong').first().click();
        await page.keyboard.press('Delete');
        await expect(flowNode(page, 'mortgageBook.mortgage')).toBeVisible();
        await expect(payment(page)).toHaveText('1354.35');

        await page.getByTestId('output-node-output2').locator('strong').first().click();
        await page.keyboard.press('Delete');
        await expect(flowNode(page, 'output2')).toHaveCount(0);
        await expect(flowNode(page, 'output')).toBeVisible();

        // Other nodes may cover the wire: select it by its own element.
        await page.getByTestId('rf__edge-mortgageBook.yearly:schedule').dispatchEvent('click');
        await page.keyboard.press('Delete');
        await expect(page.getByTestId('rf__edge-mortgageBook.yearly:schedule')).toHaveCount(0);
        await expect(
            page.getByTestId('function-node-mortgageBook.yearly').getByText('draft', {exact: true}),
        ).toBeVisible();

        // The removed output stays removed after a reload.
        await expectSaved(page, 'loan-repayment', '"label":"Cost of the loan"', {absent: true});
        await page.reload();
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expect(flowNode(page, 'output')).toBeVisible(SLOW);
        await expect(flowNode(page, 'output2')).toHaveCount(0);
    });
});

test.describe('a new workbook', () => {
    test.beforeEach(async ({page}) => {
        await openExample(page, LOAN_REPAYMENT);
        await page.getByTestId('shell-workbook-add').click();
        const dialog = page.getByRole('dialog', {name: 'New workbook'});
        await dialog.getByRole('textbox', {name: 'Name'}).fill('plan');
        await dialog.getByRole('button', {name: 'Create'}).click();
        await expectLocation(page, `${PROJECT}/plan?view=flow`);
        await expect(page.getByTestId('flow-editor-empty')).toContainText('This flow has no nodes yet', SLOW);
        // The whole window for the canvas: the nodes are dropped side by side.
        await page.getByTestId('shell-split-toggle').click();
        await expect(page.getByTestId('shell-split-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    test('the palette lists every node type, grouped, and its search narrows them', async ({page}) => {
        const palette = page.getByRole('navigation', {name: 'Node palette'});
        // A narrow canvas starts with the palette as a rail.
        const show = page.getByRole('button', {name: 'Show node palette'});
        if (await show.isVisible()) await show.click();
        for (const group of ['Inputs', 'Invocations', 'Outputs', 'Charts']) {
            await expect(palette.getByText(group, {exact: true})).toBeVisible();
        }
        for (const name of ['Add object input', 'Add list input', 'Add value input', 'Add invocation', 'Add output']) {
            await expect(paletteItem(page, name)).toBeVisible();
        }
        const search = page.getByRole('textbox', {name: 'Search nodes'});
        await search.fill('list');
        await expect(paletteItem(page, 'Add list input')).toBeVisible();
        await expect(paletteItem(page, 'Add invocation')).toHaveCount(0);
        await search.fill('zzz');
        await expect(page.getByText('No nodes match “zzz”')).toBeVisible();
        await page.getByRole('button', {name: 'Clear search'}).click();
        await expect(paletteItem(page, 'Add invocation')).toBeVisible();

        // The palette collapses to a rail that still adds nodes.
        await page.getByRole('button', {name: 'Hide node palette'}).click();
        await expect(search).toHaveCount(0);
        await paletteItem(page, 'Add output').click();
        await expect(page.locator('[data-testid^="output-node-"]')).toHaveCount(1, SLOW);
        await page.getByRole('button', {name: 'Show node palette'}).click();
        await expect(search).toBeVisible();
    });

    test('a value input, an invocation and an output wired together compute the monthly payment', async ({page}) => {
        const pane = page.locator('.react-flow__pane');
        await paletteItem(page, 'Add value input').dragTo(pane, {targetPosition: {x: 40, y: 60}});
        const value = page.locator('[data-testid^="value-input-node-"]');
        await expect(value).toHaveCount(1, SLOW);
        await expect(value.getByRole('button', {name: /^Value of /})).toHaveText('0');

        await paletteItem(page, 'Add invocation').dragTo(pane, {targetPosition: {x: 480, y: 60}});
        const invocation = page.locator('[data-testid^="function-node-"]');
        await expect(invocation).toContainText('Pick a function or ruleset', SLOW);
        await invocation.getByRole('button', {name: 'Select callee'}).click();
        // Only user functions and rulesets are callees.
        await expect(page.getByRole('option', {name: /^pricingTier\(/})).toBeVisible();
        await expect(page.getByRole('option', {name: /^pmt\(/})).toHaveCount(0);
        await page.getByRole('option', {name: /^monthlyPayment\(/}).click();
        await expect(invocation.getByRole('button', {name: 'Callee monthlyPayment'})).toBeVisible();
        await expect(invocation.getByText('draft', {exact: true})).toBeVisible();

        await paletteItem(page, 'Add output').dragTo(pane, {targetPosition: {x: 980, y: 60}});
        const output = page.locator('[data-testid^="output-node-"]');
        await expect(output).toHaveCount(1, SLOW);
        await expect(output.getByTestId('output-value')).toHaveText('—');

        // Wire the value into every argument; the draft becomes a call.
        const valueId = (await value.getAttribute('data-testid'))!.replace('value-input-node-', '');
        const invocationId = (await invocation.getAttribute('data-testid'))!.replace('function-node-', '');
        const outputId = (await output.getAttribute('data-testid'))!.replace('output-node-', '');
        for (const argument of ['amount', 'annualRate', 'years']) {
            await handle(page, valueId, 'out:*').dragTo(handle(page, invocationId, `in:${argument}`));
        }
        await expect(invocation.getByText('draft', {exact: true})).toHaveCount(0);
        await handle(page, invocationId, 'out:result').dragTo(handle(page, outputId, 'in:value'));
        await expect(page.locator('.react-flow__edge')).toHaveCount(4);

        // The value starts at 0, out of the domain of `pmt`: the output says so.
        await expect(output.getByTestId('output-value')).toContainText('pmt arguments out of domain', SLOW);
        // One value feeds every argument: 1 at 100% a year over 1 year is 0.13 a month.
        await page.getByRole('button', {name: /^Value of /}).click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('1');
        await page.keyboard.press('Enter');
        await expect(output.getByTestId('output-value')).toHaveText('0.13');

        // The workbook is a part of the model now, and it is saved.
        await expectSaved(
            page,
            'loan-repayment',
            'node: monthlyPayment(amount: value, annualRate: value, years: value)',
        );
        await expectSaved(page, 'loan-repayment', 'value: 1');
        await expectSaved(page, 'loan-repayment', '"handle":"out:result"');
        await page.reload();
        await expectProjectOpen(page, LOAN_REPAYMENT.name);
        await expect(page.locator('.react-flow__edge')).toHaveCount(4, SLOW);
        await expect(page.locator('[data-testid^="output-node-"]').getByTestId('output-value')).toHaveText('0.13');
    });

    test('dragging Object, List and Value inputs drops each where it lands', async ({page}) => {
        const pane = page.locator('.react-flow__pane');
        const canvas = await box(pane);
        const target = {x: canvas.x + canvas.width - 320, y: canvas.y + 60};
        await paletteItem(page, 'Add object input').dragTo(pane, {
            targetPosition: {x: target.x - canvas.x, y: target.y - canvas.y},
        });
        const object = page.locator('[data-testid^="object-input-node-"]');
        await expect(object).toHaveCount(1, SLOW);
        await expect(object.getByRole('button', {name: 'value', exact: true})).toBeVisible();
        const dropped = await box(object);
        // The top-left corner lands on the drop point, snapped to the 20px grid.
        expect(Math.abs(dropped.x - target.x)).toBeLessThan(40);
        expect(Math.abs(dropped.y - target.y)).toBeLessThan(40);

        await paletteItem(page, 'Add list input').dragTo(pane, {targetPosition: {x: 60, y: 300}});
        const list = page.locator('[data-testid^="list-input-node-"]');
        await expect(list.getByTestId('list-input-table')).toContainText('#value112233', SLOW);
    });
    test('a node dropped on another node moves to a free place and leaves its pins reachable', async ({page}) => {
        const pane = page.locator('.react-flow__pane');
        await paletteItem(page, 'Add invocation').dragTo(pane, {targetPosition: {x: 300, y: 100}});
        const invocation = page.locator('[data-testid^="function-node-"]');
        await expect(invocation).toContainText('Pick a function or ruleset', SLOW);
        const under = await box(invocation);
        const canvas = await box(pane);
        await paletteItem(page, 'Add output').dragTo(pane, {
            targetPosition: {x: under.x - canvas.x + 20, y: under.y - canvas.y + 20},
        });
        const output = page.locator('[data-testid^="output-node-"]');
        await expect(output).toHaveCount(1, SLOW);
        expect(overlaps(await box(output), await box(invocation))).toBe(false);
    });

    test('the error of a value input has its own wrapped line below the field', async ({page}) => {
        const pane = page.locator('.react-flow__pane');
        await paletteItem(page, 'Add value input').dragTo(pane, {targetPosition: {x: 40, y: 60}});
        const value = page.locator('[data-testid^="value-input-node-"]');
        await expect(value).toHaveCount(1, SLOW);
        await paletteItem(page, 'Add invocation').dragTo(pane, {targetPosition: {x: 480, y: 60}});
        const invocation = page.locator('[data-testid^="function-node-"]');
        await invocation.getByRole('button', {name: 'Select callee'}).click();
        await page.getByRole('option', {name: /^monthlyPayment\(/}).click();
        const valueId = (await value.getAttribute('data-testid'))!.replace('value-input-node-', '');
        const invocationId = (await invocation.getAttribute('data-testid'))!.replace('function-node-', '');
        for (const argument of ['amount', 'annualRate', 'years']) {
            await handle(page, valueId, 'out:*').dragTo(handle(page, invocationId, `in:${argument}`));
        }
        await expect(invocation.getByText('draft', {exact: true})).toHaveCount(0);

        await page.getByRole('button', {name: /^Value of /}).click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('"rich"');
        await page.keyboard.press('Enter');
        const alert = value.getByRole('alert');
        await expect(alert).toBeVisible(SLOW);
        // Below the field, not over it, and the whole text is shown.
        const field = await box(page.getByTestId(`value-editor-${valueId}`));
        expect((await box(alert)).y).toBeGreaterThanOrEqual(field.y + field.height - 1);
        expect(await alert.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await alert.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    });
});
