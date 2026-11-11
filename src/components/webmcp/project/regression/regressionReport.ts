import type {AssertionMismatch, CaseOutcome} from '../../../tests-manager/internal';
import {LIST_OUTPUT_BUDGET} from '../../core/limits';
import type {TestSubject} from '../../core/paths';
import {clipText} from '../../core/toolResult';

export interface CaseRef {
    subject: TestSubject;
    caseId: string;
    name: string;
}

export interface AssertionFailure {
    path: string; // subject-relative, as in `list-tests`
    expected: string; // the authored assertion text
    actual?: string; // `formatValue` of the computed value; absent with `error` or `missing`
    error?: string; // the evaluation error of this path
    missing?: true; // the result has no value at this path
}

export interface CaseFailure extends CaseRef {
    runError?: string; // the case did not run: the `TestResultSet.error`, for example an `ExecutionError` message
    assertions: AssertionFailure[]; // at most 5 per case
}

export interface RegressionReport {
    status: 'complete' | 'aborted'; // 'aborted': the agent aborted the call after the commit point
    passed: number; // passed cases in this run
    failed: number; // failed cases in this run
    newlyFailing: CaseFailure[]; // failed now; passed in the baseline or had no baseline result
    stillFailing: CaseRef[]; // failed in the baseline and now
    newlyPassing: CaseRef[]; // passed now; failed in the baseline
    truncated: boolean; // a list or a failure detail was trimmed to the output budget
}

/** One case of a run and its outcome. */
export interface CaseRun {
    ref: CaseRef;
    outcome: CaseOutcome;
}

/** Whether each case passed in the previous run: subject -> case id -> passed. */
export type Baseline = Map<TestSubject, Map<string, boolean>>;

export const MAX_ASSERTIONS_PER_CASE = 5;
const MAX_VALUE_TEXT = 200; // `expected`, `actual` and `error` of one assertion
const MAX_RUN_ERROR = 300;

function clipped(text: string, max: number, flag: {truncated: boolean}): string {
    if (text.length > max) flag.truncated = true;
    return clipText(text, max);
}

function toAssertionFailure(mismatch: AssertionMismatch, flag: {truncated: boolean}): AssertionFailure {
    const failure: AssertionFailure = {path: mismatch.path, expected: clipped(mismatch.expected, MAX_VALUE_TEXT, flag)};
    if (mismatch.missing) failure.missing = true;
    else if (mismatch.error !== undefined) failure.error = clipped(mismatch.error, MAX_VALUE_TEXT, flag);
    else if (mismatch.actual !== undefined) failure.actual = clipped(mismatch.actual, MAX_VALUE_TEXT, flag);
    return failure;
}

function toCaseFailure(run: CaseRun, flag: {truncated: boolean}): CaseFailure {
    const failure: CaseFailure = {...run.ref, assertions: []};
    if (run.outcome.runError !== undefined) failure.runError = clipped(run.outcome.runError, MAX_RUN_ERROR, flag);
    const mismatches = run.outcome.assertions;
    if (mismatches.length > MAX_ASSERTIONS_PER_CASE) flag.truncated = true;
    failure.assertions = mismatches.slice(0, MAX_ASSERTIONS_PER_CASE).map((m) => toAssertionFailure(m, flag));
    return failure;
}

/**
 * Compares each case of a run with `baseline`. A case without a baseline result that fails is newly failing; one that
 * passes is in no list.
 */
export function classifyRun(
    runs: readonly CaseRun[],
    baseline: Baseline,
    status: RegressionReport['status'],
): RegressionReport {
    const flag = {truncated: false};
    const report: RegressionReport = {
        status,
        passed: 0,
        failed: 0,
        newlyFailing: [],
        stillFailing: [],
        newlyPassing: [],
        truncated: false,
    };
    for (const run of runs) {
        const before = baseline.get(run.ref.subject)?.get(run.ref.caseId);
        if (run.outcome.passed) {
            report.passed += 1;
            if (before === false) report.newlyPassing.push({...run.ref});
        } else {
            report.failed += 1;
            if (before === false) report.stillFailing.push({...run.ref});
            else report.newlyFailing.push(toCaseFailure(run, flag));
        }
    }
    report.truncated = flag.truncated;
    return fitReport(report);
}

/**
 * Keeps `newlyFailing` in full and drops entries from the end of `stillFailing`, then of `newlyPassing`, until the
 * JSON of the report fits the list output budget.
 */
export function fitReport(report: RegressionReport, budget: number = LIST_OUTPUT_BUDGET): RegressionReport {
    const fitted = {...report, stillFailing: [...report.stillFailing], newlyPassing: [...report.newlyPassing]};
    const size = () => JSON.stringify({ok: true, regression: fitted}).length;
    while (size() > budget) {
        if (fitted.stillFailing.length > 0) fitted.stillFailing.pop();
        else if (fitted.newlyPassing.length > 0) fitted.newlyPassing.pop();
        else break;
        fitted.truncated = true;
    }
    return fitted;
}
