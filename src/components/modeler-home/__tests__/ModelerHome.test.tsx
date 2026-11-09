import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createLocalProjectRepository, createProjectFactory} from '../../project-session';
import {nodeEngine, uniqueDbName} from '../../project-session/testing/sessionFixture';
import {addWorkspaceProject} from '../../local-workspace';
import {createFixtureClient} from '../../example-library/testing/fixtureLibrary';
import type {LibraryClient} from '../../example-library';
import {ModelerHome, type ModelerHomeProps} from '..';

const ORIGIN = {library: 'https://example.test/library.json', id: 'loan-repayment', version: '1.2.0'};

async function setup(
    projects: {name: string; origin?: typeof ORIGIN}[] = [],
    client: LibraryClient = createFixtureClient(),
) {
    const repository = createLocalProjectRepository({dbName: uniqueDbName()});
    const factory = createProjectFactory({engine: nodeEngine});
    for (const project of projects)
        await addWorkspaceProject({repository, factory}, {...project, model: {dsl: '{ a: 1 }'}});
    const callbacks = {
        onSearch: vi.fn(),
        onSelectIndustry: vi.fn(),
        onShowDetails: vi.fn(),
        onCopy: vi.fn(),
        onOpenProject: vi.fn(),
        onNewProject: vi.fn(),
        onShowAllProjects: vi.fn(),
        onShowAllExamples: vi.fn(),
    } satisfies Partial<ModelerHomeProps>;
    render(<ModelerHome client={client} repository={repository} {...callbacks} />);
    return callbacks;
}

describe('ModelerHome', () => {
    it('shows Continue, industries, featured and new examples for a non-empty workspace', async () => {
        const callbacks = await setup([{name: 'My pricing'}]);
        expect(await screen.findByRole('button', {name: 'Open My pricing'})).toBeTruthy();
        expect(screen.queryByTestId('home-get-started')).toBeNull();
        expect(await screen.findByTestId('industry-grid')).toBeTruthy();
        expect(screen.getByRole('region', {name: 'Featured examples'})).toBeTruthy();
        const fresh = screen.getByRole('region', {name: 'New and updated'});
        // newest release first: loan-repayment 1.3.0 (2026-11-10)
        expect(within(fresh).getAllByTestId('example-panel')[0].getAttribute('aria-label')).toBe('Loan repayment');

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /See all examples/}));
        await user.click(screen.getByRole('button', {name: '+ New project'}));
        await user.click(screen.getByRole('button', {name: /All →/}));
        await user.click(screen.getByRole('button', {name: 'Open My pricing'}));
        expect(callbacks.onShowAllExamples).toHaveBeenCalled();
        expect(callbacks.onNewProject).toHaveBeenCalled();
        expect(callbacks.onShowAllProjects).toHaveBeenCalled();
        expect(callbacks.onOpenProject).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'my-pricing'}));
    });

    it('selects an industry tile', async () => {
        const callbacks = await setup([{name: 'A'}]);
        await userEvent.setup().click(await screen.findByRole('button', {name: /^Financial, 3 examples/}));
        expect(callbacks.onSelectIndustry).toHaveBeenCalledWith('financial');
    });

    it('replaces Continue with Get started for an empty workspace', async () => {
        const callbacks = await setup();
        const started = await screen.findByTestId('home-get-started');
        await waitFor(() => expect(within(started).getAllByTestId('example-panel')).toHaveLength(1));
        expect(within(started).getByTestId('example-panel').getAttribute('aria-label')).toBe('Loan repayment');
        expect(screen.queryByRole('region', {name: 'Recent projects'})).toBeNull();
        await userEvent.setup().click(within(started).getByRole('button', {name: 'Blank project'}));
        expect(callbacks.onNewProject).toHaveBeenCalled();
    });

    it('suggests examples and projects in two groups and opens them', async () => {
        const callbacks = await setup([{name: 'Loan pricing'}]);
        await screen.findByTestId('industry-grid');
        const user = userEvent.setup();
        await user.type(screen.getByRole('combobox'), 'loan');
        const examples = await screen.findByRole('group', {name: 'Examples'});
        const projects = screen.getByRole('group', {name: 'Your projects'});
        expect(
            within(examples)
                .getAllByRole('option')
                .map((o) => o.textContent),
        ).toEqual(
            [expect.stringContaining('Loan origination'), expect.stringContaining('Loan repayment')].map((m) => m),
        );
        expect(within(projects).getAllByRole('option')).toHaveLength(1);

        await user.keyboard('{ArrowDown}{Enter}');
        expect(callbacks.onShowDetails).toHaveBeenCalledWith({id: 'loan-origination', version: '2.0.0'});

        await user.clear(screen.getByRole('combobox'));
        await user.type(screen.getByRole('combobox'), 'loan');
        await user.click(within(await screen.findByRole('group', {name: 'Your projects'})).getByRole('option'));
        expect(callbacks.onOpenProject).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'loan-pricing'}));
    });

    it('calls onSearch with the query on Enter without a selection, and focuses the box on /', async () => {
        const callbacks = await setup([{name: 'A'}]);
        await screen.findByTestId('industry-grid');
        const user = userEvent.setup();
        await user.keyboard('/');
        expect(document.activeElement).toBe(screen.getByRole('combobox'));
        await user.type(screen.getByRole('combobox'), 'scorecard{Enter}');
        expect(callbacks.onSearch).toHaveBeenCalledWith('scorecard');
    });

    it('shows one retry panel on an index failure and keeps Continue usable', async () => {
        const good = createFixtureClient();
        let failing = true;
        const client: LibraryClient = {
            ...good,
            loadIndex: () => (failing ? Promise.reject(new Error('HTTP 503')) : good.loadIndex()),
        };
        await setup([{name: 'My pricing'}], client);
        expect(await screen.findByText('HTTP 503')).toBeTruthy();
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.queryByTestId('industry-grid')).toBeNull();
        expect(await screen.findByRole('button', {name: 'Open My pricing'})).toBeTruthy();

        failing = false;
        await userEvent.setup().click(screen.getByRole('button', {name: 'Retry'}));
        expect(await screen.findByTestId('industry-grid')).toBeTruthy();
    });
});
