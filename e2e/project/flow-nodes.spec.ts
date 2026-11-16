import {test, expect, type Locator, type Page} from '../support/fixtures';
import {expectSaved, flowNode, LOAN_ORIGINATION, openExample, SLOW, view} from '../support/app';

// The nodes of a workbook canvas, edited on the Borrowing capacity workbook of the published Loan Origination example:
// the Household record input feeds each of its fields into an argument of `borrowingCapacity`. Every edit of a node
// is an edit of the model.

test.use({viewport: {width: 1680, height: 1000}});

const HOUSEHOLD = 'capacityBook.household';
const CAPACITY = 'capacityBook.capacity';
const FIELDS = {monthlyIncome: 'householdIncome', monthlyDebtPayments: 'householdDebtPayments', rate: 'rate'};

function handle(page: Page, nodeId: string, handleId: string): Locator {
    return flowNode(page, nodeId).locator(`[data-handleid="${handleId}"]`);
}

async function centerY(locator: Locator): Promise<number> {
    const box = await locator.boundingBox();
    if (!box) throw new Error('element has no box');
    return box.y + box.height / 2;
}

// The wire of a field must start at its output pin and end at its argument pin, wherever the rows are now. The wire
// is redrawn after the rows move, so the geometry is polled.
async function expectWireAtPins(page: Page, field: string, argument: string): Promise<void> {
    const path = page.getByTestId(`rf__edge-${CAPACITY}:${argument}`).locator('.react-flow__edge-path').first();
    await expect
        .poll(
            async () => {
                const wire = await path.boundingBox();
                if (!wire) return 'no wire';
                const source = await centerY(handle(page, HOUSEHOLD, `out:${field}`));
                const target = await centerY(handle(page, CAPACITY, `in:${argument}`));
                return [
                    Math.abs(wire.y - Math.min(source, target)) < 5,
                    Math.abs(wire.y + wire.height - Math.max(source, target)) < 5,
                ].join();
            },
            {message: `the wire of ${field} ends at its pins`},
        )
        .toBe('true,true');
}

async function expectAllWires(page: Page): Promise<void> {
    for (const [field, argument] of Object.entries(FIELDS)) await expectWireAtPins(page, field, argument);
}

async function fieldMenu(page: Page, name: string): Promise<void> {
    await page.getByRole('button', {name: `Actions for field ${name}`}).click();
}

const capacity = (page: Page) => page.getByTestId('output-node-output').getByTestId('output-value');

test.beforeEach(async ({page}) => {
    await openExample(page, LOAN_ORIGINATION, {path: 'capacityBook', view: 'flow'});
    await expect(flowNode(page, HOUSEHOLD)).toBeVisible(SLOW);
    await expect(capacity(page)).toHaveText('5 rows × 3 columns');
});

test.describe('a record input', () => {
    test('shows a pin and the value of every field, and the whole-record pin on the right edge', async ({page}) => {
        for (const name of [...Object.keys(FIELDS), '*']) {
            await expect(handle(page, HOUSEHOLD, `out:${name}`), name).toBeVisible();
        }
        await expect(page.getByRole('button', {name: 'Value of monthlyIncome'})).toHaveText('6800');
        await expect(page.getByRole('button', {name: 'Value of rate'})).toHaveText('0.0425');
        const node = (await page.getByTestId(`object-input-node-${HOUSEHOLD}`).boundingBox())!;
        const pin = (await handle(page, HOUSEHOLD, 'out:rate').boundingBox())!;
        expect(Math.abs(pin.x + pin.width / 2 - (node.x + node.width))).toBeLessThanOrEqual(12);
        await expectAllWires(page);
    });

    test('Move down and Move up keep every wire on its own pin; the ends of the list are disabled', async ({page}) => {
        await fieldMenu(page, 'monthlyIncome');
        await expect(page.getByRole('menuitem', {name: 'Move up'})).toHaveAttribute('data-disabled', 'true');
        await page.getByRole('menuitem', {name: 'Move down'}).click();
        await expect(flowNode(page, HOUSEHOLD)).toContainText('{ monthlyDebtPayments, monthlyIncome, rate }');
        expect(await centerY(handle(page, HOUSEHOLD, 'out:monthlyIncome'))).toBeGreaterThan(
            await centerY(handle(page, HOUSEHOLD, 'out:monthlyDebtPayments')),
        );
        await expectAllWires(page);
        await expect(capacity(page)).toHaveText('5 rows × 3 columns');

        await fieldMenu(page, 'monthlyIncome');
        await page.getByRole('menuitem', {name: 'Move up'}).click();
        await expect(flowNode(page, HOUSEHOLD)).toContainText('{ monthlyIncome, monthlyDebtPayments, rate }');
        await expectAllWires(page);

        await fieldMenu(page, 'rate');
        await expect(
            page.getByRole('menu', {name: 'Actions for field rate'}).getByRole('menuitem', {name: 'Move down'}),
        ).toHaveAttribute('data-disabled', 'true');
    });

    test('a field a function reads cannot be deleted; a new field is added, named and deleted', async ({page}) => {
        await fieldMenu(page, 'rate');
        await expect(page.getByRole('menuitem', {name: 'Delete field'})).toHaveAttribute('data-disabled', 'true');
        await page.getByRole('menuitem', {name: 'Add field below'}).click();
        const input = page.getByLabel('Rename field field');
        await input.fill('region');
        await input.press('Enter');
        await expect(flowNode(page, HOUSEHOLD)).toContainText('{ monthlyIncome, monthlyDebtPayments, rate, region }');
        await expect(handle(page, HOUSEHOLD, 'out:region')).toBeVisible();
        await expectAllWires(page);
        await expectSaved(page, 'loan-origination', 'region');

        await fieldMenu(page, 'region');
        await page.getByRole('menuitem', {name: 'Delete field'}).click();
        await expect(flowNode(page, HOUSEHOLD)).toContainText('{ monthlyIncome, monthlyDebtPayments, rate }');
        await expect(handle(page, HOUSEHOLD, 'out:region')).toHaveCount(0);
        await expectAllWires(page);
    });

    test('renaming a field moves its wire to the renamed pin and renames it in the model', async ({page}) => {
        await flowNode(page, HOUSEHOLD).getByRole('button', {name: 'rate', exact: true}).click();
        const input = page.getByLabel('Rename field rate');
        await input.fill('offeredRate');
        await input.press('Enter');
        await expect(flowNode(page, HOUSEHOLD).getByRole('button', {name: 'offeredRate', exact: true})).toBeVisible();
        await expect(handle(page, HOUSEHOLD, 'out:offeredRate')).toBeVisible();
        await expectWireAtPins(page, 'offeredRate', 'rate');
        await expect(capacity(page)).toHaveText('5 rows × 3 columns');

        await view(page, 'Code').click();
        await expect(page.locator('.cm-content').first()).toContainText('rate: household.offeredRate');
    });

    test('the node gets a name and a description', async ({page}) => {
        const node = page.getByTestId(`object-input-node-${HOUSEHOLD}`);
        await node.getByRole('button', {name: 'Node actions'}).click();
        await page.getByRole('menuitem', {name: 'Rename node'}).click();
        const name = page.getByLabel(`Name of node ${HOUSEHOLD}`);
        // The menu returns focus to its trigger when it closes; that blur used to commit and close the editor.
        await page.waitForTimeout(500);
        await expect(name).toBeVisible();
        await name.fill('Our household');
        await name.press('Enter');
        await expect(node.locator('strong', {hasText: 'Our household'})).toBeVisible();

        const description = page.getByText('The monthly income, the monthly debt payments and the offered rate');
        await description.click();
        const input = page.getByLabel(`Description of ${HOUSEHOLD}`);
        await input.fill('discarded');
        await input.press('Escape');
        await expect(description).toBeVisible();

        await expectSaved(page, 'loan-origination', '@InputNode(name: \\"Our household\\"');
    });
});

test.describe('a function node', () => {
    test('shows its callee and arguments; a used argument cannot be deleted', async ({page}) => {
        const node = page.getByTestId(`function-node-${CAPACITY}`);
        await expect(node.getByRole('button', {name: 'Callee borrowingCapacity'})).toBeVisible();
        await node.getByRole('button', {name: 'Actions for argument householdIncome'}).click();
        await expect(page.getByRole('menuitem', {name: 'Move up'})).toHaveAttribute('data-disabled', 'true');
        await expect(page.getByRole('menuitem', {name: 'Delete argument'})).toHaveAttribute('data-disabled', 'true');
        await page.keyboard.press('Escape');

        // The callee opens in the Boxed view.
        await node.getByRole('button', {name: 'Open borrowingCapacity in boxed editor'}).click();
        await expect(page.getByTestId('row-borrowingCapacity')).toBeVisible();
    });

    test('a deleted wire makes the node a draft; wiring the argument again completes it', async ({page}) => {
        const node = page.getByTestId(`function-node-${CAPACITY}`);
        await page.getByTestId(`rf__edge-${CAPACITY}:rate`).dispatchEvent('click');
        await page.keyboard.press('Delete');
        await expect(node.getByText('draft', {exact: true})).toBeVisible();

        await handle(page, HOUSEHOLD, 'out:rate').dragTo(handle(page, CAPACITY, 'in:rate'));
        await expect(node.getByText('draft', {exact: true})).toHaveCount(0);
        await expect(page.locator('.react-flow__edge')).toHaveCount(5);
        await expect(capacity(page)).toHaveText('5 rows × 3 columns');
    });

    test('a description is added and removed', async ({page}) => {
        const node = page.getByTestId(`function-node-${CAPACITY}`);
        await expect(node).toContainText('The largest affordable payment and loan for each term');
        await node.getByRole('button', {name: 'Node actions'}).click();
        await page.getByRole('menuitem', {name: 'Remove description'}).click();
        await expect(node).not.toContainText('The largest affordable payment');
        // The menu does not select the node: a selection would open the split screen and narrow the canvas until the
        // node, and its next menu, are out of view.
        await expect(page.getByTestId('shell-split-panel')).toHaveCount(0);
        await node.getByRole('button', {name: 'Node actions'}).click();
        await page.getByRole('menuitem', {name: 'Add description'}).click();
        const input = page.getByLabel(`Description of ${CAPACITY}`);
        await input.fill('Capacity by term');
        await input.press('Enter');
        await expect(node).toContainText('Capacity by term');
    });
});

test('an output shows a list of records as a table, and a dash when its wire is deleted', async ({page}) => {
    const output = page.getByTestId('output-node-output');
    await expect(output.getByTestId('output-table').getByRole('columnheader')).toHaveText([
        '#',
        'termYears',
        'maxPayment',
        'maxLoan',
    ]);
    await page.getByTestId('rf__edge-output:value').dispatchEvent('click');
    await page.keyboard.press('Delete');
    await expect(output.getByTestId('output-value')).toHaveText('—');
    await expect(output.getByTestId('output-table')).toHaveCount(0);
});
