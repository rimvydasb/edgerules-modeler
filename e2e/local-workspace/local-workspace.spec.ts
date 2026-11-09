import {test, expect, type Page} from '@playwright/test';

// The Local Workspace (docs/stories/examples-library-story.md): copy an example, then rename, duplicate and delete the
// copy, and keep the projects after a reload. The stored fixture story keeps its IndexedDB database across reloads.

const SLOW = {timeout: 30_000};

function panelTitles(page: Page) {
    return page.getByTestId('project-panel').getByRole('link');
}

test('copies an example, renames, duplicates and deletes it, and keeps the projects after a reload', async ({page}) => {
    const key = `e2e${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/iframe.html?id=modeler--stored-workspace&viewMode=story&args=workspaceKey:${key}`);

    // Copy and open, then back to the Workspace page.
    await page.getByLabel('Search examples').fill('loan repayment', SLOW);
    await page
        .getByTestId('example-panel')
        .filter({hasText: 'Loan repayment'})
        .first()
        .getByRole('button', {name: 'Copy and open'})
        .click(SLOW);
    await page.getByTestId('shell').getByRole('button', {name: 'Workspace', exact: true}).click(SLOW);
    await expect(panelTitles(page)).toHaveText(['Loan repayment']);
    await expect(page.getByTestId('project-panel')).toContainText('from loan-repayment@');

    // Rename.
    await page.getByRole('button', {name: 'Menu of Loan repayment'}).click();
    await page.getByRole('menuitem', {name: 'Rename'}).click();
    await page.getByRole('textbox', {name: 'Name'}).fill('My loans');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(panelTitles(page)).toHaveText(['My loans']);

    // Duplicate: same origin, suffixed name.
    await page.getByRole('button', {name: 'Menu of My loans'}).click();
    await page.getByRole('menuitem', {name: 'Duplicate'}).click();
    await expect(panelTitles(page)).toHaveCount(2);
    await expect(page.getByTestId('project-panel').filter({hasText: 'from loan-repayment@'})).toHaveCount(2);

    // Reload: the stored workspace keeps both.
    await page.reload();
    await page.getByTestId('modeler-app').getByRole('button', {name: 'Workspace', exact: true}).click(SLOW);
    await expect(panelTitles(page)).toHaveCount(2);
    const names = await panelTitles(page).allTextContents();
    expect(names).toContain('My loans');
    const copy = names.find((name) => name !== 'My loans')!;

    // Delete the duplicate after the confirm modal.
    await page.getByRole('button', {name: `Menu of ${copy}`}).click();
    await page.getByRole('menuitem', {name: 'Delete'}).click();
    await expect(page.getByText(/This cannot be undone/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();
    await expect(panelTitles(page)).toHaveText(['My loans']);

    await page.reload();
    await page.getByTestId('modeler-app').getByRole('button', {name: 'Workspace', exact: true}).click(SLOW);
    await expect(panelTitles(page)).toHaveText(['My loans']);
});
