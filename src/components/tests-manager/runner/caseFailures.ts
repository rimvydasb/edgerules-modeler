import type {TestCasesService} from '../../test-cases-service';
import {matches} from '../model/values';

/**
 * Why one test case does not pass, as one line per failed assertion or the error of its run. Empty when the case passes:
 * its last run succeeded and every asserted cell matches the computed value.
 */
export function caseFailures(testCasesService: TestCasesService, testCaseId: string): string[] {
    const resultSet = testCasesService.getResultSet(testCaseId);
    if (resultSet === undefined) return ['the case did not run'];
    if (resultSet.status !== 'ok') return [resultSet.error ?? 'the run failed'];
    const failures: string[] = [];
    for (const row of testCasesService.listRows()) {
        if (row.section !== 'assertions') continue;
        const expected = testCasesService.getCell(testCaseId, row.path, 'assertion') ?? '';
        const actual = resultSet.results[row.path]?.value;
        if (!matches(expected, actual, row.type)) {
            failures.push(`${row.path || '(result)'}: expected ${expected}, got ${JSON.stringify(actual)}`);
        }
    }
    return failures;
}
