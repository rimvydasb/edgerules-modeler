import {createTestCasesService, type TestSubjectId, type TestSuite} from '../../test-cases-service';
import type {MutableDecisionService} from '../tests-manager-types';
import {caseFailures} from './caseFailures';
import {createTestRunner} from './createTestRunner';

/** The outcome of one authored test case: it passes when the run succeeds and every asserted cell matches. */
export interface TestCaseOutcome {
    id: string;
    name: string;
    passed: boolean;
    failures: string[]; // one line per failed assertion, or the error of the run
}

/**
 * Runs every test case of an authored `suite` against `service` without a user interface, with the same runner and the
 * same cell comparison as the Tests view. The suite keeps the rows it was authored with. Nothing is stored.
 */
export async function runTestSuite(
    service: MutableDecisionService,
    subjectId: TestSubjectId,
    suite: TestSuite,
): Promise<TestCaseOutcome[]> {
    const testCases = createTestCasesService('headless', subjectId, {dbName: `headless-${subjectId}`});
    try {
        testCases.syncRows(suite.rows);
        const ordered = [...suite.cases].sort((a, b) => a.order - b.order);
        const created = ordered.map((authored) => {
            const testCase = testCases.addTestCase(authored.name);
            for (const [path, text] of Object.entries(authored.inputs))
                testCases.setCell(testCase.id, path, 'input', text);
            for (const [path, text] of Object.entries(authored.assertions)) {
                testCases.setCell(testCase.id, path, 'assertion', text);
            }
            return {authored, id: testCase.id};
        });

        const kind = subjectId === '*' ? 'model' : 'function';
        await createTestRunner(service, testCases, {id: subjectId, kind, name: subjectId}).runAll();

        return created.map(({authored, id}) => {
            const failures = caseFailures(testCases, id);
            return {id: authored.id, name: authored.name, passed: failures.length === 0, failures};
        });
    } finally {
        testCases.dispose();
    }
}
