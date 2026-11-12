import {test, expect, type Page} from '@playwright/test';
import {openStory} from '../support/storybook';

// The Modeler opens the tests of the loan repayment service, where every case passes. "Run all" then shows the
// "All tests passed" notification in the bottom-right corner; it closes on its own after 3 seconds.

const STORY_ID = 'modeler--loan-repayment-project-tests';
const SLOW = {timeout: 30_000};

async function openTests(page: Page) {
    await openStory(page, STORY_ID);
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
    // The cases run on their own when the subject opens: wait for every result before "Run all".
    const summaries = page.getByTestId(/^assertion-summary-/);
    await expect(summaries).toHaveCount(5, SLOW);
    await expect(page.getByRole('button', {name: 'Run all'})).not.toHaveAttribute('aria-busy', 'true');
}

async function runAll(page: Page) {
    const button = page.getByRole('button', {name: 'Run all'});
    await button.click();
    await expect(button).not.toHaveAttribute('aria-busy', 'true', SLOW);
}

test('Run all shows "All tests passed" in the bottom-right corner and closes it after 3 seconds', async ({page}) => {
    await openTests(page);
    const notification = page.getByTestId('all-tests-passed');
    // Opening the tests runs them, but only "Run all" reports.
    await expect(notification).toHaveCount(0);

    await page.getByRole('button', {name: 'Run all'}).click();
    await expect(notification).toBeVisible(SLOW);
    const shownAt = Date.now();
    await expect(notification).toContainText('All tests passed');
    await expect(notification).toContainText('5 test cases passed.');
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);

    // The pointer stays away from the notification: hovering would hold it open.
    await page.mouse.move(0, 0);
    const box = (await notification.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(viewport.width - (box.x + box.width)).toBeLessThan(48);
    expect(viewport.height - (box.y + box.height)).toBeLessThan(48);
    expect(box.x).toBeGreaterThan(viewport.width / 2);
    expect(box.y).toBeGreaterThan(viewport.height / 2);

    await page.waitForTimeout(Math.max(0, 2_000 - (Date.now() - shownAt)));
    await expect(notification).toBeVisible();
    await expect(notification).toHaveCount(0, {timeout: 3_000});
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(2_500);
});

test('Run all shows no notification when a test case fails', async ({page}) => {
    await openTests(page);
    const assertion = page.getByLabel(/^assertion /).first();
    await assertion.fill('999999999');
    await assertion.press('Enter');
    await expect(page.locator('[data-mismatch="true"]')).not.toHaveCount(0, SLOW);

    await runAll(page);
    // The notification would show as soon as the run ends: give it a moment, then check it never did.
    await page.waitForTimeout(1_000);
    await expect(page.locator('[data-mismatch="true"]')).not.toHaveCount(0);
    await expect(page.getByTestId('all-tests-passed')).toHaveCount(0);
    await expect(page.getByText('All tests passed')).toHaveCount(0);
});
