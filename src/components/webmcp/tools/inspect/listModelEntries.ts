import {validateInputMembers} from '../../core/paths';
import {fail} from '../../core/toolResult';
import {validateModelPath} from '../../core/paths';
import {MODEL_SECTIONS, type ListModelEntriesInput, type ModelEntriesPage} from '../../project/inspection/modelOutline';
import {inputSchema, modelPathSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateLimit, validateOffset} from './inspectInput';

export const listModelEntries: ProjectTool<ListModelEntriesInput, ModelEntriesPage> = {
    name: 'list-model-entries',
    title: 'List model entries',
    description:
        'Lists the entries of the EdgeRules model as a flat outline: path, kind, signature or type, the first line of ' +
        'the documentation and the number of test cases. Use it to find the path of an entry, for example before a ' +
        'change to an entry you have not seen. Filter by Project Explorer section or list only the entries below one ' +
        'context.',
    inputSchema: inputSchema({
        sections: {type: 'array', items: {enum: [...MODEL_SECTIONS]}, description: 'Default: every section.'},
        under: {...modelPathSchema, description: "Only entries at or below this context; default '*'."},
        offset: {type: 'integer', description: '`nextOffset` of the previous page.'},
        limit: {type: 'integer', description: 'At most 200; default 100.'},
    }),
    outputSchema: resultSchema(
        {
            entries: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        path: {type: 'string'},
                        section: {enum: [...MODEL_SECTIONS]},
                        kind: {type: 'string'},
                        signature: {type: 'string'},
                        doc: {type: 'string'},
                        testCases: {type: 'integer'},
                    },
                    required: ['path', 'section', 'kind'],
                },
            },
            total: {type: 'integer'},
            nextOffset: {type: 'integer'},
        },
        ['entries', 'total'],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid =
            validateInputMembers(input, ['sections', 'under', 'offset', 'limit']) ??
            (input.under === undefined ? undefined : validateModelPath(input.under, 'under')) ??
            validateOffset(input.offset) ??
            validateLimit(input.limit);
        if (invalid) return {ok: false, error: invalid};
        const {sections} = input;
        if (sections !== undefined) {
            const bad = !Array.isArray(sections) ? sections : sections.find((s) => !MODEL_SECTIONS.includes(s));
            if (!Array.isArray(sections) || bad !== undefined) {
                return fail('InvalidInput', `'sections' must list names of: ${MODEL_SECTIONS.join(', ')}.`);
            }
        }
        return context.inspector.outline(input);
    },
};
