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
        'Returns the state of the EdgeRules project open in this page: project and model name, save state, DSL ' +
        'validity, the number of entries per section, the test totals of the last run, the entry the user is looking ' +
        'at, and the current version. Call it at the start of a session.',
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
