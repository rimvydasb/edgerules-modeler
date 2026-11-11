import {describe, expect, it} from 'vitest';
import {ok} from '../../core/toolResult';
import {checkToolMetadata} from '../../protocol/toolMetadata';
import type {AnyToolDefinition} from '../../protocol/toolDefinition';
import {TOOL_CATALOG} from '../../tools/toolCatalog';

function tool(overrides: Partial<AnyToolDefinition>): AnyToolDefinition {
    return {
        name: 'run-tests',
        title: 'Run tests',
        description: 'Runs the tests.',
        inputSchema: {type: 'object', properties: {}},
        outputSchema: {type: 'object'},
        annotations: {},
        availability: 'always',
        run: async () => ok({}),
        ...overrides,
    };
}

describe('tool metadata', () => {
    it.each(TOOL_CATALOG.map((definition) => [definition.name, definition] as const))(
        '%s follows the tool design rules',
        (_name, definition) => {
            expect(checkToolMetadata(definition)).toEqual([]);
        },
    );

    it('the catalog holds the change, feedback, orient and inspect tools in catalog order', () => {
        expect(TOOL_CATALOG.map((definition) => definition.name)).toEqual([
            'edit-model',
            'edit-tests',
            'set-documentation',
            'undo-agent-change',
            'run-tests',
            'get-project-overview',
            'get-language-guide',
            'list-model-entries',
            'read-source',
            'search-model',
            'list-tests',
            'evaluate-model',
        ]);
    });

    it('the catalog has unique names', () => {
        const names = TOOL_CATALOG.map((definition) => definition.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('flags a bad name, a long description and long parameter names and descriptions', () => {
        const problems = checkToolMetadata(
            tool({
                name: 'RunTests',
                description: 'x'.repeat(501),
                inputSchema: {
                    type: 'object',
                    properties: {
                        ['p'.repeat(31)]: {type: 'string'},
                        items: {
                            type: 'array',
                            items: {type: 'object', properties: {code: {description: 'd'.repeat(151)}}},
                        },
                    },
                },
            }),
        );
        expect(problems).toEqual([
            "name 'RunTests' is not kebab-case verb-noun",
            'RunTests: description has 501 characters, at most 500',
            `RunTests: parameter '${'p'.repeat(31)}' has a name longer than 30 characters`,
            "RunTests: parameter 'items[].code' has a description longer than 150 characters",
        ]);
    });

    it('flags a name longer than 30 characters and an input schema that is not an object', () => {
        const problems = checkToolMetadata(tool({name: 'get-a-very-long-tool-name-that-is-long', inputSchema: {}}));
        expect(problems).toEqual([
            "name 'get-a-very-long-tool-name-that-is-long' is longer than 30 characters",
            "get-a-very-long-tool-name-that-is-long: inputSchema is not of type 'object'",
        ]);
    });
});
