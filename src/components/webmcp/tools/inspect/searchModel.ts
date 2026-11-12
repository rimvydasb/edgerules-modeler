import {LIMITS} from '../../core/limits';
import {validateInputMembers} from '../../core/paths';
import {fail} from '../../core/toolResult';
import {SEARCH_SCOPES, type SearchModelInput, type SearchResult} from '../../project/inspection/modelSearch';
import {inputSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateLimit} from './inspectInput';

export const searchModel: ProjectTool<SearchModelInput, SearchResult> = {
    name: 'search-model',
    title: 'Search model',
    description:
        'Finds text in the model DSL, entry names and documentation, ignoring case, like grep. Returns each ' +
        'matching path with its line and an excerpt. Use it to find every place that uses a name or a value.',
    summary: 'Grep the model DSL, names and documentation',
    inputSchema: inputSchema(
        {
            query: {type: 'string', description: 'The text to find; 1 to 200 characters.'},
            scope: {type: 'array', items: {enum: [...SEARCH_SCOPES]}, description: 'Default: all three.'},
            limit: {type: 'integer', description: 'At most 200; default 100.'},
        },
        ['query'],
    ),
    outputSchema: resultSchema(
        {
            matches: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        path: {type: 'string'},
                        scope: {enum: [...SEARCH_SCOPES]},
                        line: {type: 'integer'},
                        excerpt: {type: 'string'},
                    },
                    required: ['path', 'scope', 'excerpt'],
                },
            },
            truncated: {type: 'boolean'},
        },
        ['matches', 'truncated'],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: true, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid = validateInputMembers(input, ['query', 'scope', 'limit']) ?? validateLimit(input.limit);
        if (invalid) return {ok: false, error: invalid};
        const {query, scope} = input;
        if (typeof query !== 'string' || query.length < LIMITS.searchQueryMin || query.length > LIMITS.searchQueryMax) {
            return fail(
                'InvalidInput',
                `'query' must be a string of ${LIMITS.searchQueryMin} to ${LIMITS.searchQueryMax} characters.`,
            );
        }
        if (scope !== undefined && (!Array.isArray(scope) || scope.some((s) => !SEARCH_SCOPES.includes(s)))) {
            return fail('InvalidInput', `'scope' must list names of: ${SEARCH_SCOPES.join(', ')}.`);
        }
        return context.inspector.search(input);
    },
};
