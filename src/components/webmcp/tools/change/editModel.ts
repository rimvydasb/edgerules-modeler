import {LIMITS} from '../../core/limits';
import {validateInputMembers, validateModelPath} from '../../core/paths';
import {fail, type ToolError} from '../../core/toolResult';
import type {ChangeResult, DryRunResult, EditModelInput} from '../../project/changes/projectChangeService';
import {
    baseVersionSchema,
    changeResultProperties,
    dryRunSchema,
    changeResultRequired,
    inputSchema,
    modelPathSchema,
    resultSchema,
} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {
    atOperation,
    validateBaseVersion,
    validateBatch,
    validateDryRun,
    validateEntryMembers,
    validateText,
} from './changeInput';

export type {ChangeResult, DryRunResult, EditModelInput};
export type {ModelOperation} from '../../project/changes/operations/modelOperations';

const NAME_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

const MEMBERS: Record<string, readonly string[]> = {
    set: ['op', 'path', 'code'],
    rename: ['op', 'path', 'newName'],
    remove: ['op', 'path'],
};

function validateOperation(entry: Record<string, unknown>, index: number): ToolError | undefined {
    const members = MEMBERS[String(entry.op)];
    if (!members) {
        return fail('InvalidInput', `'operations[${index}].op' must be 'set', 'rename' or 'remove'.`, {
            operation: index,
        }).error;
    }
    const invalid =
        validateEntryMembers(entry, members, index) ??
        atOperation(validateModelPath(entry.path, `operations[${index}].path`), index);
    if (invalid) return invalid;
    if (entry.path === '*') {
        return fail('InvalidInput', `'operations[${index}].path' must not be '*'; set each top-level entry.`, {
            operation: index,
        }).error;
    }
    if (entry.op === 'set') {
        return validateText(entry.code, `operations[${index}].code`, LIMITS.operationCode, index, true);
    }
    if (entry.op === 'rename' && (typeof entry.newName !== 'string' || !NAME_SEGMENT.test(entry.newName))) {
        return fail('InvalidInput', `'operations[${index}].newName' must be one name such as 'maxLimit'.`, {
            operation: index,
        }).error;
    }
    return undefined;
}

export const editModel: ProjectTool<EditModelInput, ChangeResult | DryRunResult> = {
    name: 'edit-model',
    title: 'Edit model',
    description:
        'Changes the model in one atomic step: set the DSL of an entry (creates it when new), rename or ' +
        'remove. On a parse or link error nothing changes. Otherwise every test runs and the newly failing ' +
        'cases return. dryRun only checks.',
    summary: 'Change model DSL: set, rename, remove; runs all tests',
    inputSchema: inputSchema(
        {
            operations: {
                type: 'array',
                description: 'Applied in order. Each one is set, rename or remove of one model path.',
                items: {
                    type: 'object',
                    properties: {
                        op: {enum: ['set', 'rename', 'remove']},
                        path: {...modelPathSchema, description: "A dotted model path such as 'risk.score'."},
                        code: {
                            type: 'string',
                            description: "set: the DSL of the entry, e.g. 'age * 2' or 'func f(x): {…}'.",
                        },
                        newName: {type: 'string', description: 'rename: the new last name of the path.'},
                    },
                    required: ['op', 'path'],
                },
            },
            baseVersion: baseVersionSchema,
            dryRun: dryRunSchema,
        },
        ['operations'],
    ),
    outputSchema: resultSchema(changeResultProperties, changeResultRequired),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: false},
    availability: 'write',

    async run(input, context, signal) {
        const invalid =
            validateInputMembers(input, ['operations', 'baseVersion', 'dryRun']) ??
            validateBaseVersion(input.baseVersion) ??
            validateDryRun(input.dryRun) ??
            validateBatch(input.operations, 'operations');
        if (invalid) return {ok: false, error: invalid};
        for (const [index, entry] of input.operations.entries()) {
            const error = validateOperation(entry as unknown as Record<string, unknown>, index);
            if (error) return {ok: false, error};
        }
        return context.changes.editModel(input, signal);
    },
};
