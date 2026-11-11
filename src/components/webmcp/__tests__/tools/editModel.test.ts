import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ChangeResult} from '../../tools/change/editModel';
import {openToolsFixture} from '../../testing/toolsFixture';

type Fixture = Awaited<ReturnType<typeof openToolsFixture>>;

// The first regression run adds the discovered rows to the tests slice; a later run changes nothing.
async function settled(): Promise<Fixture> {
    const fixture = await openToolsFixture();
    await fixture.call('run-tests');
    return fixture;
}

function sliceState({session}: Fixture) {
    return {
        dsl: session.engine.exportDsl(),
        documentation: session.getSlice('documentation'),
        tests: session.getSlice('tests'),
        flow: session.getSlice('flow'),
        readme: session.getSlice('readme'),
        version: session.getSnapshot().localVersion,
    };
}

describe('edit-model', () => {
    it('applies a batch, returns the changed paths and a regression report of every subject', async () => {
        const fixture = await openToolsFixture();
        const {session, call} = fixture;

        const result = await call<ChangeResult>('edit-model', {
            operations: [
                {
                    op: 'set',
                    path: 'risk',
                    code: 'func risk(age: number): { level: if age < 18 then "high" else "low" }',
                },
                {op: 'set', path: 'bonus', code: 'unused + 1'},
            ],
        });

        expect(result).toEqual({
            ok: true,
            version: session.getSnapshot().localVersion,
            changeId: 'ac-1',
            changed: ['risk', 'bonus'],
            regression: {
                status: 'complete',
                passed: 1,
                failed: 2,
                newlyFailing: [
                    {
                        subject: 'risk',
                        caseId: 'young',
                        name: 'Young',
                        assertions: [{path: 'level', expected: 'high', actual: 'low'}],
                    },
                ],
                stillFailing: [{subject: '*', caseId: 'unused-is-two', name: 'Unused is two'}],
                newlyPassing: [],
                truncated: false,
            },
        });
        expect(session.engine.getCode('bonus')).toBe('unused + 1');
    });

    it('leaves the DSL and every slice unchanged when the batch does not link', async () => {
        const fixture = await settled();
        const {session, call} = fixture;
        session.documentation.setDescription('unused', 'Kept.');
        const before = sliceState(fixture);

        const result = await call('edit-model', {
            operations: [
                {op: 'remove', path: 'unused'},
                {op: 'set', path: 'bonus', code: 'missing + 1'},
            ],
        });

        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'LinkError',
                diagnostics: [expect.objectContaining({source: 'linker', code: 'E102'})],
            }),
        });
        expect(sliceState(fixture)).toEqual(before);
        expect(fixture.handle.activity?.list()).toEqual([]);
    });

    it('names the failed operation of a parse error and changes nothing', async () => {
        const fixture = await settled();
        const before = sliceState(fixture);
        const result = await fixture.call('edit-model', {
            operations: [
                {op: 'set', path: 'bonus', code: '2'},
                {op: 'set', path: 'broken', code: 'if if'},
            ],
        });
        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'ParseError',
                operation: 1,
                path: 'broken',
                diagnostics: [expect.objectContaining({source: 'parser', code: 'MissingExpression'})],
            }),
        });
        expect(sliceState(fixture)).toEqual(before);
    });

    it('returns VersionConflict for a stale baseVersion and succeeds without one', async () => {
        const {session, call} = await openToolsFixture();
        const first = await call<ChangeResult>('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}]});
        expect(first.ok).toBe(true);
        const staleVersion = first.ok ? first.version : -1;
        session.documentation.setDescription('unused', 'A user edit.');

        const stale = await call('edit-model', {
            operations: [{op: 'set', path: 'unused', code: '3'}],
            baseVersion: staleVersion,
        });
        expect(stale).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'VersionConflict', currentVersion: staleVersion + 1}),
        });
        expect(session.engine.getCode('unused')).toBe('2');

        const current = await call<ChangeResult>('edit-model', {
            operations: [{op: 'set', path: 'unused', code: '3'}],
            baseVersion: staleVersion + 1,
        });
        expect(current.ok).toBe(true);
        const unversioned = await call<ChangeResult>('edit-model', {
            operations: [{op: 'set', path: 'unused', code: '4'}],
        });
        expect(unversioned.ok).toBe(true);
        expect(session.engine.getCode('unused')).toBe('4');
    });

    it('succeeds while the user has a DSL draft, and keeps the draft', async () => {
        const {session, call} = await openToolsFixture();
        session.setDslDraft('{ unfinished: ');

        const result = await call<ChangeResult>('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}]});

        expect(result.ok).toBe(true);
        expect(session.engine.getCode('unused')).toBe('2');
        expect(session.getSnapshot().hasDslDraft).toBe(true);
        expect(session.getDslDraft()).toBe('{ unfinished: ');
    });

    it('renames a function, moves its tests and reports the paths whose references it rewrote', async () => {
        const {session, call} = await openToolsFixture();
        const result = await call<ChangeResult>('edit-model', {
            operations: [{op: 'rename', path: 'risk', newName: 'riskLevel'}],
        });
        expect(result).toEqual(expect.objectContaining({ok: true, changed: ['riskLevel', 'decision']}));
        expect(session.engine.getCode('decision')).toBe('riskLevel(applicant.age)');
        expect(Object.keys(session.getSlice('tests').subjects)).toEqual(['*', 'riskLevel']);
    });

    it('removes an entry with the documentation of the path and of each nested path', async () => {
        const {session, call} = await openToolsFixture();
        session.documentation.setDescription('applicant', 'The applicant.');
        session.documentation.setDescription('applicant.income', 'Monthly.');
        session.documentation.setDescription('unused', 'Stays.');

        const result = await call<ChangeResult>('edit-model', {
            operations: [
                {op: 'set', path: 'decision', code: 'risk(30)'},
                {op: 'remove', path: 'applicant'},
            ],
        });

        expect(result.ok).toBe(true);
        expect(session.getSlice('documentation').byPath).toEqual({unused: 'Stays.'});
    });

    it.each([
        ['DuplicateName', {op: 'rename', path: 'unused', newName: 'decision'}],
        ['NotFound', {op: 'remove', path: 'nothing'}],
        ['NotFound', {op: 'rename', path: 'nothing', newName: 'other'}],
    ])('returns %s for %j with the operation index', async (code, operation) => {
        const {call} = await openToolsFixture();
        const result = await call('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}, operation]});
        expect(result).toEqual({ok: false, error: expect.objectContaining({code, operation: 1})});
    });

    it.each([
        [{operations: []}],
        [{operations: [{op: 'set', path: '*', code: '{}'}]}],
        [{operations: [{op: 'set', path: 'a b', code: '1'}]}],
        [{operations: [{op: 'set', path: 'a', code: ''}]}],
        [{operations: [{op: 'set', path: 'a', code: 'x'.repeat(50_001)}]}],
        [{operations: [{op: 'rename', path: 'unused', newName: 'a.b'}]}],
        [{operations: [{op: 'move', path: 'unused'}]}],
        [{operations: [{op: 'remove', path: 'unused', code: '1'}]}],
        [{operations: [{op: 'remove', path: 'unused'}], baseVersion: -1}],
        [{operations: [{op: 'remove', path: 'unused'}], force: true}],
    ])('returns InvalidInput for input %#', async (input) => {
        const {call, session} = await openToolsFixture();
        const before = session.engine.exportDsl();
        const result = await call('edit-model', input);
        expect(result).toEqual({ok: false, error: expect.objectContaining({code: 'InvalidInput'})});
        expect(session.engine.exportDsl()).toBe(before);
    });

    it('is not registered for a read-only project', async () => {
        const {modelContext} = await openToolsFixture(undefined, {readOnly: true});
        expect(modelContext.names()).toEqual(['run-tests']);
    });
});
