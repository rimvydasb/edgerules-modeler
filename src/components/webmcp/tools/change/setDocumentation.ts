import {LIMITS} from '../../core/limits';
import {README_PATH, validateInputMembers, validateSourcePath} from '../../core/paths';
import {fail, type ToolError} from '../../core/toolResult';
import type {DocumentationChangeResult, SetDocumentationInput} from '../../project/changes/projectChangeService';
import {baseVersionSchema, inputSchema, resultSchema, sourcePathSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {atOperation, validateBaseVersion, validateBatch, validateEntryMembers, validateText} from './changeInput';

export type {DocumentationChangeResult, SetDocumentationInput};

function validateItem(entry: Record<string, unknown>, index: number): ToolError | undefined {
    const at = `items[${index}]`;
    const invalid =
        validateEntryMembers(entry, ['path', 'text'], index) ??
        atOperation(validateSourcePath(entry.path, `${at}.path`), index);
    if (invalid) return invalid;
    if (entry.path === '*') {
        return fail('InvalidInput', `'${at}.path' must not be '*'; use '${README_PATH}' for the project.`, {
            operation: index,
        }).error;
    }
    return validateText(entry.text, `${at}.text`, LIMITS.documentationText, index, entry.path === README_PATH);
}

export const setDocumentation: ProjectTool<SetDocumentationInput, DocumentationChangeResult> = {
    name: 'set-documentation',
    title: 'Set documentation',
    description:
        'Sets the documentation of model entries or the project README. Each item replaces the whole Markdown text ' +
        'of one path; an empty text removes the documentation of a model entry. The editors show the documentation ' +
        'next to its entry. Documentation does not change test results, so no tests run.',
    inputSchema: inputSchema(
        {
            items: {
                type: 'array',
                description: 'Each item replaces the documentation of one path.',
                items: {
                    type: 'object',
                    properties: {
                        path: sourcePathSchema,
                        text: {type: 'string', description: 'The whole Markdown text.'},
                    },
                    required: ['path', 'text'],
                },
            },
            baseVersion: baseVersionSchema,
        },
        ['items'],
    ),
    outputSchema: resultSchema({version: {type: 'integer'}, changeId: {type: 'string'}}, ['version', 'changeId']),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: false},
    availability: 'write',

    async run(input, context) {
        const invalid =
            validateInputMembers(input, ['items', 'baseVersion']) ??
            validateBaseVersion(input.baseVersion) ??
            validateBatch(input.items, 'items');
        if (invalid) return {ok: false, error: invalid};
        for (const [index, entry] of input.items.entries()) {
            const error = validateItem(entry as unknown as Record<string, unknown>, index);
            if (error) return {ok: false, error};
        }
        return context.changes.setDocumentation(input);
    },
};
