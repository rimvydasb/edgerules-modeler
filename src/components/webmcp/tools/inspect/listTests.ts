import {validateInputMembers, validateTestSubject} from '../../core/paths';
import type {ListTestsInput, TestSuiteView} from '../../project/inspection/testSuiteView';
import {inputSchema, resultSchema, testSubjectSchema, testValuesSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export const listTests: ProjectTool<ListTestsInput, TestSuiteView> = {
    name: 'list-tests',
    title: 'List tests',
    description:
        "Returns the test cases of one subject ('*' or a callable path): id, name, and input and assertion " +
        'values by subject-relative path, and the paths that cases can use. Call it before edit-tests on a ' +
        'new subject.',
    summary: 'Test cases and value paths of one test subject',
    inputSchema: inputSchema({subject: testSubjectSchema}, ['subject']),
    outputSchema: resultSchema(
        {
            subject: {type: 'string'},
            paths: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        path: {type: 'string'},
                        section: {enum: ['inputs', 'assertions', 'validations']},
                        type: {type: 'string'},
                    },
                    required: ['path', 'section'],
                },
            },
            cases: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {type: 'string'},
                        name: {type: 'string'},
                        inputs: testValuesSchema,
                        assertions: testValuesSchema,
                    },
                    required: ['id', 'name', 'inputs', 'assertions'],
                },
            },
        },
        ['subject', 'paths', 'cases'],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid = validateInputMembers(input, ['subject']) ?? validateTestSubject(input.subject);
        if (invalid) return {ok: false, error: invalid};
        return context.inspector.testSuite(input);
    },
};
