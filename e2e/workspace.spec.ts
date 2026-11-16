import {test, expect, type Page} from './support/fixtures';
import {
    copyExample,
    createBlankProject,
    expectLocation,
    expectProjectOpen,
    LOAN_REPAYMENT,
    SLOW,
    topBar,
} from './support/app';

// The local workspace: the projects of the user, kept in the IndexedDB of the browser. A project is created blank or
// copied from the library, then renamed, duplicated and deleted, and every change outlives a reload.

function titles(page: Page) {
    return page.getByTestId('project-panel').getByRole('link');
}

async function chooseProjectAction(page: Page, name: string, action: string): Promise<void> {
    await page.getByRole('button', {name: `Menu of ${name}`, exact: true}).click();
    await page.getByRole('menuitem', {name: action}).click();
}

test('a new blank project opens empty and is listed in the Workspace and on Home', async ({page}) => {
    await createBlankProject(page, 'Pricing rules');
    await expectLocation(page, '/project/pricing-rules?view=flow');
    await expect(topBar(page).getByRole('link', {name: 'Pricing rules'})).toBeVisible();

    await topBar(page).getByRole('link', {name: 'Workspace'}).click();
    await expect(titles(page)).toHaveText(['Pricing rules']);
    await topBar(page).getByRole('link', {name: 'Home'}).click();
    await expect(page.getByRole('region', {name: 'Recent projects'}).getByRole('link')).toHaveText(['Pricing rules']);
});

test('the Home page creates a blank project too', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button', {name: 'New project'}).click(SLOW);
    await page.getByRole('textbox', {name: 'Name'}).fill('From home');
    await page.getByRole('button', {name: 'Create'}).click();
    await expectLocation(page, '/project/from-home?view=flow');
    await expectProjectOpen(page, 'From home');
});

test('a copy is renamed, duplicated and deleted, and the workspace keeps every change after a reload', async ({
    page,
}) => {
    await copyExample(page, LOAN_REPAYMENT);
    await topBar(page).getByRole('link', {name: 'Workspace'}).click();
    await expect(titles(page)).toHaveText([LOAN_REPAYMENT.name]);

    await chooseProjectAction(page, LOAN_REPAYMENT.name, 'Rename');
    await page.getByRole('textbox', {name: 'Name'}).fill('My loans');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(titles(page)).toHaveText(['My loans']);
    // The open tab of the project follows the new name.
    await expect(topBar(page).getByRole('link', {name: 'My loans'})).toBeVisible();

    // A duplicate keeps the origin and gets a free name.
    await chooseProjectAction(page, 'My loans', 'Duplicate');
    await expect(titles(page)).toHaveCount(2);
    await expect(page.getByTestId('project-panel').filter({hasText: 'loan-repayment@'})).toHaveCount(2);

    await page.reload();
    await expect(titles(page)).toHaveCount(2, SLOW);
    const names = await titles(page).allTextContents();
    expect(names).toContain('My loans');
    const duplicate = names.find((name) => name !== 'My loans')!;

    // Delete asks first; Cancel keeps the project.
    await chooseProjectAction(page, duplicate, 'Delete');
    await expect(page.getByText(/This cannot be undone/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
    await expect(titles(page)).toHaveCount(2);
    await chooseProjectAction(page, duplicate, 'Delete');
    await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();
    await expect(titles(page)).toHaveText(['My loans']);

    // Deleting the project of an open tab closes the tab.
    await chooseProjectAction(page, 'My loans', 'Duplicate');
    await expect(titles(page)).toHaveCount(2);
    const second = (await titles(page).allTextContents()).find((name) => name !== 'My loans')!;
    await titles(page).filter({hasText: second}).click();
    await expectProjectOpen(page, second);
    await topBar(page).getByRole('link', {name: 'Workspace'}).click();
    await expect(topBar(page).getByRole('link', {name: second})).toBeVisible();
    await chooseProjectAction(page, second, 'Delete');
    await page.getByRole('dialog').getByRole('button', {name: 'Delete'}).click();
    await expect(titles(page)).toHaveText(['My loans']);
    await expect(topBar(page).getByRole('link', {name: second})).toHaveCount(0);

    await page.reload();
    await expect(titles(page)).toHaveText(['My loans'], SLOW);
    // The renamed project keeps its path: the link still opens it.
    await titles(page).click();
    await expectLocation(page, '/project/loan-repayment?view=flow');
    await expectProjectOpen(page, 'My loans');
});

test('a second copy of one example gets its own name and path', async ({page}) => {
    await copyExample(page, LOAN_REPAYMENT);
    await page.goto(`/examples/financial/loan-repayment@${LOAN_REPAYMENT.version}`);
    await page.getByRole('button', {name: 'Copy to workspace'}).click(SLOW);
    // The top bar, not a typed link: a page load would cancel the copy.
    await topBar(page).getByRole('link', {name: 'Workspace'}).click();
    await expect(titles(page)).toHaveCount(2, SLOW);
    expect((await titles(page).allTextContents()).sort()).toEqual([LOAN_REPAYMENT.name, `${LOAN_REPAYMENT.name} (2)`]);
    await titles(page).filter({hasText: '(2)'}).click();
    await expectLocation(page, '/project/loan-repayment-2?view=flow');
    await expectProjectOpen(page, `${LOAN_REPAYMENT.name} (2)`);
});

test('the workspace is shared by two tabs of one browser', async ({page, context}) => {
    await copyExample(page, LOAN_REPAYMENT);
    const other = await context.newPage();
    await other.goto('/workspace');
    await expect(other.getByTestId('project-panel').getByRole('link')).toHaveText([LOAN_REPAYMENT.name], SLOW);
    await other.getByTestId('project-panel').getByRole('link').click();
    await expectProjectOpen(other, LOAN_REPAYMENT.name);
});
