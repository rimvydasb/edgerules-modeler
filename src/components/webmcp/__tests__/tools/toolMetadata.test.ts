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
        summary: 'Run the tests',
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

    it('the catalog holds every tool in catalog order', () => {
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
            'open-in-editor',
            'save-project',
        ]);
    });

    it('the catalog has unique names', () => {
        const names = TOOL_CATALOG.map((definition) => definition.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('flags a bad name, a long description and summary, and long parameter names and descriptions', () => {
        const problems = checkToolMetadata(
            tool({
                name: 'RunTests',
                description: 'x'.repeat(251),
                summary: 's'.repeat(61),
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
            'RunTests: description has 251 characters, at most 250',
            'RunTests: summary has 61 characters, at most 60',
            `RunTests: parameter '${'p'.repeat(31)}' has a name longer than 30 characters`,
            "RunTests: parameter 'items[].code' has a description longer than 150 characters",
        ]);
    });

    it('flags an empty summary', () => {
        expect(checkToolMetadata(tool({summary: ' '}))).toEqual(['run-tests: summary is empty']);
    });

    it('flags a name longer than 30 characters and an input schema that is not an object', () => {
        const problems = checkToolMetadata(tool({name: 'get-a-very-long-tool-name-that-is-long', inputSchema: {}}));
        expect(problems).toEqual([
            "name 'get-a-very-long-tool-name-that-is-long' is longer than 30 characters",
            "get-a-very-long-tool-name-that-is-long: inputSchema is not of type 'object'",
        ]);
    });
});
