import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {listCallables} from '#lib/callables';
import type {ProjectSession} from '../project-session';
import {caseOutcome, createTestRunner, type TestSubject} from '../tests-manager/internal';

/** The state of the last run of one test case. */
export type CaseStatus = 'passed' | 'failed' | 'error' | 'not-run';

/** One test case, as the Tests Overview lists it. */
export interface CaseSummary {
    id: string;
    name: string;
    status: CaseStatus;
    detail?: string; // why it does not pass: the run error, or the first failed assertion
    ranAt?: number; // epoch ms of its last run
    stale?: boolean; // its last run is from an older model revision
}

/** The cases and the totals of one test subject. */
export interface SubjectSummary extends Totals {
    subject: string; // '*' or the path of a callable
    cases: CaseSummary[];
}

export interface Totals {
    total: number;
    passed: number;
    failed: number; // a failed assertion or a failed run
    notRun: number;
}

/** Every test subject with cases, '*' first, and the totals over all of them. */
export interface TestsSummary extends Totals {
    subjects: SubjectSummary[];
    ranAt?: number; // the newest run of any case
}

/** A run of all tests in progress: `done` of `total` cases ran. */
export interface TestsRunState {
    running: boolean;
    done: number;
    total: number;
}

interface TestsRunStore {
    getState(): TestsRunState;
    subscribe(listener: () => void): () => void;
    runAll(): Promise<void>;
}

const IDLE: TestsRunState = {running: false, done: 0, total: 0};

/** The subjects of `session` that have test cases: '*' first, then in document order. */
export function subjectsWithCases(session: ProjectSession): string[] {
    const subjects = Object.entries(session.tests.exportDocument().subjects)
        .filter(([, suite]) => suite.cases.length > 0)
        .map(([subject]) => subject);
    return [...subjects.filter((s) => s === '*'), ...subjects.filter((s) => s !== '*')];
}

function runnerSubject(session: ProjectSession, subject: string): TestSubject {
    if (subject === '*') return {id: '*', kind: 'model', name: '*'};
    const callable = listCallables(session.engine).find((candidate) => candidate.path === subject);
    return {id: subject, kind: callable?.kind ?? 'function', name: subject};
}

// One store per session: a run started on the overview page keeps its progress when the user opens another page.
const stores = new WeakMap<ProjectSession, TestsRunStore>();

function runStore(session: ProjectSession): TestsRunStore {
    let store = stores.get(session);
    if (store) return store;
    let state = IDLE;
    const listeners = new Set<() => void>();
    const set = (next: TestsRunState) => {
        state = next;
        for (const listener of listeners) listener();
    };
    store = {
        getState: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        // Runs every case of every subject through `session.tests`, so a mounted Tests view shows the same results.
        async runAll() {
            if (state.running) return;
            const modelRevision = String(session.getSlice('model').version);
            const subjects = subjectsWithCases(session);
            const total = subjects.reduce((sum, s) => sum + session.tests.forSubject(s).listTestCases().length, 0);
            let done = 0;
            set({running: true, done, total});
            try {
                for (const subject of subjects) {
                    const testCases = session.tests.forSubject(subject);
                    const runner = createTestRunner(session.engine, testCases, runnerSubject(session, subject), {
                        modelRevision,
                    });
                    for (const testCase of testCases.listTestCases()) {
                        await runner.run(testCase.id);
                        done += 1;
                        set({running: true, done, total});
                    }
                }
            } finally {
                set(IDLE);
            }
        },
    };
    stores.set(session, store);
    return store;
}

function summarize(session: ProjectSession): TestsSummary {
    const revision = String(session.getSlice('model').version);
    const summary: TestsSummary = {subjects: [], total: 0, passed: 0, failed: 0, notRun: 0};
    for (const subject of subjectsWithCases(session)) {
        const testCases = session.tests.forSubject(subject);
        const entry: SubjectSummary = {subject, cases: [], total: 0, passed: 0, failed: 0, notRun: 0};
        for (const testCase of testCases.listTestCases()) {
            const resultSet = testCases.getResultSet(testCase.id);
            const item: CaseSummary = {id: testCase.id, name: testCase.name, status: 'not-run'};
            if (resultSet !== undefined) {
                const outcome = caseOutcome(testCases, testCase.id);
                item.ranAt = resultSet.ranAt;
                if (resultSet.modelRevision !== undefined && resultSet.modelRevision !== revision) item.stale = true;
                if (outcome.passed) item.status = 'passed';
                else if (outcome.runError !== undefined) {
                    item.status = 'error';
                    item.detail = outcome.runError;
                } else {
                    item.status = 'failed';
                    const first = outcome.assertions[0];
                    if (first) {
                        const actual = first.error ?? (first.missing ? 'no value' : first.actual);
                        item.detail = `${first.path || 'result'}: expected ${first.expected}, got ${actual}`;
                    }
                }
                if (summary.ranAt === undefined || resultSet.ranAt > summary.ranAt) summary.ranAt = resultSet.ranAt;
            }
            entry.cases.push(item);
            entry.total += 1;
            if (item.status === 'passed') entry.passed += 1;
            else if (item.status === 'not-run') entry.notRun += 1;
            else entry.failed += 1;
        }
        summary.subjects.push(entry);
        summary.total += entry.total;
        summary.passed += entry.passed;
        summary.failed += entry.failed;
        summary.notRun += entry.notRun;
    }
    return summary;
}

/**
 * The results of every test case of the project, from the last run of each case, and the run of all tests. Updates
 * on each result, whichever view ran the case.
 */
export function useTestsStatus(session: ProjectSession): {
    summary: TestsSummary;
    run: TestsRunState;
    runAll: () => Promise<void>;
} {
    const store = runStore(session);
    const run = useSyncExternalStore(store.subscribe, store.getState);
    const [tick, setTick] = useState(0);
    const subjectKey = subjectsWithCases(session).join('\n');

    useEffect(() => {
        const bump = () => setTick((value) => value + 1);
        const unsubscribers = [
            session.subscribe(bump),
            ...subjectKey
                .split('\n')
                .filter((subject) => subject !== '')
                .map((subject) => session.tests.forSubject(subject).subscribe(bump)),
        ];
        return () => {
            for (const unsubscribe of unsubscribers) unsubscribe();
        };
    }, [session, subjectKey]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summary = useMemo(() => summarize(session), [session, tick, subjectKey]);
    return {summary, run, runAll: store.runAll};
}
