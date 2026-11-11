import type {AnyToolDefinition} from './toolDefinition';

// webmcp-story.md, "Tool design rules".
export const METADATA_LIMITS = {
    name: 30,
    description: 500,
    parameterName: 30,
    parameterDescription: 150,
} as const;

const TOOL_NAME = /^[a-z]+(-[a-z]+)+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Every `properties` member of a JSON Schema, at any depth, with its dotted location.
function collectParameters(schema: unknown, at: string, into: Array<{at: string; name: string; schema: unknown}>) {
    if (!isRecord(schema)) return;
    const properties = schema.properties;
    if (isRecord(properties)) {
        for (const [name, member] of Object.entries(properties)) {
            const location = at ? `${at}.${name}` : name;
            into.push({at: location, name, schema: member});
            collectParameters(member, location, into);
        }
    }
    collectParameters(schema.items, at ? `${at}[]` : '[]', into);
    for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
        const variants = schema[key];
        if (Array.isArray(variants)) for (const variant of variants) collectParameters(variant, at, into);
    }
    if (isRecord(schema.$defs)) {
        for (const definition of Object.values(schema.$defs)) collectParameters(definition, at, into);
    }
}

/** The metadata problems of one tool: name, description and parameter lengths. Empty when the tool is valid. */
export function checkToolMetadata(tool: AnyToolDefinition): string[] {
    const problems: string[] = [];
    if (!TOOL_NAME.test(tool.name)) problems.push(`name '${tool.name}' is not kebab-case verb-noun`);
    if (tool.name.length > METADATA_LIMITS.name) problems.push(`name '${tool.name}' is longer than 30 characters`);
    if (tool.title.trim() === '') problems.push(`${tool.name}: title is empty`);
    if (tool.description.trim() === '') problems.push(`${tool.name}: description is empty`);
    if (tool.description.length > METADATA_LIMITS.description) {
        problems.push(`${tool.name}: description has ${tool.description.length} characters, at most 500`);
    }
    if (!isRecord(tool.inputSchema) || tool.inputSchema.type !== 'object') {
        problems.push(`${tool.name}: inputSchema is not of type 'object'`);
    }
    const parameters: Array<{at: string; name: string; schema: unknown}> = [];
    collectParameters(tool.inputSchema, '', parameters);
    for (const parameter of parameters) {
        if (parameter.name.length > METADATA_LIMITS.parameterName) {
            problems.push(`${tool.name}: parameter '${parameter.at}' has a name longer than 30 characters`);
        }
        const description = isRecord(parameter.schema) ? parameter.schema.description : undefined;
        if (typeof description === 'string' && description.length > METADATA_LIMITS.parameterDescription) {
            problems.push(`${tool.name}: parameter '${parameter.at}' has a description longer than 150 characters`);
        }
    }
    return problems;
}
