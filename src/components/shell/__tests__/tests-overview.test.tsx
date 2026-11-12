import 'fake-indexeddb/auto';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {ProjectProvider, type TestSuitesDocument} from '../../project-session';
import {openFixtureProject} from '../../project-session/testing/sessionFixture';
import {Shell} from '../Shell';
import {TESTS_OVERVIEW_PATH} from '../shell-path';
import type {ShellProps} from '../shell-types';

// A service, so the model root shows the overview page with its Tests card.
const MODEL = `{
    func risk(age: number): { level: if age < 25 then "high" else "low" }
    service quote(age: number): { level: risk(age).level }
    unused: 1
}`;

// `young` and `senior` pass; the '*' case `unused-is-two` fails: `unused` is 1.
const TESTS: TestSuitesDocument = {
    schemaVersion: 1,
    subjects: {
        risk: {
            cases: [
                {id: 'young', name: 'Young', order: 0, inputs: {age: '20'}, assertions: {level: 'high'}},
                {id: 'senior', name: 'Senior', order: 1, inputs: {age: '60'}, assertions: {level: 'low'}},
            ],
            rows: [
                {path: 'age', section: 'inputs', order: 0, type: 'number', present: true},
                {path: 'level', section: 'assertions', order: 0, type: 'string', present: true},
            ],
        },
        '*': {
            cases: [{id: 'unused-is-two', name: 'Unused is two', order: 0, inputs: {}, assertions: {unused: '2'}}],
            rows: [{path: 'unused', section: 'assertions', order: 0, type: 'number', present: true}],
        },
    },
};

async function renderShell(props: Partial<ShellProps> = {}) {
    const {session} = await openFixtureProject({name: 'Loans', model: {dsl: MODEL}, tests: TESTS});
    const onPathChange = vi.fn<(path: string) => void>();
    const onViewChange = vi.fn<(view: string) => void>();
    render(
        <ProjectProvider session={session}>
            <div style={{width: 1200, height: 800}}>
                <Shell
                    languageService={MutableDecisionService}
                    navigation={{onBrowseExamples: vi.fn(), onOpenProject: vi.fn()}}
                    onPathChange={onPathChange}
                    onViewChange={onViewChange}
                    {...props}
                />
            </div>
        </ProjectProvider>,
    );
    return {session, onPathChange, onViewChange};
}

describe('Tests Overview', () => {
    it('opens from the project menu, below Project Overview', async () => {
        const user = userEvent.setup();
        const {onPathChange} = await renderShell({defaultView: 'flow'});
        await user.click(screen.getByRole('button', {name: 'Project menu: Loans'}));
        const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
        expect(items.slice(0, 2)).toEqual(['Project Overview', 'Tests Overview']);
        await user.click(screen.getByRole('menuitem', {name: 'Tests Overview'}));
        expect(onPathChange).toHaveBeenLastCalledWith(TESTS_OVERVIEW_PATH);
        expect(await screen.findByTestId('shell-tests-overview')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup', {name: 'View'})).toBeNull();
    });

    it('lists every subject with its cases, not run before the first run', async () => {
        await renderShell({defaultPath: TESTS_OVERVIEW_PATH, defaultView: 'tests'});
        const page = screen.getByTestId('shell-tests-overview');
        expect(within(page).getByText('2 suites · 3 cases')).toBeInTheDocument();
        expect(within(page).getByTestId('tests-subject-*')).toHaveTextContent('0/1 passed');
        expect(within(page).getByTestId('tests-subject-risk')).toHaveTextContent('risk(...)');
        expect(within(page).getAllByLabelText('Not run')).toHaveLength(3);
    });

    it('runs all tests and aggregates the results', async () => {
        const user = userEvent.setup();
        await renderShell({defaultPath: TESTS_OVERVIEW_PATH, defaultView: 'tests'});
        await user.click(screen.getByRole('button', {name: 'Run all'}));
        await waitFor(() => expect(screen.getByTestId('tests-totals')).toHaveTextContent('2 passed1 failed'));
        expect(screen.getByTestId('tests-subject-risk')).toHaveTextContent('2/2 passed');
        const model = screen.getByTestId('tests-subject-*');
        expect(within(model).getByLabelText('Failed')).toBeInTheDocument();
        expect(model).toHaveTextContent('unused: expected 2, got 1');
    });

    it('opens the Tests view of a subject', async () => {
        const user = userEvent.setup();
        const {onPathChange, onViewChange} = await renderShell({
            defaultPath: TESTS_OVERVIEW_PATH,
            defaultView: 'tests',
        });
        await user.click(screen.getByRole('button', {name: 'Open tests of risk(...)'}));
        expect(onPathChange).toHaveBeenLastCalledWith('risk');
        expect(await screen.findByTestId('tests-manager')).toBeInTheDocument();
        expect(onViewChange).not.toHaveBeenCalledWith('boxed');
    });
});

describe('Project overview Tests card', () => {
    it('runs all tests in place and shows how many passed', async () => {
        const user = userEvent.setup();
        await renderShell({defaultView: 'flow'});
        const card = await screen.findByTestId('shell-tests-card');
        await user.click(within(card).getByRole('button', {name: 'Run all'}));
        await waitFor(() => expect(within(card).getByTestId('tests-totals')).toHaveTextContent('2 passed1 failed'));
        expect(screen.getByTestId('shell-workbook-picker')).toBeInTheDocument();
    });

    it('opens the Tests Overview with "All Tests"', async () => {
        const user = userEvent.setup();
        const {onPathChange} = await renderShell({defaultView: 'flow'});
        const card = await screen.findByTestId('shell-tests-card');
        await user.click(within(card).getByRole('button', {name: 'All Tests'}));
        expect(onPathChange).toHaveBeenLastCalledWith(TESTS_OVERVIEW_PATH);
        expect(await screen.findByTestId('shell-tests-overview')).toBeInTheDocument();
    });
});
