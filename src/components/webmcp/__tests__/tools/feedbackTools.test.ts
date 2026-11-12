import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {RunTestsResult} from '../../tools/feedback/runTests';
import {LOAN_MODEL, openToolsFixture} from '../../testing/toolsFixture';

describe('run-tests', () => {
    it('runs one subject and reports its newly failing case with expected and actual', async () => {
        const {session, call} = await openToolsFixture();
        await call('run-tests'); // waits for the first baseline, then runs again
        session.execute({type: 'commitDsl', source: LOAN_MODEL.replace('age < 25', 'age < 18')});

        const result = await call<RunTestsResult>('run-tests', {subject: 'risk'});
        expect(result).toEqual({
            ok: true,
            regression: {
                status: 'complete',
                passed: 1,
                failed: 1,
                newlyFailing: [
                    {
                        subject: 'risk',
                        caseId: 'young',
                        name: 'Young',
                        assertions: [{path: 'level', expected: 'high', actual: 'low'}],
                    },
                ],
                stillFailing: [],
                newlyPassing: [],
                truncated: false,
            },
        });
    });

    it('returns NotFound with a hint for a subject without test cases', async () => {
        const {call} = await openToolsFixture();
        const result = await call('run-tests', {subject: 'decision'});
        expect(result).toEqual({
            ok: false,
            error: {
                code: 'NotFound',
                message: "The test subject 'decision' has no test cases.",
                path: 'decision',
                hint: 'Call list-tests to see the test subjects and their cases.',
            },
        });
    });

    it.each([[{subject: 'doc:README.md'}], [{subject: 7}], [{subjects: '*'}]])(
        'returns InvalidInput for %j',
        async (input) => {
            const {call} = await openToolsFixture();
            const result = await call('run-tests', input);
            expect(result).toEqual({ok: false, error: expect.objectContaining({code: 'InvalidInput'})});
        },
    );

    it('an aborted call returns Aborted and keeps the baseline', async () => {
        const {call} = await openToolsFixture();
        const controller = new AbortController();
        controller.abort();
        const aborted = await call('run-tests', {}, {signal: controller.signal});
        expect(aborted).toEqual({ok: false, error: expect.objectContaining({code: 'Aborted'})});

        const result = await call<RunTestsResult>('run-tests');
        expect(result.ok && result.regression.stillFailing).toHaveLength(1);
    });
});
