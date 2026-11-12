import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ProjectSession} from '../../../project-session';
import {openFixtureProject} from '../../../project-session/testing/sessionFixture';
import {createRegressionMonitor} from '../../project/regression/regressionMonitor';
import {fitReport, type RegressionReport} from '../../project/regression/regressionReport';
import {LOAN_MODEL, LOAN_TESTS} from '../../testing/toolsFixture';

const BROKEN_MODEL = LOAN_MODEL.replace('age < 25', 'age < 18'); // `young` (20) is "low" now

function signal(): AbortSignal {
    return new AbortController().signal;
}

function commit(session: ProjectSession, source: string): void {
    expect(session.execute({type: 'commitDsl', source})).toEqual({ok: true});
}

async function setup() {
    const {session} = await openFixtureProject({tests: LOAN_TESTS});
    return {session, monitor: createRegressionMonitor(session)};
}

const UNUSED_REF = {subject: '*', caseId: 'unused-is-two', name: 'Unused is two'};
const YOUNG_REF = {subject: 'risk', caseId: 'young', name: 'Young'};

describe('RegressionMonitor — change and react', () => {
    it('reports every failing case as newly failing on the first run, which has no baseline', async () => {
        const {monitor} = await setup();
        const report = await monitor.runAll(signal());
        expect(report).toEqual({
            status: 'complete',
            passed: 2,
            failed: 1,
            newlyFailing: [{...UNUSED_REF, assertions: [{path: 'unused', expected: '2', actual: '1'}]}],
            stillFailing: [],
            newlyPassing: [],
            truncated: false,
        });
    });

    it('shows newlyFailing with expected and actual after a model change breaks a case', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());

        commit(session, BROKEN_MODEL);
        const report = await monitor.runAll(signal());
        expect(report.status).toBe('complete');
        expect(report.passed).toBe(1);
        expect(report.failed).toBe(2);
        expect(report.newlyFailing).toEqual([
            {...YOUNG_REF, assertions: [{path: 'level', expected: 'high', actual: 'low'}]},
        ]);
        expect(report.stillFailing).toEqual([UNUSED_REF]);
        expect(report.newlyPassing).toEqual([]);
    });

    it('shows newlyPassing after the fix, and stillFailing for the unrelated failing case', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        commit(session, BROKEN_MODEL);
        await monitor.runAll(signal());

        commit(session, LOAN_MODEL);
        const report = await monitor.runAll(signal());
        expect(report).toEqual({
            status: 'complete',
            passed: 2,
            failed: 1,
            newlyFailing: [],
            stillFailing: [UNUSED_REF],
            newlyPassing: [YOUNG_REF],
            truncated: false,
        });
    });

    it('writes the results through session.tests, so a mounted Tests view shows them', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        const resultSet = session.tests.forSubject('risk').getResultSet('young');
        expect(resultSet).toEqual(expect.objectContaining({status: 'ok'}));
        expect(resultSet?.results.level?.value).toBe('high');
    });

    it('a user change between two runs also shows, since the baseline is the previous run', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        session.tests.forSubject('*').setCell('unused-is-two', 'unused', 'assertion', '1');
        const report = await monitor.runAll(signal());
        expect(report.newlyPassing).toEqual([UNUSED_REF]);
        expect(report.failed).toBe(0);
    });
});

describe('RegressionMonitor — baseline', () => {
    it('runSubject runs one subject and replaces only its baseline entries', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        commit(session, BROKEN_MODEL);

        const report = await monitor.runSubject('risk', signal());
        expect(report.passed + report.failed).toBe(2);
        expect(report.newlyFailing.map((failure) => failure.caseId)).toEqual(['young']);
        expect(report.stillFailing).toEqual([]); // the '*' case did not run
        expect(monitor.lastTotals()).toEqual({passed: 1, failed: 2, ranAt: expect.any(Number)});

        // The 'risk' entries changed; the '*' entry is still the one of the first run.
        const again = await monitor.runAll(signal());
        expect(again.newlyFailing).toEqual([]);
        expect(again.stillFailing).toEqual([UNUSED_REF, YOUNG_REF]);
    });

    it('an aborted run returns status aborted and keeps the baseline', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        const totals = monitor.lastTotals();
        commit(session, BROKEN_MODEL);

        const controller = new AbortController();
        controller.abort();
        const aborted = await monitor.runAll(controller.signal);
        expect(aborted).toEqual(expect.objectContaining({status: 'aborted', passed: 0, failed: 0}));
        expect(monitor.lastTotals()).toEqual(totals);

        const report = await monitor.runAll(signal());
        expect(report.newlyFailing.map((failure) => failure.caseId)).toEqual(['young']);
    });

    it('lastTotals counts the whole baseline and has no ranAt before the first run', async () => {
        const {monitor} = await setup();
        expect(monitor.lastTotals()).toEqual({passed: 0, failed: 0});
        await monitor.runAll(signal());
        expect(monitor.lastTotals()).toEqual({passed: 2, failed: 1, ranAt: expect.any(Number)});
    });

    it('lists the subjects with cases, the whole model first', async () => {
        const {monitor} = await setup();
        expect(monitor.subjectsWithCases()).toEqual(['*', 'risk']);
    });

    it('a case whose subject no longer runs reports the run error', async () => {
        const {session, monitor} = await setup();
        await monitor.runAll(signal());
        commit(
            session,
            LOAN_MODEL.replace('func risk', 'func riskLevel').replace('risk(applicant', 'riskLevel(applicant'),
        );

        const report = await monitor.runSubject('risk', signal());
        expect(report.newlyFailing).toHaveLength(2);
        expect(report.newlyFailing[0].runError).toEqual(expect.any(String));
        expect(report.newlyFailing[0].assertions).toEqual([]);
    });
});

describe('regressionReport — output budget', () => {
    function ref(index: number) {
        return {subject: 'some.long.function.path', caseId: `case-${index}`, name: `A long test case name ${index}`};
    }

    it('keeps newlyFailing in full and trims stillFailing, then newlyPassing, to 1,500 characters', () => {
        const report: RegressionReport = {
            status: 'complete',
            passed: 30,
            failed: 31,
            newlyFailing: [{...ref(0), assertions: [{path: 'x', expected: '1', actual: '2'}]}],
            stillFailing: Array.from({length: 30}, (_, index) => ref(index + 1)),
            newlyPassing: Array.from({length: 30}, (_, index) => ref(index + 100)),
            truncated: false,
        };
        const fitted = fitReport(report);
        expect(JSON.stringify({ok: true, regression: fitted}).length).toBeLessThanOrEqual(1500);
        expect(fitted.truncated).toBe(true);
        expect(fitted.newlyFailing).toEqual(report.newlyFailing);
        expect(fitted.stillFailing).toEqual([]);
        expect(fitted.newlyPassing.length).toBeGreaterThan(0);
        expect(fitted.newlyPassing).toEqual(report.newlyPassing.slice(0, fitted.newlyPassing.length));
    });

    it('leaves a report that fits as it is', () => {
        const report: RegressionReport = {
            status: 'complete',
            passed: 1,
            failed: 0,
            newlyFailing: [],
            stillFailing: [],
            newlyPassing: [ref(1)],
            truncated: false,
        };
        expect(fitReport(report)).toEqual(report);
    });
});
