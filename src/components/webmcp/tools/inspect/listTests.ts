import {validateInputMembers, validateTestSubject} from '../../core/paths';
import type {ListTestsInput, TestSuiteView} from '../../project/inspection/testSuiteView';
import {inputSchema, resultSchema, testSubjectSchema, testValuesSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export const listTests: ProjectTool<ListTestsInput, TestSuiteView> = {
    name: 'list-tests',
    title: 'List tests',
    description:
        "Returns the authored test cases of one test subject, the whole model ('*') or a callable path. Each case has " +
        'its id, name, input values and assertion values, keyed by paths relative to the subject. Also returns the ' +
        'paths that cases can use. Use it before edit-tests on a subject you have not seen.',
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
