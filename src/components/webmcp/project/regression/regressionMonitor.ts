import {listCallables} from '#lib/callables';
import type {ProjectSession} from '../../../project-session';
import {caseOutcome, createTestRunner, type TestSubject as RunnerSubject} from '../../../tests-manager/internal';
import type {TestSubject} from '../../core/paths';
import {classifyRun, type Baseline, type CaseRun, type RegressionReport} from './regressionReport';

export interface RegressionTotals {
    passed: number;
    failed: number;
    ranAt?: number; // epoch ms of the last complete run; absent before the first one
}

/** The only module that runs test cases. Each run is compared with the previous run, the baseline. */
export interface RegressionMonitor {
    runAll(signal: AbortSignal): Promise<RegressionReport>; // every subject with cases; replaces the baseline
    runSubject(subject: TestSubject, signal: AbortSignal): Promise<RegressionReport>; // replaces its baseline entries
    lastTotals(): RegressionTotals; // over the whole baseline, for `get-project-overview`
    subjectsWithCases(): TestSubject[]; // '*' first, then in document order
}

export function createRegressionMonitor(session: ProjectSession): RegressionMonitor {
    let baseline: Baseline = new Map();
    let ranAt: number | undefined;

    function subjectsWithCases(): TestSubject[] {
        const subjects = Object.entries(session.tests.exportDocument().subjects)
            .filter(([, suite]) => suite.cases.length > 0)
            .map(([subject]) => subject);
        return [...subjects.filter((s) => s === '*'), ...subjects.filter((s) => s !== '*')];
    }

    // The kind decides only the message of a missing solver; a subject that is no longer a callable fails to run.
    function runnerSubject(subject: TestSubject): RunnerSubject {
        if (subject === '*') return {id: '*', kind: 'model', name: '*'};
        const callable = listCallables(session.engine).find((candidate) => candidate.path === subject);
        return {id: subject, kind: callable?.kind ?? 'function', name: subject};
    }

    // Runs the cases of `subjects` one by one, through `session.tests.forSubject`, so a mounted Tests view shows the
    // same results. Checks `signal` between cases.
    async function run(
        subjects: readonly TestSubject[],
        signal: AbortSignal,
    ): Promise<{runs: CaseRun[]; aborted: boolean}> {
        const runs: CaseRun[] = [];
        const modelRevision = String(session.getSlice('model').version);
        for (const subject of subjects) {
            const testCases = session.tests.forSubject(subject);
            const runner = createTestRunner(session.engine, testCases, runnerSubject(subject), {modelRevision});
            for (const testCase of testCases.listTestCases()) {
                if (signal.aborted) return {runs, aborted: true};
                await runner.run(testCase.id);
                runs.push({
                    ref: {subject, caseId: testCase.id, name: testCase.name},
                    outcome: caseOutcome(testCases, testCase.id),
                });
            }
        }
        return {runs, aborted: false};
    }

    function entriesOf(runs: readonly CaseRun[]): Baseline {
        const entries: Baseline = new Map();
        for (const {ref, outcome} of runs) {
            let cases = entries.get(ref.subject);
            if (!cases) entries.set(ref.subject, (cases = new Map()));
            cases.set(ref.caseId, outcome.passed);
        }
        return entries;
    }

    return {
        async runAll(signal) {
            const {runs, aborted} = await run(subjectsWithCases(), signal);
            const report = classifyRun(runs, baseline, aborted ? 'aborted' : 'complete');
            if (!aborted) {
                baseline = entriesOf(runs);
                ranAt = Date.now();
            }
            return report;
        },

        async runSubject(subject, signal) {
            const {runs, aborted} = await run([subject], signal);
            const report = classifyRun(runs, baseline, aborted ? 'aborted' : 'complete');
            if (!aborted) {
                const next = new Map(baseline);
                const entries = entriesOf(runs).get(subject);
                if (entries) next.set(subject, entries);
                else next.delete(subject);
                baseline = next;
                ranAt = Date.now();
            }
            return report;
        },

        lastTotals() {
            let passed = 0;
            let failed = 0;
            for (const cases of baseline.values()) {
                for (const casePassed of cases.values()) {
                    if (casePassed) passed += 1;
                    else failed += 1;
                }
            }
            return ranAt === undefined ? {passed, failed} : {passed, failed, ranAt};
        },

        subjectsWithCases,
    };
}
