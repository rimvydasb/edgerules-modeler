import {validateInputMembers} from '../../core/paths';
import {ok} from '../../core/toolResult';
import type {ProjectOverview} from '../../project/inspection/projectOverview';
import {inputSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export type GetProjectOverviewInput = Record<string, never>;

export const getProjectOverview: ProjectTool<GetProjectOverviewInput, ProjectOverview> = {
    name: 'get-project-overview',
    title: 'Get project overview',
    description:
        'Call it first. Returns the state of the open project: names, save state, DSL validity, entry counts, ' +
        "the totals of the last test run, the user's focus, the version, a one-line index of every tool " +
        'of this page, and how the tools work together.',
    summary: 'Project state, last test totals and this tool index',
    inputSchema: inputSchema({}),
    outputSchema: resultSchema(
        {
            project: {type: 'object'},
            model: {type: 'object'},
            version: {type: 'integer'},
            phase: {enum: ['ready', 'saving', 'conflict', 'closed']},
            unsavedSlices: {type: 'array', items: {type: 'string'}},
            savedAt: {type: 'string'},
            dslValid: {type: 'boolean'},
            dslError: {type: 'string'},
            draftPending: {type: 'boolean'},
            counts: {type: 'object', additionalProperties: {type: 'integer'}},
            tests: {type: 'object'},
            focus: {type: 'object'},
            readOnly: {type: 'boolean'},
            canSave: {type: 'boolean'},
            tools: {type: 'object', additionalProperties: {type: 'string'}},
            workflow: {type: 'array', items: {type: 'string'}},
        },
        [
            'project',
            'model',
            'version',
            'phase',
            'unsavedSlices',
            'dslValid',
            'draftPending',
            'counts',
            'tests',
            'readOnly',
            'canSave',
            'workflow',
        ],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid = validateInputMembers(input, []);
        if (invalid) return {ok: false, error: invalid};
        return ok(context.inspector.overview());
    },
};
