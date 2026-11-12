import {LIMITS} from '../../core/limits';
import {validateInputMembers, validateSourcePath} from '../../core/paths';
import {fail, type ToolError} from '../../core/toolResult';
import type {ReadSourceInput, SourceBatch, SourcePage} from '../../project/inspection/sourceReader';
import {inputSchema, resultSchema, sourcePathSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateInteger, validateOffset} from './inspectInput';

const pageProperties = {
    path: {type: 'string'},
    language: {enum: ['edgerules', 'markdown']},
    text: {type: 'string'},
    offset: {type: 'integer'},
    totalChars: {type: 'integer'},
    nextOffset: {type: 'integer'},
    documentation: {type: 'string'},
};

// `paths`: 1 to 50 source paths. `offsets`: an offset by path, only for paths in `paths`.
function validatePaths(paths: unknown, offsets: unknown): ToolError | undefined {
    if (!Array.isArray(paths) || paths.length < LIMITS.batchMin || paths.length > LIMITS.batchMax) {
        return fail('InvalidInput', `'paths' must be an array of ${LIMITS.batchMin} to ${LIMITS.batchMax} paths.`)
            .error;
    }
    for (const [index, path] of paths.entries()) {
        const invalid = validateSourcePath(path, `paths[${index}]`);
        if (invalid) return invalid;
    }
    if (offsets === undefined) return undefined;
    if (typeof offsets !== 'object' || offsets === null || Array.isArray(offsets)) {
        return fail('InvalidInput', "'offsets' must be an object of offsets by path.").error;
    }
    for (const [path, offset] of Object.entries(offsets)) {
        if (!paths.includes(path)) return fail('InvalidInput', `'offsets.${path}' names a path not in 'paths'.`).error;
        const invalid = validateInteger(offset, `offsets.${path}`, 0);
        if (invalid) return invalid;
    }
    return undefined;
}

export const readSource: ProjectTool<ReadSourceInput, SourcePage | SourceBatch> = {
    name: 'read-source',
    title: 'Read source',
    description:
        "Returns the DSL of a model entry with its documentation, the whole model for '*', or " +
        'doc:README.md. Long text pages with nextOffset. paths reads several entries; call again with next ' +
        'for the rest. Read an entry before you change it.',
    summary: 'Read the DSL of entries, the whole model or README',
    inputSchema: inputSchema({
        path: sourcePathSchema,
        offset: {type: 'integer', description: 'With path: a character offset; `nextOffset` of the previous page.'},
        paths: {type: 'array', items: sourcePathSchema, description: 'Instead of path: 1 to 50 paths, read in order.'},
        offsets: {
            type: 'object',
            additionalProperties: {type: 'integer'},
            description: 'With paths: the start offset by path, as `next.offsets` of the previous result.',
        },
    }),
    outputSchema: resultSchema({
        ...pageProperties,
        pages: {type: 'array', items: {type: 'object', properties: pageProperties}},
        errors: {
            type: 'array',
            items: {type: 'object', properties: {path: {type: 'string'}, code: {type: 'string'}, message: {}}},
        },
        next: {
            type: 'object',
            properties: {
                paths: {type: 'array', items: {type: 'string'}},
                offsets: {type: 'object', additionalProperties: {type: 'integer'}},
            },
        },
    }),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const members = validateInputMembers(input, ['path', 'offset', 'paths', 'offsets']);
        if (members) return {ok: false, error: members};
        const {path, offset, paths, offsets} = input;
        if ((path === undefined) === (paths === undefined)) {
            return fail('InvalidInput', "Give either 'path' or 'paths'.");
        }
        if (paths !== undefined) {
            if (offset !== undefined) return fail('InvalidInput', "'offset' goes with 'path'; use 'offsets'.");
            const invalid = validatePaths(paths, offsets);
            if (invalid) return {ok: false, error: invalid};
            return context.inspector.sources({paths, ...(offsets !== undefined && {offsets})});
        }
        if (offsets !== undefined) return fail('InvalidInput', "'offsets' goes with 'paths'; use 'offset'.");
        const invalid = validateSourcePath(path) ?? validateOffset(offset);
        if (invalid) return {ok: false, error: invalid};
        return context.inspector.source({path: path as string, ...(offset !== undefined && {offset})});
    },
};
