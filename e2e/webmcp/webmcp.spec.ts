import {test, expect, type Page} from '@playwright/test';
import {openStory} from '../support/storybook';

// The WebMCP tools of an open project in a real Chromium (docs/stories/webmcp-story.md). Playwright's `page.webmcp`
// lists and calls the tools that the Modeler registers on `document.modelContext`; the `webmcp` project of
// `playwright.config.ts` enables the browser feature.

// The engine loads before the project shows: the first lookup waits longer.
const SLOW = {timeout: 15_000};

const MODEL_TOOLS = ['edit-model', 'edit-tests', 'set-documentation', 'undo-agent-change'];
const READ_TOOLS = [
    'run-tests',
    'get-project-overview',
    'get-language-guide',
    'list-model-entries',
    'read-source',
    'search-model',
    'list-tests',
    'evaluate-model',
    'open-in-editor',
];

interface Failing {
    name: string;
}
interface EditResult {
    ok: boolean;
    changeId?: string;
    regression?: {passed: number; failed: number; newlyFailing: Failing[]; newlyPassing: Failing[]};
    error?: {code: string};
}

// The tools register after the project opens.
async function openProject(page: Page): Promise<void> {
    await openStory(page, 'modeler--loan-repayment-project-tests');
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
    await expect.poll(async () => (await page.webmcp.tools()).length, SLOW).toBeGreaterThan(0);
}

// `edit-model` input that gives every prime applicant a higher premium: cases of `pricingTier` and of the service that
// prices a loan with it fail.
async function breakingOperation(page: Page): Promise<object> {
    const read = (await page.webmcp.callTool('read-source', {path: 'pricingTier'})) as {ok: boolean; text?: string};
    expect(read.ok).toBe(true);
    const code = read.text ?? '';
    expect(code).toContain('premium: 0.005');
    return {op: 'set', path: 'pricingTier', code: code.replace('premium: 0.005', 'premium: 0.006')};
}

test('tools() lists every registered tool with its annotations', async ({page}) => {
    await openProject(page);
    const tools = await page.webmcp.tools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...MODEL_TOOLS, ...READ_TOOLS].sort());
    // A browser agent that reads the page text learns how to list the tools and where to start.
    await expect(page.getByTestId('agent-tools-hint')).toContainText('get-project-overview');

    // Chromium reports only the hints that are true: a change tool has none.
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations ?? {}]));
    for (const name of [...MODEL_TOOLS, 'open-in-editor']) expect(annotations[name], name).toEqual({});
    for (const name of ['run-tests', 'get-language-guide', 'evaluate-model']) {
        expect(annotations[name], name).toEqual({readOnly: true});
    }
    for (const name of ['get-project-overview', 'list-model-entries', 'read-source', 'search-model', 'list-tests']) {
        expect(annotations[name], name).toEqual({readOnly: true, untrustedContent: true});
    }
});

test('edit-model breaks a test case, the Tests view shows it, and Undo in the toast reverts it', async ({page}) => {
    await openProject(page);
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0);

    const operation = await breakingOperation(page);
    const result = (await page.webmcp.callTool('edit-model', {operations: [operation]})) as EditResult;
    expect(result.ok).toBe(true);
    expect(result.regression?.newlyFailing.length).toBeGreaterThan(0);
    expect(result.regression?.failed).toBeGreaterThan(0);

    // The Tests view shows the failure and the toast shows the totals.
    await expect(page.locator('[data-mismatch="true"]').first()).toBeVisible(SLOW);
    const toast = page.getByTestId('shell-agent-toast');
    await expect(toast).toBeVisible();
    await expect(page.getByTestId('shell-agent-totals')).toHaveText(
        new RegExp(`Tests: ${result.regression?.passed} passed, ${result.regression?.failed} failed`),
    );

    await page.getByRole('button', {name: 'Undo', exact: true}).click();
    await expect(page.locator('[data-mismatch="true"]')).toHaveCount(0, SLOW);
});

test('edit-model on the entry open in the Code view with typed text shows the conflict bar', async ({page}) => {
    await openProject(page);
    await page.webmcp.callTool('open-in-editor', {path: 'pricingTier', view: 'code'});
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('ruleset pricingTier', SLOW);
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' ');
    await expect(page.getByTestId('code-conflict')).toHaveCount(0);

    const operation = await breakingOperation(page);
    const result = (await page.webmcp.callTool('edit-model', {operations: [operation]})) as EditResult;
    expect(result.ok).toBe(true);
    await expect(page.getByTestId('code-conflict')).toBeVisible(SLOW);
});

test('a read-only project lists only the read tools and open-in-editor', async ({page}) => {
    await openStory(page, 'services-webmcp-tools--read-only');
    const select = page.getByTestId('tool-select');
    await expect(select).toBeVisible(SLOW);
    await select.click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(READ_TOOLS.length);
    await expect(options).toHaveText(READ_TOOLS);
});

test('the tools are on by default, and the WebMCP switch in the top bar turns them off', async ({page}) => {
    await openStory(page, 'modeler--loan-repayment-project-tests');
    await expect(page.getByTestId('tests-grid')).toBeVisible(SLOW);
    const webMcp = page.getByRole('switch', {name: 'WebMCP'});
    await expect(webMcp).toBeChecked();
    await expect.poll(async () => (await page.webmcp.tools()).length, SLOW).toBeGreaterThan(0);

    await webMcp.uncheck();
    await expect.poll(async () => (await page.webmcp.tools()).length).toBe(0);
    await expect(page.getByTestId('agent-tools-hint')).toHaveCount(0);
    await webMcp.check();
    await expect.poll(async () => (await page.webmcp.tools()).length).toBeGreaterThan(0);
});

test('the help button explains WebMCP and says that it is experimental', async ({page}) => {
    await openStory(page, 'modeler--loan-repayment-project-tests');
    await page.getByRole('button', {name: 'About WebMCP'}).click();
    const panel = page.getByTestId('webmcp-help-panel');
    await expect(panel).toContainText('experimental');
    await expect(panel).not.toContainText('WebMCP is off in this browser');
});
