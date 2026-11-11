import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {TestsChangeResult} from '../../tools/change/editTests';
import type {UndoResult} from '../../tools/change/undoAgentChange';
import {openToolsFixture} from '../../testing/toolsFixture';

describe('edit-tests', () => {
    it('adds a case with only the values it sends, and runs every test', async () => {
        const {session, call} = await openToolsFixture();

        const result = await call<TestsChangeResult>('edit-tests', {
            subject: 'risk',
            operations: [{op: 'add', name: 'Edge', inputs: {age: '25'}, assertions: {level: 'high'}}],
        });

        if (!result.ok) throw new Error(result.error.message);
        expect(result.addedCaseIds).toHaveLength(1);
        const [caseId] = result.addedCaseIds;
        expect(session.tests.forSubject('risk').getTestCase(caseId)).toEqual({
            id: caseId,
            name: 'Edge',
            order: 2,
            inputs: {age: '25'},
            assertions: {level: 'high'},
        });
        expect(result.changed).toEqual(['risk']);
        expect(result.regression.newlyFailing).toEqual([
            {
                subject: 'risk',
                caseId,
                name: 'Edge',
                assertions: [{path: 'level', expected: 'high', actual: 'low'}],
            },
        ]);
        expect(result.regression.passed + result.regression.failed).toBe(4);
    });

    it('syncs the rows of a subject without tests, so its paths exist without a Tests view', async () => {
        const {session, call} = await openToolsFixture({tests: {schemaVersion: 1, subjects: {}}});

        const result = await call<TestsChangeResult>('edit-tests', {
            subject: 'risk',
            operations: [{op: 'add', name: 'Young', inputs: {age: '20'}, assertions: {level: 'high'}}],
        });

        expect(result).toEqual(expect.objectContaining({ok: true}));
        expect(result.ok && result.regression).toEqual(expect.objectContaining({passed: 1, failed: 0}));
        expect(
            session.tests
                .forSubject('risk')
                .listRows()
                .map((row) => [row.path, row.section]),
        ).toEqual([
            ['age', 'inputs'],
            ['level', 'validations'],
        ]);
    });

    it('merges update values; an empty text removes a value', async () => {
        const {session, call} = await openToolsFixture();
        const result = await call<TestsChangeResult>('edit-tests', {
            subject: 'risk',
            operations: [{op: 'update', caseId: 'young', name: 'Teen', inputs: {age: '15'}, assertions: {level: ''}}],
        });
        expect(result.ok).toBe(true);
        expect(session.tests.forSubject('risk').getTestCase('young')).toEqual({
            id: 'young',
            name: 'Teen',
            order: 0,
            inputs: {age: '15'},
            assertions: {},
        });
    });

    it('the undo of a case removal restores the case id and order', async () => {
        const {session, call} = await openToolsFixture();
        const tests = session.tests.forSubject('risk');
        const young = tests.getTestCase('young');
        const removed = await call<TestsChangeResult>('edit-tests', {
            subject: 'risk',
            operations: [{op: 'remove', caseId: 'young'}],
        });
        if (!removed.ok) throw new Error(removed.error.message);
        expect(tests.listTestCases().map((testCase) => testCase.id)).toEqual(['senior']);

        const undone = await call<UndoResult>('undo-agent-change', {changeId: removed.changeId});

        expect(undone.ok).toBe(true);
        expect(tests.listTestCases().map((testCase) => testCase.id)).toEqual(['young', 'senior']);
        expect(tests.getTestCase('young')).toEqual(young);
    });

    it('undoes an add and an update in one change', async () => {
        const {session, call} = await openToolsFixture();
        const before = session.getSlice('tests');
        const result = await call<TestsChangeResult>('edit-tests', {
            subject: 'risk',
            operations: [
                {op: 'add', name: 'New', inputs: {age: '40'}},
                {op: 'update', caseId: 'senior', assertions: {level: 'high'}},
            ],
        });
        if (!result.ok) throw new Error(result.error.message);

        const undone = await call<UndoResult>('undo-agent-change', {changeId: result.changeId});

        expect(undone.ok).toBe(true);
        expect(session.getSlice('tests').subjects.risk.cases).toEqual(before.subjects.risk.cases);
    });

    it('returns InvalidInput with a list-tests hint for a path that is not a row, and changes nothing', async () => {
        const {session, call} = await openToolsFixture();
        await call('run-tests');
        const before = session.getSlice('tests');
        const result = await call('edit-tests', {
            subject: 'risk',
            operations: [
                {op: 'add', name: 'Ok', inputs: {age: '30'}},
                {op: 'update', caseId: 'young', inputs: {level: 'high'}},
            ],
        });
        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'InvalidInput',
                operation: 1,
                hint: expect.stringContaining('list-tests'),
            }),
        });
        expect(session.getSlice('tests')).toEqual(before);
    });

    it.each([
        ['NotFound', {subject: 'nothing', operations: [{op: 'remove', caseId: 'young'}]}],
        ['NotFound', {subject: 'risk', operations: [{op: 'remove', caseId: 'missing'}]}],
        ['InvalidInput', {subject: 'risk', operations: [{op: 'add'}]}],
        ['InvalidInput', {subject: 'risk', operations: [{op: 'add', name: 'A', inputs: {age: 20}}]}],
        ['InvalidInput', {subject: 'risk', operations: [{op: 'add', name: 'A', inputs: {age: '9'.repeat(2001)}}]}],
        ['InvalidInput', {subject: 'risk', operations: [{op: 'update', name: 'A'}]}],
        ['InvalidInput', {subject: 'doc:README.md', operations: [{op: 'remove', caseId: 'young'}]}],
        ['InvalidInput', {subject: 'risk', operations: []}],
    ])('returns %s for input %#', async (code, input) => {
        const {call} = await openToolsFixture();
        const result = await call('edit-tests', input);
        expect(result).toEqual({ok: false, error: expect.objectContaining({code})});
    });
});

describe('set-documentation', () => {
    it.each([
        ['NotFound', 'an unknown path', {items: [{path: 'nothing', text: 'x'}]}],
        ['InvalidInput', 'an empty README', {items: [{path: 'doc:README.md', text: ''}]}],
        ['InvalidInput', "'*'", {items: [{path: '*', text: 'x'}]}],
        ['InvalidInput', 'a text over 20,000 characters', {items: [{path: 'risk', text: 'x'.repeat(20_001)}]}],
        ['InvalidInput', 'no items', {items: []}],
    ])('returns %s for %s and changes nothing', async (code, _label, input) => {
        const {session, call} = await openToolsFixture();
        await call('run-tests'); // the first regression run adds the discovered rows
        const version = session.getSnapshot().localVersion;
        const result = await call('set-documentation', input);
        expect(result).toEqual({ok: false, error: expect.objectContaining({code})});
        expect(session.getSnapshot().localVersion).toBe(version);
    });

    it('sets documentation in one change and runs no tests', async () => {
        const {session, call} = await openToolsFixture();
        const result = await call('set-documentation', {items: [{path: 'applicant.age', text: 'In years.'}]});
        expect(result).toEqual({ok: true, version: session.getSnapshot().localVersion, changeId: 'ac-1'});
        expect(session.documentation.getDescription('applicant.age')).toBe('In years.');
    });
});
