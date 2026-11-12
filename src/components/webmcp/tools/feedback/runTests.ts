import {validateInputMembers, validateTestSubject, type TestSubject} from '../../core/paths';
import {fail, ok} from '../../core/toolResult';
import type {RegressionReport} from '../../project/regression/regressionReport';
import {inputSchema, regressionReportSchema, resultSchema, testSubjectSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export interface RunTestsInput {
    subject?: TestSubject; // default: every subject with test cases
}

export interface RunTestsResult {
    regression: RegressionReport;
}

export const runTests: ProjectTool<RunTestsInput, RunTestsResult> = {
    name: 'run-tests',
    title: 'Run tests',
    description:
        'Runs the test cases of every subject, or of one subject, now. Returns the totals, the failing cases ' +
        'with expected and actual values, and what changed since the last run. Use it when the user asks to ' +
        'run tests.',
    summary: 'Run all tests, or one subject, now',
    inputSchema: inputSchema({
        subject: {...testSubjectSchema, description: "'*' or the path of a function. Omit it to run every subject."},
    }),
    outputSchema: resultSchema({regression: regressionReportSchema}, ['regression']),
    annotations: {readOnlyHint: true, untrustedContentHint: false, consequentialHint: false},
    availability: 'always',

    async run(input, context, signal) {
        const invalid = validateInputMembers(input, ['subject']);
        if (invalid) return {ok: false, error: invalid};
        const {subject} = input;
        if (subject !== undefined) {
            const invalidSubject = validateTestSubject(subject);
            if (invalidSubject) return {ok: false, error: invalidSubject};
            if (!context.regression.subjectsWithCases().includes(subject)) {
                return fail('NotFound', `The test subject '${subject}' has no test cases.`, {
                    path: subject,
                    hint: 'Call list-tests to see the test subjects and their cases.',
                });
            }
        }
        const regression =
            subject === undefined
                ? await context.regression.runAll(signal)
                : await context.regression.runSubject(subject, signal);
        return ok({regression});
    },
};
