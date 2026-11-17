import {expect, type Locator, type Page} from './fixtures';

/**
 * The published examples the specs work with, each pinned to a released version: the files of a version are pinned
 * to a commit, so the model, its tests and its values never change under a spec.
 */
export const LOAN_ORIGINATION = {
    id: 'loan-origination',
    version: '2.0.1',
    industry: 'financial',
    name: 'Loan Origination',
};
export const LOAN_REPAYMENT = {id: 'loan-repayment', version: '1.2.0', industry: 'financial', name: 'Loan Repayment'};
export const CLIENT_OUTREACH = {
    id: 'client-outreach',
    version: '1.0.0',
    industry: 'financial',
    name: 'Client Outreach',
};

export type Example = typeof LOAN_ORIGINATION;

// The engine loads, the library is read and xyflow measures every node before a project shows: wait longer.
export const SLOW = {timeout: 30_000};

/** The pathname and search of the page, as the address bar shows it relative to the app. */
export function location(page: Page): string {
    const url = new URL(page.url());
    return decodeURIComponent(url.pathname + url.search);
}

/** Waits until the address bar shows `expected` (pathname and search, decoded). */
export async function expectLocation(page: Page, expected: string | RegExp): Promise<void> {
    await expect
        .poll(() => location(page), {timeout: SLOW.timeout})
        .toMatch(
            typeof expected === 'string'
                ? new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
                : expected,
        );
}

export function topBar(page: Page): Locator {
    return page.getByRole('navigation', {name: 'Modeler'});
}

export function explorer(page: Page): Locator {
    return page.getByRole('navigation', {name: 'Project explorer'});
}

export function crumbs(page: Page): Locator {
    return page.getByRole('navigation', {name: 'Model path'});
}

/** The tree item of an explorer entry, by its kind and its model path (`function:affordability`). */
export function entry(page: Page, kind: string, path: string): Locator {
    return explorer(page).locator(`[role="treeitem"][data-value="${kind}:${path}"]`);
}

/** The label of a section of the explorer: a click collapses or expands the section. */
export function section(page: Page, label: string): Locator {
    return explorer(page).getByText(label, {exact: true});
}

export function view(page: Page, name: 'Flow' | 'DRD' | 'Boxed' | 'Code' | 'Tests'): Locator {
    // At the model root the Flow view reads "Overview".
    return page.getByRole('radio', {name: name === 'Flow' ? /^(Flow|Overview)$/ : name});
}

export async function expectView(page: Page, name: Parameters<typeof view>[1]): Promise<void> {
    await expect(view(page, name)).toHaveAttribute('aria-checked', 'true');
}

export function flowNode(page: Page, id: string): Locator {
    return page.locator(`.react-flow__node[data-id="${id}"]`);
}

/** Waits until the project is open in the Shell: its menu shows and the engine has loaded it. */
export async function expectProjectOpen(page: Page, name: string): Promise<void> {
    await expect(page.getByRole('button', {name: `Project menu: ${name}`, exact: true})).toBeVisible(SLOW);
}

/**
 * Copies a published example into the workspace from its details page, as a first-time user does, and waits until
 * the copy is open in its Flow view: `/project/<example id>?view=flow`.
 */
export async function copyExample(page: Page, example: Example): Promise<string> {
    await page.goto(`/examples/${example.industry}/${example.id}@${example.version}`);
    await expect(page.getByRole('heading', {name: example.name, level: 2})).toBeVisible(SLOW);
    await page.getByRole('button', {name: 'Copy and open'}).first().click();
    await expectLocation(page, `/project/${example.id}?view=flow`);
    await expectProjectOpen(page, example.name);
    return example.id;
}

/**
 * Copies an example and opens a deep link of it: `path` is a root path of the model (`affordability`), `view` a view
 * of the Shell. The link is typed in the address bar, so the app loads again from the URL.
 */
export async function openExample(
    page: Page,
    example: Example,
    target: {path?: string; view?: 'flow' | 'drd' | 'boxed' | 'code' | 'tests'} = {},
): Promise<void> {
    await copyExample(page, example);
    if (!target.path && (!target.view || target.view === 'flow')) return;
    const path = target.path ? `/${target.path}` : '';
    await page.goto(`/project/${example.id}${path}${target.view ? `?view=${target.view}` : ''}`);
    await expectProjectOpen(page, example.name);
}

/** Creates an empty project from the Workspace page and waits until it is open. */
export async function createBlankProject(page: Page, name: string): Promise<void> {
    await page.goto('/workspace');
    await page.getByTestId('local-workspace').getByRole('button', {name: 'New project'}).first().click(SLOW);
    await page.getByRole('textbox', {name: 'Name'}).fill(name);
    await page.getByRole('button', {name: 'Create'}).click();
    await expectProjectOpen(page, name);
}

/** Replaces the whole text of the focused CodeMirror editor (or the first one of the page). */
export async function replaceCode(page: Page, code: string, editor: Locator = page.locator('.cm-content').first()) {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    if (code === '') await page.keyboard.press('Backspace');
    else await page.keyboard.insertText(code);
}

/** The project menu of the Shell, the first crumb of the model path: "Project Overview" opens the model root. */
export async function openProjectOverview(page: Page): Promise<void> {
    await crumbs(page)
        .getByRole('button', {name: /^Project menu: /})
        .click();
    await page.getByRole('menuitem', {name: 'Project Overview'}).click();
}

/**
 * Waits until the workspace in IndexedDB holds `text` in the project at `projectPath`: the autosave of the app has
 * written the change. A reload before that would test the save timing, not the app. The record is read as JSON, so a
 * quote inside the model DSL reads `\"`; the tests and the documentation are plain JSON objects.
 */
export async function expectSaved(
    page: Page,
    projectPath: string,
    text: string,
    {absent = false}: {absent?: boolean} = {},
): Promise<void> {
    const saved = expect.poll(
        () =>
            page.evaluate(
                ([path]) =>
                    new Promise<string>((resolve, reject) => {
                        const open = indexedDB.open('edgerules-modeler-dev');
                        open.onerror = () => reject(open.error);
                        open.onsuccess = () => {
                            const read = open.result.transaction('projects').objectStore('projects').get(path);
                            read.onsuccess = () => {
                                open.result.close();
                                resolve(JSON.stringify(read.result ?? null));
                            };
                            read.onerror = () => reject(read.error);
                        };
                    }),
                [projectPath],
            ),
        {
            message: `the project ${projectPath} should be saved ${absent ? 'without' : 'with'} "${text}"`,
            timeout: SLOW.timeout,
        },
    );
    await (absent ? saved.not.toContain(text) : saved.toContain(text));
}
