import 'fake-indexeddb/auto';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {ProjectProvider} from '../../project-session';
import {openFixtureProject} from '../../project-session/testing/sessionFixture';
import type {ChangeResult} from '../../webmcp';
import {Shell} from '../Shell';
import type {ShellAgentActivity} from '../shell-types';
import {renderAgentShell} from './agentFixture';

type Call = Awaited<ReturnType<typeof renderAgentShell>>['call'];

async function editModel(call: Call, operations: object[]): Promise<ChangeResult> {
    const result = await act(() => call<ChangeResult>('edit-model', {operations}));
    if (!result.ok) throw new Error(`edit-model failed: ${result.error.message}`);
    return result;
}

describe('Shell agent activity', () => {
    it('shows a toast with the summary and the regression totals after an agent change', async () => {
        const {call} = await renderAgentShell();
        expect(screen.queryByTestId('shell-agent-toast')).toBeNull();

        await editModel(call, [{op: 'set', path: 'unused', code: '2'}]);

        const toast = await screen.findByTestId('shell-agent-toast');
        expect(toast).toHaveTextContent('unused');
        // The '*' case `unused-is-two` passes now: every case passes.
        await waitFor(() =>
            expect(screen.getByTestId('shell-agent-totals')).toHaveTextContent('Tests: 3 passed, 0 failed'),
        );
    });

    it('"Undo" reverts the change and closes the toast; the undo itself shows no toast', async () => {
        const user = userEvent.setup();
        const {call, session, handle} = await renderAgentShell();
        const changed = await editModel(call, [{op: 'set', path: 'unused', code: '2'}]);
        const toast = await screen.findByTestId('shell-agent-toast');

        await user.click(within(toast.closest('[role="status"]')!).getByRole('button', {name: 'Undo'}));

        await waitFor(() => expect(session.engine.getCode('unused')).toBe('1'));
        expect(handle.activity!.list()[0]).toEqual(expect.objectContaining({reverts: changed.changeId}));
        expect(screen.queryByTestId('shell-agent-toast')).toBeNull();
    });

    it('hides "Undo" once the user changed a target of the change', async () => {
        const {call, session} = await renderAgentShell();
        await editModel(call, [{op: 'set', path: 'unused', code: '2'}]);
        await screen.findByTestId('shell-agent-toast');
        expect(screen.getByRole('button', {name: 'Undo'})).toBeInTheDocument();

        act(() => {
            session.transaction(() => void session.engine.set('unused', 5));
        });

        await waitFor(() => expect(screen.queryByRole('button', {name: 'Undo'})).toBeNull());
        expect(screen.getByRole('button', {name: 'Show'})).toBeInTheDocument();
    });

    it('"Show" opens the first target in its default view', async () => {
        const user = userEvent.setup();
        const {call, onPathChange, onViewChange} = await renderAgentShell({defaultView: 'code'});
        await editModel(call, [{op: 'set', path: 'applicant.income', code: '6000'}]);
        await screen.findByTestId('shell-agent-toast');

        await user.click(screen.getByRole('button', {name: 'Show'}));

        expect(onPathChange).toHaveBeenLastCalledWith('applicant.income');
        expect(onViewChange).toHaveBeenLastCalledWith('boxed');
    });

    it('"Show" of a test case opens the tests of its subject', async () => {
        const user = userEvent.setup();
        const {call, onPathChange, onViewChange} = await renderAgentShell();
        const result = (await act(() =>
            call('edit-tests', {
                subject: 'risk',
                operations: [{op: 'add', name: 'Middle', inputs: {age: '25'}, assertions: {level: 'low'}}],
            }),
        )) as {ok: boolean};
        expect(result.ok).toBe(true);
        await screen.findByTestId('shell-agent-toast');

        await user.click(screen.getByRole('button', {name: 'Show'}));

        expect(onPathChange).toHaveBeenLastCalledWith('risk');
        expect(onViewChange).toHaveBeenLastCalledWith('tests');
    });

    it('shows no toast for the changes that the log holds when the Shell mounts', async () => {
        const {call, handle, session, unmount} = await renderAgentShell();
        await editModel(call, [{op: 'set', path: 'unused', code: '2'}]);
        unmount();

        render(
            <ProjectProvider session={session}>
                <Shell languageService={MutableDecisionService} agentActivity={handle.activity} />
            </ProjectProvider>,
        );
        expect(screen.queryByTestId('shell-agent-toast')).toBeNull();
    });
});

describe('Shell agent working indicator', () => {
    it('shows "Companion is working" while a tool runs', async () => {
        const {session} = await openFixtureProject();
        const listeners = new Set<() => void>();
        let running: string | undefined;
        const activity: ShellAgentActivity = {
            list: () => [],
            canUndo: () => false,
            undo: async () => undefined,
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            running: () => running,
        };
        const set = (next: string | undefined) =>
            act(() => {
                running = next;
                for (const listener of listeners) listener();
            });
        render(
            <ProjectProvider session={session}>
                <Shell languageService={MutableDecisionService} agentActivity={activity} />
            </ProjectProvider>,
        );
        expect(screen.queryByTestId('shell-agent-working')).toBeNull();

        set('edit-model');
        expect(screen.getByTestId('shell-agent-working')).toHaveTextContent('Companion is working');

        set(undefined);
        expect(screen.queryByTestId('shell-agent-working')).toBeNull();
    });
});
