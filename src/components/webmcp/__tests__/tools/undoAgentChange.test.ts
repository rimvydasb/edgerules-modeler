import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ChangeResult} from '../../tools/change/editModel';
import type {UndoResult} from '../../tools/change/undoAgentChange';
import {openToolsFixture} from '../../testing/toolsFixture';

type Fixture = Awaited<ReturnType<typeof openToolsFixture>>;

async function change(fixture: Fixture, operations: object[]): Promise<string> {
    const result = await fixture.call<ChangeResult>('edit-model', {operations});
    if (!result.ok) throw new Error(`edit-model failed: ${result.error.message}`);
    return result.changeId;
}

async function undo(fixture: Fixture, changeId: string) {
    return fixture.call<UndoResult>('undo-agent-change', {changeId});
}

describe('undo-agent-change', () => {
    it('restores the code of a set of an existing entry, and removes a new one', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const changeId = await change(fixture, [
            {op: 'set', path: 'unused', code: '2'},
            {op: 'set', path: 'bonus', code: 'unused * 10'},
        ]);

        const result = await undo(fixture, changeId);

        expect(result).toEqual(
            expect.objectContaining({ok: true, changeId: 'ac-2', reverted: changeId, changed: ['bonus', 'unused']}),
        );
        expect(session.engine.getCode('unused')).toBe('1');
        expect(session.engine.getCode('bonus')).toEqual(expect.objectContaining({type: 'EntryNotFound'}));
        expect(result.ok && result.regression.newlyPassing).toEqual([]);
        expect(fixture.handle.activity?.list().map((c) => [c.changeId, c.tool, c.reverts])).toEqual([
            ['ac-2', 'undo-agent-change', changeId],
            ['ac-1', 'edit-model', undefined],
        ]);
    });

    it('restores the references, tests and documentation of a rename', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        session.documentation.setDescription('risk', 'Risk level.');
        const changeId = await change(fixture, [{op: 'rename', path: 'risk', newName: 'riskLevel'}]);
        expect(session.getSlice('documentation').byPath).toEqual({riskLevel: 'Risk level.'});

        const result = await undo(fixture, changeId);

        expect(result).toEqual(expect.objectContaining({ok: true, changed: ['risk', 'decision']}));
        expect(session.engine.getCode('decision')).toBe('risk(applicant.age)');
        expect(session.getSlice('documentation').byPath).toEqual({risk: 'Risk level.'});
        expect(Object.keys(session.getSlice('tests').subjects)).toEqual(['*', 'risk']);
    });

    it('restores the code and the nested documentation of a remove', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const applicantCode = session.engine.getCode('applicant');
        session.documentation.setDescription('applicant', 'The applicant.');
        session.documentation.setDescription('applicant.income', 'Monthly.');
        const changeId = await change(fixture, [
            {op: 'set', path: 'decision', code: 'risk(30)'},
            {op: 'remove', path: 'applicant'},
        ]);
        expect(session.getSlice('documentation').byPath).toEqual({});

        const result = await undo(fixture, changeId);

        expect(result.ok).toBe(true);
        expect(session.engine.getCode('applicant')).toBe(applicantCode);
        expect(session.engine.getCode('decision')).toBe('risk(applicant.age)');
        expect(session.getSlice('documentation').byPath).toEqual({
            applicant: 'The applicant.',
            'applicant.income': 'Monthly.',
        });
    });

    it('returns UndoBlocked with conflicts after a user edit of the same entry', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const changeId = await change(fixture, [
            {op: 'set', path: 'unused', code: '2'},
            {op: 'set', path: 'bonus', code: '5'},
        ]);
        session.engine.setCode('unused', '7'); // the user edits the same entry
        expect(fixture.handle.activity?.canUndo(changeId)).toBe(false);

        const result = await undo(fixture, changeId);

        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'UndoBlocked', conflicts: ['unused']}),
        });
        expect(session.engine.getCode('unused')).toBe('7');
        expect(session.engine.getCode('bonus')).toBe('5');
    });

    it('undoes the change after a user edit of another entry, and keeps that edit', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const changeId = await change(fixture, [{op: 'set', path: 'unused', code: '2'}]);
        session.engine.setCode('applicant.income', '9000');
        session.documentation.setDescription('unused', 'A user note.');
        expect(fixture.handle.activity?.canUndo(changeId)).toBe(true);

        const result = await undo(fixture, changeId);

        expect(result.ok).toBe(true);
        expect(session.engine.getCode('unused')).toBe('1');
        expect(session.engine.getCode('applicant.income')).toBe('9000');
        expect(session.getSlice('documentation').byPath).toEqual({unused: 'A user note.'});
    });

    it('an undo of an undo restores the change', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const changeId = await change(fixture, [
            {op: 'rename', path: 'risk', newName: 'riskLevel'},
            {op: 'set', path: 'unused', code: '2'},
            {op: 'remove', path: 'applicant.income'},
        ]);
        const changedDsl = session.engine.exportDsl();
        const undone = await undo(fixture, changeId);
        if (!undone.ok) throw new Error(undone.error.message);
        expect(fixture.handle.activity?.canUndo(changeId)).toBe(false);

        const redone = await undo(fixture, undone.changeId);

        expect(redone).toEqual(expect.objectContaining({ok: true, reverted: undone.changeId}));
        expect(session.engine.exportDsl()).toBe(changedDsl);
        expect(redone.ok && redone.regression.newlyFailing).toEqual([]);
    });

    it('returns NotFound for an unknown changeId', async () => {
        const fixture = await openToolsFixture();
        const result = await undo(fixture, 'ac-9');
        expect(result).toEqual({ok: false, error: expect.objectContaining({code: 'NotFound'})});
    });

    it('rolls back and returns LinkError when the inverse operations do not link', async () => {
        const fixture = await openToolsFixture();
        const {session} = fixture;
        const changeId = await change(fixture, [{op: 'set', path: 'bonus', code: '5'}]);
        session.engine.setCode('decision', 'bonus + 1'); // a user edit that depends on the new entry
        const before = session.engine.exportDsl();

        const result = await undo(fixture, changeId);

        expect(result).toEqual({ok: false, error: expect.objectContaining({code: 'LinkError'})});
        expect(session.engine.exportDsl()).toBe(before);
        expect(fixture.handle.activity?.list()).toHaveLength(1);
    });

    it('records set-documentation and undoes it', async () => {
        const fixture = await openToolsFixture();
        const {session, call} = fixture;
        session.readme.setMarkdown('# Loans');
        session.documentation.setDescription('unused', 'Old.');
        const result = await call<{changeId: string}>('set-documentation', {
            items: [
                {path: 'doc:README.md', text: '# Loans v2'},
                {path: 'unused', text: ''},
                {path: 'risk', text: 'The risk level.'},
            ],
        });
        if (!result.ok) throw new Error(result.error.message);
        expect(session.getSlice('documentation').byPath).toEqual({risk: 'The risk level.'});

        const undone = await undo(fixture, result.changeId);

        expect(undone.ok).toBe(true);
        expect(session.readme.exportDocument()).toBe('# Loans');
        expect(session.getSlice('documentation').byPath).toEqual({unused: 'Old.'});
    });
});
