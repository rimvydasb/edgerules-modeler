import {test, expect, type Page} from '@playwright/test';
import {openStory} from '../support/storybook';

// The README of a project in the Shell (docs/stories/model-readme-story.md): the Documents section of the Project
// Explorer, the Preview and Code views of the document root, the README panel of the model root, and a save that keeps
// the README after a reload.

// The engine loads before the Shell shows: the first lookup waits longer.
const SLOW = {timeout: 15_000};

function explorer(page: Page) {
    return page.getByRole('navigation', {name: 'Project explorer'});
}

function crumbs(page: Page) {
    return page.getByRole('navigation', {name: 'Model path'});
}

async function expectView(page: Page, view: string) {
    const name = view === 'Flow' ? /^(Flow|Overview)$/ : view;
    await expect(page.getByRole('radio', {name})).toHaveAttribute('aria-checked', 'true');
}

test('opens README from the explorer, edits it in Code, saves, and keeps it after a reload', async ({page}) => {
    // A fresh stored project per run: the reload reopens it.
    const key = `e2e${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const url = `/iframe.html?id=components-shell--saved-project&viewMode=story&args=projectKey:${key}`;
    await page.goto(url);

    await explorer(page).getByText('README.md', {exact: true}).click(SLOW);
    await expectView(page, 'Preview');
    await expect(crumbs(page)).toHaveText(/README\.md/);
    await expect(page.getByRole('radiogroup', {name: 'View'}).getByRole('radio')).toHaveText(['Preview', 'Code']);
    const preview = page.getByTestId('shell-document-preview');
    await expect(preview.getByRole('heading', {name: 'Shell story'})).toBeVisible();
    // The Preview view is read-only: no editor.
    await expect(page.locator('.cm-editor')).toHaveCount(0);

    await page.getByRole('radio', {name: 'Code'}).click();
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('# Shell story');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\nKept after a reload.\n');
    await expect(page.getByTestId('host-save-state')).toContainText('dirty: readme');

    await page.getByRole('button', {name: 'Save'}).click();
    await expect(page.getByTestId('host-save-state')).toContainText('dirty: none');

    await page.reload();
    await explorer(page).getByText('README.md', {exact: true}).click(SLOW);
    await expect(page.getByTestId('shell-document-preview')).toContainText('Kept after a reload.');
});

test('a model: link of the README opens that model path', async ({page}) => {
    await openStory(page, 'components-shell--readme-document');
    await page.getByTestId('shell-document-preview').getByRole('link', {name: 'applicant'}).click(SLOW);
    await expect(crumbs(page)).toContainText('applicant');
    await expectView(page, 'Boxed');
    await expect(page.getByTestId('row-applicant')).toBeVisible();
});

test('the Overview shows the README panel above the workbooks; a click opens the README', async ({page}) => {
    await openStory(page, 'models-loan-repayment--overview');
    const picker = page.getByTestId('shell-workbook-picker');
    const panel = picker.getByTestId('shell-readme-panel');
    await expect(panel.getByRole('heading', {name: 'Loan Repayment Planner'})).toBeVisible(SLOW);

    // Above the workbooks, at most 260px high.
    const panelBox = (await panel.boundingBox())!;
    const workbookBox = (await picker.getByTestId('shell-workbook-mortgageBook').boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(workbookBox.y);
    expect(panelBox.height).toBeLessThanOrEqual(261);
    // The README is higher than the panel: it is cut off with a fade.
    await expect(panel.locator('[data-cut]')).toHaveCount(1);

    // At most 3 cards in a row.
    const tops = await picker
        .getByRole('region', {name: 'Workbooks'})
        .locator('button')
        .evaluateAll((panels) => panels.map((element) => Math.round(element.getBoundingClientRect().top)));
    expect(tops.filter((top) => top === tops[0]).length).toBeLessThanOrEqual(3);

    await panel.getByText(/Prices consumer loans/).click();
    await expectView(page, 'Preview');
    await expect(crumbs(page)).toHaveText(/Loan Repayment Planner.*README\.md/);
    await expect(page.getByTestId('shell-document-preview').getByRole('table').first()).toBeVisible();
});
