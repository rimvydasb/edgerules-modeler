// Shared JSON Schema (draft 2020-12) fragments of the tool inputs and outputs. The schemas are loose: types, enums and
// required members only. The tools validate strictly and return `InvalidInput` (webmcp-story.md, "Tool design rules").

import type {ToolErrorCode} from '../core/toolResult';

type Schema = Record<string, unknown>;

export const modelPathSchema: Schema = {
    type: 'string',
    description: "'*' for the whole model, or a dotted model path such as 'applicant.age'.",
};

export const sourcePathSchema: Schema = {
    type: 'string',
    description: "A model path, or 'doc:README.md' for the project README.",
};

export const testSubjectSchema: Schema = {
    type: 'string',
    description: "'*' for the tests of the whole model, otherwise the dotted path of a function.",
};

export const toolErrorCodes = [
    'InvalidInput',
    'NotFound',
    'VersionConflict',
    'ParseError',
    'LinkError',
    'DuplicateName',
    'ExecutionError',
    'SolverRequired',
    'UndoBlocked',
    'SaveConflict',
    'Aborted',
    'InternalError',
] as const satisfies readonly ToolErrorCode[];

const modelDiagnosticSchema: Schema = {
    type: 'object',
    properties: {
        source: {enum: ['parser', 'linker']},
        code: {type: 'string'},
        message: {type: 'string'},
        path: {type: 'string'},
        line: {type: 'integer'},
        column: {type: 'integer'},
        excerpt: {type: 'string'},
    },
    required: ['source', 'message'],
};

export const toolErrorSchema: Schema = {
    type: 'object',
    properties: {
        code: {enum: [...toolErrorCodes]},
        message: {type: 'string'},
        path: {type: 'string'},
        operation: {type: 'integer'},
        diagnostics: {type: 'array', items: modelDiagnosticSchema},
        currentVersion: {type: 'integer'},
        conflicts: {type: 'array', items: {type: 'string'}},
        hint: {type: 'string'},
    },
    required: ['code', 'message'],
};

const caseRefProperties: Schema = {
    subject: {type: 'string'},
    caseId: {type: 'string'},
    name: {type: 'string'},
};

const caseRefSchema: Schema = {type: 'object', properties: caseRefProperties, required: ['subject', 'caseId', 'name']};

const caseFailureSchema: Schema = {
    type: 'object',
    properties: {
        ...caseRefProperties,
        runError: {type: 'string'},
        assertions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    path: {type: 'string'},
                    expected: {type: 'string'},
                    actual: {type: 'string'},
                    error: {type: 'string'},
                    missing: {type: 'boolean'},
                },
                required: ['path', 'expected'],
            },
        },
    },
    required: ['subject', 'caseId', 'name', 'assertions'],
};

export const regressionReportSchema: Schema = {
    type: 'object',
    properties: {
        status: {enum: ['complete', 'aborted']},
        passed: {type: 'integer'},
        failed: {type: 'integer'},
        newlyFailing: {type: 'array', items: caseFailureSchema},
        stillFailing: {type: 'array', items: caseRefSchema},
        newlyPassing: {type: 'array', items: caseRefSchema},
        truncated: {type: 'boolean'},
    },
    required: ['status', 'passed', 'failed', 'newlyFailing', 'stillFailing', 'newlyPassing', 'truncated'],
};

/** The input schema of a tool: an object with `properties`, of which `required` are required. */
export function inputSchema(properties: Schema, required: string[] = []): Schema {
    return {type: 'object', properties, ...(required.length > 0 && {required}), additionalProperties: false};
}

/** The output schema of `ToolResult<T>`: `{ok: true, ...properties}` or `{ok: false, error}`. */
export function resultSchema(properties: Schema, required: string[] = []): Schema {
    return {
        type: 'object',
        oneOf: [
            {
                type: 'object',
                properties: {ok: {const: true}, ...properties},
                required: ['ok', ...required],
            },
            {
                type: 'object',
                properties: {ok: {const: false}, error: toolErrorSchema},
                required: ['ok', 'error'],
            },
        ],
    };
}

export const baseVersionSchema: Schema = {
    type: 'integer',
    description: '`version` from a previous result. The change fails with VersionConflict when the project changed.',
};

/** The members of a change result: `version`, `changeId`, `changed` and `regression`. */
export const changeResultProperties: Schema = {
    version: {type: 'integer'},
    changeId: {type: 'string'},
    changed: {type: 'array', items: {type: 'string'}},
    regression: regressionReportSchema,
};

export const changeResultRequired = ['version', 'changeId', 'changed', 'regression'];

/** A map of test cell text by subject-relative path: strings without quotes, lists and objects as JSON. */
export const testValuesSchema: Schema = {
    type: 'object',
    additionalProperties: {type: 'string'},
};
