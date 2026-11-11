import type {ToolResult} from '../core/toolResult';
import type {ToolAnnotations} from '../protocol/toolDefinition';

// TypeScript DOM types do not declare WebMCP, so the component declares the structural subset that it uses.

export interface ModelContextToolLike {
    name: string; // kebab-case, at most 30 characters
    title: string; // label for a confirmation dialog
    description: string; // at most 500 characters
    inputSchema: object; // JSON Schema draft 2020-12, `type: 'object'`
    outputSchema: object; // JSON Schema of `ToolResult<T>`
    annotations: ToolAnnotations;
    execute(input: object, options: {signal: AbortSignal}): Promise<ToolResult<unknown>>; // never rejects for a domain error
}

/** The structural subset of the WebMCP `ModelContext` that the component uses. */
export interface ModelContextLike {
    // Aborting `signal` unregisters the tool. Rejects on a bad or duplicate name.
    registerTool(tool: ModelContextToolLike, options?: {signal?: AbortSignal}): Promise<void>;
}

function isModelContext(value: unknown): value is ModelContextLike {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as {registerTool?: unknown}).registerTool === 'function'
    );
}

/** `document.modelContext` when the browser has it; `undefined` otherwise, for example outside a secure context. */
export function getModelContext(doc?: Document): ModelContextLike | undefined {
    const target = doc ?? (typeof document === 'undefined' ? undefined : document);
    const candidate = (target as {modelContext?: unknown} | undefined)?.modelContext;
    return isModelContext(candidate) ? candidate : undefined;
}
