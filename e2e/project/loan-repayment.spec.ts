import {test, expect} from '../support/fixtures';
import {
    copyExample,
    explorer,
    expectLocation,
    expectSaved,
    flowNode,
    LOAN_REPAYMENT,
    openExample,
    replaceCode,
    SLOW,
    view,
} from '../support/app';

// The published Loan Repayment example in the app: every part of the model renders with the values of the real
// engine, and an edit recalculates what depends on it.

test('the Project Explorer lists every element of the model', async ({page}) => {
    await copyExample(page, LOAN_REPAYMENT);
    const nav = explorer(page);
    // A workbook is listed by its `@Name`.
    for (const name of ['LoanRequest', 'Installment', 'samplePayment', 'Mortgage plan', '15 vs 30 years']) {
        await expect(nav.getByText(name, {exact: true}), name).toBeVisible();
    }
    for (const method of ['pricingTier(...)', 'loanRepayment(...)', 'monthlyPayment(...)', 'yearlySummary(...)']) {
        await expect(nav.getByText(method, {exact: true}).first(), method).toBeVisible();
    }
});

test.describe('the pricingTier decision table', () => {
    test('keeps its header row and its columns; the default row lines up with the action columns', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'pricingTier'});
        await expect(page.getByTestId('row-pricingTier')).toBeVisible();
        for (const column of ['creditScore', 'years', 'tier', 'premium', 'approved']) {
            await expect(page.getByTestId(`column-pricingTier-${column}`), column).toBeVisible();
        }
        const tier = (await page.getByTestId('column-pricingTier-tier').boundingBox())!;
        const declined = (await page.getByTestId('row-pricingTier.default').getByText('"declined"').boundingBox())!;
        expect(Math.abs(declined.x - tier.x)).toBeLessThan(12);
    });

    test('runs its own tests when its test column is shown and steps through the cases', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'pricingTier'});
        await expect(page.getByTestId('header-row').getByRole('heading')).toHaveText('Decision table');
        await page.getByRole('button', {name: 'Show test column'}).click();
        const result = page.getByTestId('row-pricingTier').locator('[data-column="test-results"]');
        await expect(result).toHaveText(/tier: \w+/, SLOW);
        await page.getByRole('button', {name: 'Next test case'}).click();
        await expect(page.getByTestId('header-row')).toContainText(/2\/\d+/);
        await expect(result).toHaveText(/tier: \w+/);
    });
});

test.describe('the workbooks', () => {
    test('Mortgage plan charts the repayment plan and shows its outputs', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
        await expect(page.getByRole('img', {name: 'Remaining balance'})).toBeVisible(SLOW);
        await expect(page.getByRole('img', {name: 'Yearly interest and principal'})).toBeVisible();

        const payment = page.getByTestId('output-node-output');
        await expect(payment.getByTestId('output-value')).toHaveText('1354.35');
        await expect(page.getByTestId('output-node-output2').getByTestId('output-value')).toHaveText('2 fields');
        const schedule = page.getByTestId('output-node-output3');
        await expect(schedule.getByTestId('output-value')).toHaveText('300 rows × 5 columns');
        await expect(schedule.getByTestId('output-table').getByRole('columnheader')).toHaveText([
            '#',
            'period',
            'payment',
            'interest',
            'principal',
            'balance',
        ]);
        // The title stays whole next to the long source path; the path is the part that is cut.
        const title = payment.getByText('Monthly payment', {exact: true});
        const {clientWidth, scrollWidth} = await title.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        expect(clientWidth).toBeGreaterThan(0);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('15 vs 30 years charts the balance of both terms', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'termComparisonBook', view: 'flow'});
        await expect(page.getByRole('img', {name: 'Balance by year'})).toBeVisible(SLOW);
        await expect(page.getByTestId('output-node-output').getByTestId('output-value')).toHaveText('1423.43');
        await expect(page.getByTestId('output-node-output2').getByTestId('output-value')).toHaveText('966.28');
    });

    test('a change in the split screen shows on the canvas, recalculates the outputs and is saved', async ({page}) => {
        await openExample(page, LOAN_REPAYMENT, {path: 'mortgageBook', view: 'flow'});
        const yearly = flowNode(page, 'mortgageBook.yearly');
        await expect(yearly).toBeVisible(SLOW);
        const panel = page.getByTestId('shell-split-panel');

        // The chart is wired to the unnamed return of `yearlySummary`: the whole list of the node.
        const chart = flowNode(page, 'chart2');
        await expect(chart.getByRole('img', {name: 'Yearly interest and principal'})).toBeVisible();
        await expect(chart).toContainText('mortgageBook.yearly');

        // A new field of the function body is a new result of the node.
        await yearly.click({position: {x: 30, y: 10}});
        await expect(panel.getByTestId('row-yearlySummary.result')).toBeVisible();
        await expect(yearly.locator('[data-handleid="out:field"]')).toHaveCount(0);
        await panel.getByText('(new item)').click();
        await expect(panel.getByTestId('row-yearlySummary.field')).toBeVisible();
        await expect(yearly.locator('[data-handleid="out:field"]')).toHaveCount(1);

        // The body is a record now: the wire on the `result` pin reads the field `result`, the same list.
        await expect(chart).toContainText('mortgageBook.yearly.result');
        await expect(chart.getByRole('img', {name: 'Yearly interest and principal'})).toBeVisible();
        await expect(page.getByTestId('rf__edge-chart2:data')).toHaveCount(1);

        // An expression changed in the panel recalculates the output nodes that read it.
        const payment = page.getByTestId('output-node-output').getByTestId('output-value');
        await expect(payment).toHaveText('1354.35');
        await flowNode(page, 'mortgageBook.repayment').click({position: {x: 30, y: 10}});
        await panel.getByTestId('row-loanRepayment.payment').locator('[data-column="value"]').click();
        await replaceCode(page, '1000', page.locator('.cm-content'));
        await page.keyboard.press('Enter');
        await expect(payment).toHaveText('1000');

        await expectSaved(page, 'loan-repayment', 'payment: 1000');
        await page.reload();
        await expect(page.getByTestId('output-node-output').getByTestId('output-value')).toHaveText('1000', SLOW);
    });
});

test('the service flow shows the request parameter, the body invocations and the Repayment return', async ({page}) => {
    await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment', view: 'flow'});
    const request = page.getByTestId('parameter-node-loanRepayment.request');
    await expect(request).toBeVisible(SLOW);
    await expect(request).toContainText('LoanRequest');
    for (const field of ['amount', 'years', 'creditScore']) await expect(request).toContainText(field);
    for (const node of ['pricing', 'rate', 'annuity', 'fullSchedule', 'cost']) {
        await expect(page.getByTestId(`function-node-loanRepayment.${node}`), node).toBeVisible();
    }
    const result = page.getByTestId('return-node-loanRepayment.return');
    await expect(result).toContainText('Repayment');
    await expect(result).toContainText('{ pricing, rate, payment, schedule, cost }');
    await expect(page.locator('.react-flow__edge[data-id="loanRepayment.pricing:creditScore"]')).toHaveCount(1);
    await expect(page.locator('.react-flow__edge[data-id="loanRepayment.return:pricing"]')).toHaveCount(1);
});

test('the service tests run when opened, pass when run again, and scroll instead of squeezing', async ({page}) => {
    await openExample(page, LOAN_REPAYMENT, {path: 'loanRepayment', view: 'tests'});
    const summaries = page.getByTestId(/^assertion-summary-/);
    await expect(summaries).toHaveCount(5, SLOW);
    const header = page.getByTestId('case-header-loanRepayment-1');
    expect((await header.boundingBox())!.width).toBeGreaterThanOrEqual(159);

    await page.getByRole('button', {name: 'Run all'}).click();
    await expect(summaries.nth(0)).toHaveText('7/7');
    await expect(summaries.nth(4)).toHaveText('6/6');
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);
});

test('an edit in the Code view of a function recalculates the workbook that calls it and is saved', async ({page}) => {
    await openExample(page, LOAN_REPAYMENT, {path: 'annualRate', view: 'code'});
    const code = page.locator('.cm-content').first();
    await expect(code).toContainText('0.035 + pricingTier(creditScore, years).premium');
    const text = await code.evaluate((element) => (element as HTMLElement).innerText);
    // The base rate goes from 3.5% to 5.25%: the prime mortgage of 250 000 over 25 years then costs 6% a year.
    await replaceCode(page, text.replace('0.035', '0.0525'));
    await expect(code).toContainText('0.0525 + pricingTier');

    // The Boxed view of the same function shows the committed edit.
    await view(page, 'Boxed').click();
    await expectLocation(page, '/project/loan-repayment/annualRate');
    await expect(page.getByRole('treegrid')).toContainText('0.0525 + pricingTier', SLOW);

    await explorer(page).getByText('Mortgage plan', {exact: true}).click();
    await expectLocation(page, '/project/loan-repayment/mortgageBook?view=flow');
    await expect(page.getByTestId('output-node-output').getByTestId('output-value')).toHaveText('1610.75', SLOW);

    await expectSaved(page, 'loan-repayment', '0.0525');
    await page.reload();
    await expect(page.getByTestId('output-node-output').getByTestId('output-value')).toHaveText('1610.75', SLOW);
});
