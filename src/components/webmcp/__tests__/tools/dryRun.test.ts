import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ChangeResult, DryRunResult} from '../../tools/change/editModel';
import type {TestsChangeResult} from '../../tools/change/editTests';
import {openToolsFixture} from '../../testing/toolsFixture';

type Fixture = Awaited<ReturnType<typeof openToolsFixture>>;

// The first regression run adds the discovered rows to the tests slice; a later run changes nothing.
async function settled(): Promise<Fixture> {
    const fixture = await openToolsFixture();
    await fixture.call('run-tests');
    return fixture;
}

function projectState({session, handle}: Fixture) {
    return {
        dsl: session.engine.exportDsl(),
        documentation: session.getSlice('documentation'),
        tests: session.getSlice('tests'),
        version: session.getSnapshot().localVersion,
        dirty: session.getSnapshot().dirtySlices,
        activity: handle.activity?.list(),
    };
}

const BREAK_YOUNG = {
    op: 'set',
    path: 'risk',
    code: 'func risk(age: number): { level: if age < 18 then "high" else "low" }',
};

describe('edit-model with dryRun', () => {
    it('returns the regression of the change and changes nothing', async () => {
        const fixture = await settled();
        const before = projectState(fixture);

        const result = await fixture.call<DryRunResult>('edit-model', {operations: [BREAK_YOUNG], dryRun: true});

        expect(result).toEqual({
            ok: true,
            dryRun: true,
            version: before.version,
            changed: ['risk'],
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
        expect(projectState(fixture)).toEqual(before);
    });

    it('keeps the baseline, so the real change reports the same regression', async () => {
        const fixture = await settled();
        const preview = await fixture.call<DryRunResult>('edit-model', {operations: [BREAK_YOUNG], dryRun: true});
        const applied = await fixture.call<ChangeResult>('edit-model', {operations: [BREAK_YOUNG]});
        if (!preview.ok || !applied.ok) throw new Error('edit-model failed');

        expect(applied.regression).toEqual(preview.regression);
        expect(applied.changeId).toBe('ac-1');
        expect(await fixture.call('get-project-overview')).toMatchObject({tests: {passed: 1, failed: 2}});
    });

    it('returns the link error and changes nothing', async () => {
        const fixture = await settled();
        const before = projectState(fixture);

        const result = await fixture.call('edit-model', {
            operations: [{op: 'set', path: 'bonus', code: 'missing + 1'}],
            dryRun: true,
        });

        expect(result).toMatchObject({ok: false, error: {code: 'LinkError'}});
        expect(projectState(fixture)).toEqual(before);
    });

    it('rejects a dryRun that is not a boolean', async () => {
        const {call} = await openToolsFixture();
        expect(await call('edit-model', {operations: [BREAK_YOUNG], dryRun: 'yes'})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
    });
});

describe('edit-tests with dryRun', () => {
    it('runs the new case on a copy and changes nothing', async () => {
        const fixture = await settled();
        const before = projectState(fixture);

        const result = await fixture.call<DryRunResult<TestsChangeResult>>('edit-tests', {
            subject: 'risk',
            operations: [{op: 'add', name: 'Child', inputs: {age: '10'}, assertions: {level: 'low'}}],
            dryRun: true,
        });

        if (!result.ok) throw new Error(result.error.message);
        expect(result).not.toHaveProperty('changeId');
        expect(result.dryRun).toBe(true);
        expect(result.addedCaseIds).toHaveLength(1);
        expect(result.regression).toMatchObject({passed: 2, failed: 2});
        expect(result.regression.newlyFailing).toEqual([
            expect.objectContaining({
                subject: 'risk',
                name: 'Child',
                assertions: [{path: 'level', expected: 'low', actual: 'high'}],
            }),
        ]);
        expect(projectState(fixture)).toEqual(before);
    });
});
