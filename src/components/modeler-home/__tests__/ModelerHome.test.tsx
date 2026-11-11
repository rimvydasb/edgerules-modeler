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
        onShowDetails: vi.fn(),
        onCopy: vi.fn(),
        onOpenProject: vi.fn(),
        onShowAllProjects: vi.fn(),
        onShowAllExamples: vi.fn(),
    } satisfies Partial<ModelerHomeProps>;
    render(<ModelerHome client={client} repository={repository} {...callbacks} />);
    return callbacks;
}

describe('ModelerHome', () => {
    it('shows the search, the featured examples and the recent projects of the workspace', async () => {
        const callbacks = await setup([{name: 'My pricing'}]);
        expect(await screen.findByRole('link', {name: 'My pricing'})).toBeTruthy();
        const examples = screen.getByRole('region', {name: 'Examples'});
        expect(within(examples).getAllByTestId('example-panel').length).toBeGreaterThan(0);
        expect(screen.getByRole('region', {name: 'Recent projects'}).getAttribute('aria-label')).toBe(
            'Recent projects',
        );
        expect(screen.getByRole('heading', {name: 'Workspace'})).toBeTruthy();
        for (const removed of ['Continue', 'Featured examples', 'New and updated'])
            expect(screen.queryByText(removed)).toBeNull();
        expect(screen.queryByTestId('industry-grid')).toBeNull();

        const user = userEvent.setup();
        await user.click(within(examples).getByRole('button', {name: /All examples/}));
        await user.click(screen.getByRole('link', {name: 'My pricing'}));
        expect(callbacks.onShowAllExamples).toHaveBeenCalled();
        expect(callbacks.onOpenProject).toHaveBeenCalledWith(expect.objectContaining({projectPath: 'my-pricing'}));
        // Four projects or fewer: nothing more to browse.
        expect(screen.queryByRole('button', {name: /All projects/})).toBeNull();
    });

    it('lists the 4 newest projects and offers to browse the others only when they exist', async () => {
        const callbacks = await setup([{name: 'One'}, {name: 'Two'}, {name: 'Three'}, {name: 'Four'}, {name: 'Five'}]);
        const browse = await screen.findByRole('button', {name: /All projects/});
        expect(within(screen.getByRole('region', {name: 'Recent projects'})).getAllByRole('link')).toHaveLength(4);
        await userEvent.setup().click(browse);
        expect(callbacks.onShowAllProjects).toHaveBeenCalled();
    });

    it('hides the Workspace section for an empty workspace', async () => {
        await setup();
        expect(await screen.findByRole('region', {name: 'Examples'})).toBeTruthy();
        await waitFor(() => expect(screen.queryByTestId('home-skeleton')).toBeNull());
        expect(screen.queryByRole('region', {name: 'Recent projects'})).toBeNull();
        expect(screen.queryByText('Get started')).toBeNull();
    });

    it('suggests examples and projects in two groups and opens them', async () => {
        const callbacks = await setup([{name: 'Loan pricing'}]);
        await screen.findByRole('region', {name: 'Examples'});
        const user = userEvent.setup();
        await user.type(screen.getByRole('combobox'), 'loan');
        const examples = await screen.findByRole('group', {name: 'Examples'});
        const projects = screen.getByRole('group', {name: 'Your projects'});
        expect(
            within(examples)
                .getAllByRole('option')
                .map((o) => o.textContent),
        ).toEqual([expect.stringContaining('Loan origination'), expect.stringContaining('Loan repayment')]);
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
        await screen.findByRole('region', {name: 'Examples'});
        const user = userEvent.setup();
        await user.keyboard('/');
        expect(document.activeElement).toBe(screen.getByRole('combobox'));
        await user.type(screen.getByRole('combobox'), 'scorecard{Enter}');
        expect(callbacks.onSearch).toHaveBeenCalledWith('scorecard');
    });

    it('shows one retry panel on an index failure and keeps the recent projects usable', async () => {
        const good = createFixtureClient();
        let failing = true;
        const client: LibraryClient = {
            ...good,
            loadIndex: () => (failing ? Promise.reject(new Error('HTTP 503')) : good.loadIndex()),
        };
        await setup([{name: 'My pricing'}], client);
        expect(await screen.findByText('HTTP 503')).toBeTruthy();
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.queryByRole('region', {name: 'Examples'})).toBeNull();
        expect(await screen.findByRole('link', {name: 'My pricing'})).toBeTruthy();

        failing = false;
        await userEvent.setup().click(screen.getByRole('button', {name: 'Retry'}));
        expect(await screen.findByRole('region', {name: 'Examples'})).toBeTruthy();
    });
});
