import 'fake-indexeddb/auto';
import {EditorView} from '@codemirror/view';
import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import type {ChangeResult} from '../../webmcp';
import {COMMIT_DELAY_MS} from '../views/CodeView';
import {renderAgentShell} from './agentFixture';

function codeView(): EditorView {
    const dom = screen.getByTestId('shell').querySelector('.cm-editor');
    const view = dom && EditorView.findFromDOM(dom as HTMLElement);
    if (!view) throw new Error('The Code view is not shown');
    return view;
}

const shownCode = () => codeView().state.doc.toString();

function typeCode(code: string): void {
    const view = codeView();
    act(() => view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: code}}));
}

// Waits until the commit delay of the Code view has ended.
async function commitDelay(): Promise<void> {
    await act(() => new Promise((resolve) => setTimeout(resolve, COMMIT_DELAY_MS + 100)));
}

type Call = Awaited<ReturnType<typeof renderAgentShell>>['call'];

async function agentSet(call: Call, path: string, code: string): Promise<string> {
    const result = await act(() => call<ChangeResult>('edit-model', {operations: [{op: 'set', path, code}]}));
    if (!result.ok) throw new Error(`edit-model failed: ${result.error.message}`);
    return result.changeId;
}

describe('Code view of an entry', () => {
    it('an agent change of the edited entry stops the timer commit and shows the bar', async () => {
        const {call, session} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        typeCode('3');

        await agentSet(call, 'unused', '2');
        await commitDelay();

        expect(screen.getByTestId('code-conflict')).toHaveTextContent('The model changed while you edited.');
        expect(session.engine.getCode('unused')).toBe('2');
        expect(shownCode()).toBe('3');
        // The bar stays: no later timer commits the text.
        await commitDelay();
        expect(session.engine.getCode('unused')).toBe('2');
    });

    it('an agent change of another entry does not stop the commit', async () => {
        const {call, session} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        typeCode('3');

        await agentSet(call, 'applicant.income', '6000');
        await commitDelay();

        expect(screen.queryByTestId('code-conflict')).toBeNull();
        expect(session.engine.getCode('unused')).toBe('3');
        expect(session.engine.getCode('applicant.income')).toBe('6000');
    });

    it('"Load latest" drops the text and shows the committed code', async () => {
        const user = userEvent.setup();
        const {call, session} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        typeCode('3');
        await agentSet(call, 'unused', '2');
        await commitDelay();

        await user.click(screen.getByRole('button', {name: 'Load latest'}));

        expect(screen.queryByTestId('code-conflict')).toBeNull();
        expect(shownCode()).toBe('2');
        expect(session.engine.getCode('unused')).toBe('2');
    });

    it('"Keep my text" commits the text over the change, so the agent change cannot be undone', async () => {
        const user = userEvent.setup();
        const {call, session} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        typeCode('3');
        const changeId = await agentSet(call, 'unused', '2');
        await commitDelay();

        await user.click(screen.getByRole('button', {name: 'Keep my text'}));

        expect(screen.queryByTestId('code-conflict')).toBeNull();
        expect(session.engine.getCode('unused')).toBe('3');
        const undo = await act(() => call('undo-agent-change', {changeId}));
        expect(undo).toEqual({ok: false, error: expect.objectContaining({code: 'UndoBlocked', conflicts: ['unused']})});
    });

    it('keeps the conflict text when the user leaves the view, and shows the bar again on return', async () => {
        const user = userEvent.setup();
        const {call, session} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        typeCode('3');
        await agentSet(call, 'unused', '2');

        // Leaving the view commits what is pending, unless the model changed under it.
        await user.click(screen.getByRole('radio', {name: 'Boxed'}));
        expect(session.engine.getCode('unused')).toBe('2');

        await user.click(screen.getByRole('radio', {name: 'Code'}));
        expect(screen.getByTestId('code-conflict')).toBeInTheDocument();
        expect(shownCode()).toBe('3');
    });

    it('reloads the text of a synced view on each model change', async () => {
        const {call} = await renderAgentShell({defaultPath: 'unused', defaultView: 'code'});
        expect(shownCode()).toBe('1');

        await agentSet(call, 'unused', '2');

        expect(shownCode()).toBe('2');
        expect(screen.queryByTestId('code-conflict')).toBeNull();
    });

    it("keeps the user's own text after its commit", async () => {
        const {session} = await renderAgentShell({defaultPath: 'risk', defaultView: 'code'});
        const typed = 'func risk(age: number): {\n    level: if age < 30 then "high" else "low"\n}';
        typeCode(typed);
        await commitDelay();

        expect(session.engine.getCode('risk')).toContain('age < 30');
        expect(shownCode()).toBe(typed);
    });
});

describe('Code view of the whole model', () => {
    it('any model change during an edit is a conflict; the session keeps the draft', async () => {
        const {call, session} = await renderAgentShell({defaultView: 'code'});
        const typed = shownCode().replace('unused: 1', 'unused: 3');
        typeCode(typed);

        await agentSet(call, 'applicant.income', '6000');
        await commitDelay();

        expect(screen.getByTestId('code-conflict')).toBeInTheDocument();
        expect(session.engine.getCode('unused')).toBe('1');
        expect(session.engine.getCode('applicant.income')).toBe('6000');
        expect(session.getSnapshot().hasDslDraft).toBe(true);
        const overview = await act(() => call<{draftPending: boolean}>('get-project-overview', {}));
        expect(overview.ok && overview.draftPending).toBe(true);
    });

    it('"Load latest" discards the session draft', async () => {
        const user = userEvent.setup();
        const {call, session} = await renderAgentShell({defaultView: 'code'});
        typeCode(shownCode().replace('unused: 1', 'unused: 3'));
        await agentSet(call, 'applicant.income', '6000');
        await commitDelay();

        await user.click(screen.getByRole('button', {name: 'Load latest'}));

        expect(session.getSnapshot().hasDslDraft).toBe(false);
        expect(shownCode()).toBe(session.getSlice('model').dsl);
        expect(shownCode()).toContain('6000');
    });

    it('a model change without an edit reloads the whole model', async () => {
        const {call, session} = await renderAgentShell({defaultView: 'code'});

        await agentSet(call, 'unused', '2');

        expect(shownCode()).toBe(session.getSlice('model').dsl);
        expect(shownCode()).toContain('unused: 2');
    });
});
