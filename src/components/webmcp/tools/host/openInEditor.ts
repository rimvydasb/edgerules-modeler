import {validateInputMembers, validateSourcePath} from '../../core/paths';
import {fail} from '../../core/toolResult';
import type {HostView, OpenInEditorInput, OpenResult} from '../../project/projectHostActions';
import {inputSchema, resultSchema, sourcePathSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export type {OpenInEditorInput, OpenResult};

const VIEWS: readonly HostView[] = ['code', 'boxed', 'flow', 'tests', 'preview'];

export const openInEditor: ProjectTool<OpenInEditorInput, OpenResult> = {
    name: 'open-in-editor',
    title: 'Open in editor',
    description:
        'Shows one project element to the user in the Modeler: a model entry or the README, in the code, boxed, ' +
        'flow, tests or preview view. Use it to show the user the result of a change or the entry that an answer is ' +
        'about.',
    inputSchema: inputSchema(
        {
            path: sourcePathSchema,
            view: {
                enum: [...VIEWS],
                description: 'The view; default: the default view of the entry kind.',
            },
        },
        ['path'],
    ),
    outputSchema: resultSchema({path: {type: 'string'}, view: {enum: [...VIEWS]}}, ['path', 'view']),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: false},
    availability: 'navigation',

    async run(input, context) {
        const invalid = validateInputMembers(input, ['path', 'view']) ?? validateSourcePath(input.path);
        if (invalid) return {ok: false, error: invalid};
        if (input.view !== undefined && !VIEWS.includes(input.view)) {
            return fail(
                'InvalidInput',
                `'view' must be one of ${VIEWS.join(', ')}; got ${JSON.stringify(input.view)}.`,
            );
        }
        const open = context.host.open;
        if (!open) return fail('InternalError', 'This page gives the tools no navigation.');
        return open(input);
    },
};
