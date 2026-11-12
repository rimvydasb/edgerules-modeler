import {LIMITS} from '../../core/limits';
import {validateInputMembers, validateTestSubject} from '../../core/paths';
import {fail, type ToolError} from '../../core/toolResult';
import type {DryRunResult, EditTestsInput, TestsChangeResult} from '../../project/changes/projectChangeService';
import {
    baseVersionSchema,
    changeResultProperties,
    dryRunSchema,
    changeResultRequired,
    inputSchema,
    resultSchema,
    testSubjectSchema,
    testValuesSchema,
} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateBaseVersion, validateBatch, validateDryRun, validateEntryMembers, validateText} from './changeInput';

export type {EditTestsInput, TestsChangeResult};
export type {TestOperation, TestValues} from '../../project/changes/operations/testOperations';

const MEMBERS: Record<string, readonly string[]> = {
    add: ['op', 'name', 'inputs', 'assertions'],
    update: ['op', 'caseId', 'name', 'inputs', 'assertions'],
    remove: ['op', 'caseId'],
};

function validateValues(value: unknown, member: string, index: number): ToolError | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail('InvalidInput', `'${member}' must be an object of value texts by path.`, {operation: index}).error;
    }
    for (const [path, text] of Object.entries(value)) {
        const invalid = validateText(text, `${member}.${path}`, LIMITS.testValueText, index);
        if (invalid) return invalid;
    }
    return undefined;
}

function validateOperation(entry: Record<string, unknown>, index: number): ToolError | undefined {
    const members = MEMBERS[String(entry.op)];
    const at = `operations[${index}]`;
    if (!members) {
        return fail('InvalidInput', `'${at}.op' must be 'add', 'update' or 'remove'.`, {operation: index}).error;
    }
    const invalid = validateEntryMembers(entry, members, index);
    if (invalid) return invalid;
    if (entry.op !== 'add' && (typeof entry.caseId !== 'string' || entry.caseId === '')) {
        return fail('InvalidInput', `'${at}.caseId' must be the id of a test case.`, {operation: index}).error;
    }
    if (entry.op === 'add' || entry.name !== undefined) {
        const invalidName = validateText(entry.name, `${at}.name`, 200, index, true);
        if (invalidName) return invalidName;
    }
    return (
        validateValues(entry.inputs, `${at}.inputs`, index) ??
        validateValues(entry.assertions, `${at}.assertions`, index)
    );
}

export const editTests: ProjectTool<EditTestsInput, TestsChangeResult | DryRunResult<TestsChangeResult>> = {
    name: 'edit-tests',
    title: 'Edit tests',
    description:
        'Adds, updates or removes test cases of one subject in one atomic step. Values are cell texts by ' +
        "path: strings and dates without quotes, lists and objects as JSON; '' clears. Every test runs after " +
        'it. dryRun only checks.',
    summary: 'Add, update or remove test cases; runs all tests',
    inputSchema: inputSchema(
        {
            subject: testSubjectSchema,
            operations: {
                type: 'array',
                description: 'Applied in order. Each one adds, updates or removes one test case.',
                items: {
                    type: 'object',
                    properties: {
                        op: {enum: ['add', 'update', 'remove']},
                        caseId: {type: 'string', description: 'update, remove: the id of the test case.'},
                        name: {type: 'string', description: 'The name of the test case.'},
                        inputs: {...testValuesSchema, description: 'Input values by path, e.g. {"age": "20"}.'},
                        assertions: {
                            ...testValuesSchema,
                            description: 'Expected values by path, e.g. {"level": "high"}.',
                        },
                    },
                    required: ['op'],
                },
            },
            baseVersion: baseVersionSchema,
            dryRun: dryRunSchema,
        },
        ['subject', 'operations'],
    ),
    outputSchema: resultSchema({...changeResultProperties, addedCaseIds: {type: 'array', items: {type: 'string'}}}, [
        ...changeResultRequired,
        'addedCaseIds',
    ]),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: false},
    availability: 'write',

    async run(input, context, signal) {
        const invalid =
            validateInputMembers(input, ['subject', 'operations', 'baseVersion', 'dryRun']) ??
            validateTestSubject(input.subject) ??
            validateBaseVersion(input.baseVersion) ??
            validateDryRun(input.dryRun) ??
            validateBatch(input.operations, 'operations');
        if (invalid) return {ok: false, error: invalid};
        for (const [index, entry] of input.operations.entries()) {
            const error = validateOperation(entry as unknown as Record<string, unknown>, index);
            if (error) return {ok: false, error};
        }
        return context.changes.editTests(input, signal);
    },
};
