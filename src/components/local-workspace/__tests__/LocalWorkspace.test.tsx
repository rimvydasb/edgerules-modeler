import 'fake-indexeddb/auto';
import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createLocalProjectRepository, createProjectFactory} from '../../project-session';
import {nodeEngine, uniqueDbName} from '../../project-session/testing/sessionFixture';
import {LocalWorkspace, RecentProjects, addWorkspaceProject, type LocalWorkspaceHandle} from '..';

const MODEL = '{ a: 1 }';
const ORIGIN = {library: 'https://example.test/library.json', id: 'loan-repayment', version: '1.2.0'};

function setup() {
    const repository = createLocalProjectRepository({dbName: uniqueDbName()});
    const factory = createProjectFactory({engine: nodeEngine});
    return {repository, factory, store: {repository, factory}};
}

function panels(): string[] {
    return screen.queryAllByTestId('project-panel').map((panel) => within(panel).getAllByRole('link')[0].textContent!);
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole('button', {name: `Menu of ${name}`}));
}

describe('addWorkspaceProject', () => {
    it('names two copies of one example X and X (2) with distinct paths', async () => {
        const {store, repository} = setup();
        const input = {name: 'Loan repayment', model: {dsl: MODEL}, origin: ORIGIN};
        const first = await addWorkspaceProject(store, input);
        const second = await addWorkspaceProject(store, input);
        expect(first.bundle.manifest.name).toBe('Loan repayment');
        expect(second.bundle.manifest.name).toBe('Loan repayment (2)');
        expect(second.bundle.manifest.origin).toEqual(ORIGIN);
        expect(first.locator.projectPath).not.toBe(second.locator.projectPath);
        expect((await repository.list()).map((p) => p.name)).toEqual(['Loan repayment', 'Loan repayment (2)']);
    });
});

describe('LocalWorkspace', () => {
    it('shows the empty state and creates a blank project', async () => {
        const {repository, factory} = setup();
        const onOpen = vi.fn();
        const user = userEvent.setup();
        render(<LocalWorkspace repository={repository} factory={factory} onOpen={onOpen} onBrowseExamples={vi.fn()} />);

        expect(await screen.findByTestId('workspace-empty')).toBeTruthy();
        await user.click(within(screen.getByTestId('workspace-empty')).getByRole('button', {name: 'New project'}));
        await user.clear(await screen.findByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Pricing');
        await user.click(screen.getByRole('button', {name: 'Create'}));

        await waitFor(() => expect(panels()).toEqual(['Pricing']));
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'pricing'}));
        expect((await repository.list()).map((p) => p.name)).toEqual(['Pricing']);
    });

    it('duplicates, renames and deletes against IndexedDB', async () => {
        const {repository, factory, store} = setup();
        await addWorkspaceProject(store, {name: 'Loans', model: {dsl: MODEL}, origin: ORIGIN});
        const user = userEvent.setup();
        render(<LocalWorkspace repository={repository} factory={factory} onOpen={vi.fn()} />);
        expect(await screen.findByText('from loan-repayment@1.2.0')).toBeTruthy();

        await openMenu(user, 'Loans');
        await user.click(await screen.findByRole('menuitem', {name: 'Duplicate'}));
        await waitFor(() => expect(panels().sort()).toEqual(['Loans', 'Loans (2)']));
        const copy = (await repository.list()).find((p) => p.name === 'Loans (2)')!;
        expect(copy.origin).toEqual(ORIGIN);
        const original = (await repository.list()).find((p) => p.name === 'Loans')!;
        expect(copy.projectId).not.toBe(original.projectId);

        await openMenu(user, 'Loans (2)');
        await user.click(await screen.findByRole('menuitem', {name: 'Rename'}));
        await user.clear(await screen.findByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Renamed');
        await user.type(screen.getByLabelText('Description'), 'Edited');
        await user.click(screen.getByRole('button', {name: 'Save'}));
        await waitFor(() => expect(panels().sort()).toEqual(['Loans', 'Renamed']));
        const renamed = (await repository.load(copy.locator)).bundle.manifest;
        expect(renamed).toMatchObject({name: 'Renamed', description: 'Edited'});

        await openMenu(user, 'Renamed');
        await user.click(await screen.findByRole('menuitem', {name: 'Delete'}));
        expect(await screen.findByText(/This cannot be undone/)).toBeTruthy();
        await user.click(screen.getByRole('button', {name: 'Delete'}));
        await waitFor(() => expect(panels()).toEqual(['Loans']));
        expect((await repository.list()).map((p) => p.name)).toEqual(['Loans']);
    });

    it('filters by search and source and opens a project', async () => {
        const {repository, factory, store} = setup();
        await addWorkspaceProject(store, {name: 'Alpha', model: {dsl: MODEL}, origin: ORIGIN});
        await addWorkspaceProject(store, {name: 'Beta', description: 'pricing rules', model: {dsl: MODEL}});
        const onOpen = vi.fn();
        const user = userEvent.setup();
        render(<LocalWorkspace repository={repository} factory={factory} onOpen={onOpen} />);
        await waitFor(() => expect(panels()).toHaveLength(2));

        await user.type(screen.getByLabelText('Search projects'), 'pricing');
        expect(panels()).toEqual(['Beta']);
        await user.clear(screen.getByLabelText('Search projects'));

        await user.click(screen.getByRole('combobox', {name: 'Source'}));
        await user.click(await screen.findByRole('option', {name: 'From examples'}));
        expect(panels()).toEqual(['Alpha']);

        await user.click(screen.getAllByRole('link')[0]);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'alpha'}));
    });

    it('exposes addProject through its ref', async () => {
        const {repository, factory} = setup();
        const ref = createRef<LocalWorkspaceHandle>();
        render(<LocalWorkspace ref={ref} repository={repository} factory={factory} onOpen={vi.fn()} />);
        await screen.findByTestId('workspace-empty');
        await ref.current!.addProject({name: 'X', model: {dsl: MODEL}});
        await ref.current!.addProject({name: 'X', model: {dsl: MODEL}});
        await waitFor(() => expect(panels().sort()).toEqual(['X', 'X (2)']));
    });

    it('requests persistent storage and warns when the browser can evict', async () => {
        const {repository, factory} = setup();
        const persist = vi.fn().mockResolvedValue(false);
        vi.stubGlobal('navigator', {
            ...navigator,
            storage: {
                persisted: vi.fn().mockResolvedValue(false),
                persist,
                estimate: vi.fn().mockResolvedValue({usage: 3_355_443, quota: 1_181_116_006}),
            },
        });
        try {
            render(<LocalWorkspace repository={repository} factory={factory} onOpen={vi.fn()} />);
            expect(await screen.findByText(/may delete these projects/)).toBeTruthy();
            expect(persist).toHaveBeenCalled();
            expect((await screen.findByTestId('workspace-storage')).textContent).toContain('3.2 MB used of 1.1 GB');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('RecentProjects', () => {
    it('lists the newest saved projects first, up to the limit', async () => {
        const {repository, store} = setup();
        for (const name of ['One', 'Two', 'Three']) {
            await addWorkspaceProject(store, {name, model: {dsl: MODEL}});
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const onOpen = vi.fn();
        const user = userEvent.setup();
        render(<RecentProjects repository={repository} limit={2} onOpen={onOpen} onShowAll={vi.fn()} />);

        const buttons = await screen.findAllByRole('button', {name: /^Open /});
        expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Open Three', 'Open Two']);
        await user.click(buttons[0]);
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'three'}));
    });
});
