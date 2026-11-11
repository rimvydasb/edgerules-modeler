import {validateInputMembers, validateSourcePath} from '../../core/paths';
import type {ReadSourceInput, SourcePage} from '../../project/inspection/sourceReader';
import {inputSchema, resultSchema, sourcePathSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateOffset} from './inspectInput';

export const readSource: ProjectTool<ReadSourceInput, SourcePage> = {
    name: 'read-source',
    title: 'Read source',
    description:
        "Returns the source text of one project element: EdgeRules DSL for a model path, the whole model for '*', or " +
        'Markdown for doc:README.md. A model path also returns its documentation. Long text comes in pages; ' +
        'continue with nextOffset. Use it to troubleshoot, or before you change an entry you have not seen.',
    inputSchema: inputSchema(
        {
            path: sourcePathSchema,
            offset: {type: 'integer', description: 'Character offset; `nextOffset` of the previous page.'},
        },
        ['path'],
    ),
    outputSchema: resultSchema(
        {
            path: {type: 'string'},
            language: {enum: ['edgerules', 'markdown']},
            text: {type: 'string'},
            offset: {type: 'integer'},
            totalChars: {type: 'integer'},
            nextOffset: {type: 'integer'},
            documentation: {type: 'string'},
        },
        ['path', 'language', 'text', 'offset', 'totalChars'],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid =
            validateInputMembers(input, ['path', 'offset']) ??
            validateSourcePath(input.path) ??
            validateOffset(input.offset);
        if (invalid) return {ok: false, error: invalid};
        return context.inspector.source(input);
    },
};
