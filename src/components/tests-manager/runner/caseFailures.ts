import type {TestCasesService} from '../../test-cases-service';
import {formatValue, matches} from '../model/values';

/** One asserted cell that does not match the computed value. */
export interface AssertionMismatch {
    path: string; // subject-relative; '' for the single result of a scalar-returning callable
    expected: string; // the authored assertion text
    actual?: string; // `formatValue` of the computed value; absent with `error` or `missing`
    error?: string; // the evaluation error of this path
    missing?: true; // the result has no value at this path
    actualValue?: unknown; // the computed value itself, for a message that needs more than `formatValue`
}

/** Why one test case does not pass. `passed` when its last run succeeded and every asserted cell matches. */
export interface CaseOutcome {
    passed: boolean;
    runError?: string; // the case did not run: never ran, or the run failed (`TestResultSet.error`)
    assertions: AssertionMismatch[]; // in row order
}

/** The outcome of the last run of one test case, with every failed assertion. */
export function caseOutcome(testCasesService: TestCasesService, testCaseId: string): CaseOutcome {
    const resultSet = testCasesService.getResultSet(testCaseId);
    if (resultSet === undefined) return {passed: false, runError: 'the case did not run', assertions: []};
    if (resultSet.status !== 'ok')
        return {passed: false, runError: resultSet.error ?? 'the run failed', assertions: []};
    const assertions: AssertionMismatch[] = [];
    for (const row of testCasesService.listRows()) {
        if (row.section !== 'assertions') continue;
        const expected = testCasesService.getCell(testCaseId, row.path, 'assertion') ?? '';
        const result = resultSet.results[row.path];
        const actualValue = result?.value;
        if (matches(expected, actualValue, row.type)) continue;
        if (result === undefined) {
            assertions.push({path: row.path, expected, missing: true});
        } else if (result.error !== undefined) {
            assertions.push({path: row.path, expected, error: result.error});
        } else {
            assertions.push({path: row.path, expected, actual: formatValue(actualValue), actualValue});
        }
    }
    return {passed: assertions.length === 0, assertions};
}

/**
 * Why one test case does not pass, as one line per failed assertion or the error of its run. Empty when the case passes:
 * its last run succeeded and every asserted cell matches the computed value.
 */
export function caseFailures(testCasesService: TestCasesService, testCaseId: string): string[] {
    const outcome = caseOutcome(testCasesService, testCaseId);
    if (outcome.runError !== undefined) return [outcome.runError];
    return outcome.assertions.map(
        (failure) =>
            `${failure.path || '(result)'}: expected ${failure.expected}, got ${JSON.stringify(failure.actualValue)}`,
    );
}
