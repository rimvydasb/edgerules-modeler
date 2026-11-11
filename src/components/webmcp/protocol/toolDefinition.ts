import type {ToolResult} from '../core/toolResult';

/** When the registry registers a tool, from the options of `registerProjectTools`. */
export type ToolAvailability =
    | 'always'
    | 'write' // not `readOnly`
    | 'navigation' // `navigation` is set
    | 'save'; // `allowSave` and not `readOnly`

export interface ToolAnnotations {
    readOnlyHint?: boolean; // the tool only reads project state
    untrustedContentHint?: boolean; // the result contains authored text
    consequentialHint?: boolean; // the agent or the browser asks the user to confirm before the call
}

/**
 * One tool, without any WebMCP call. `C` is what the tool can reach; `tools/` binds it to `ProjectToolsContext`, so
 * this layer does not import `project/`.
 */
export interface ToolDefinition<I extends object, O extends object, C = unknown> {
    name: string; // kebab-case `verb-noun`, at most 30 characters
    title: string; // label for a confirmation dialog
    description: string; // at most 500 characters
    inputSchema: object; // JSON Schema draft 2020-12, `type: 'object'`
    outputSchema: object; // JSON Schema of `ToolResult<O>`
    annotations: ToolAnnotations;
    availability: ToolAvailability;
    // Never rejects for a domain error. Rejects only with an `AbortError`, and only before its commit point.
    run(input: I, context: C, signal: AbortSignal): Promise<ToolResult<O>>;
}

/** A tool definition with its input and output types erased, as the registry holds it. `run` is a method, so its
 * parameter is checked bivariantly and every `ToolDefinition<I, O, C>` fits. */
export type AnyToolDefinition<C = unknown> = ToolDefinition<object, object, C>;

/** The options that select the tools by `availability`. */
export interface ToolAvailabilityFlags {
    readOnly: boolean;
    navigation: boolean;
    allowSave: boolean;
}

export function isAvailable(availability: ToolAvailability, flags: ToolAvailabilityFlags): boolean {
    switch (availability) {
        case 'always':
            return true;
        case 'write':
            return !flags.readOnly;
        case 'navigation':
            return flags.navigation;
        case 'save':
            return flags.allowSave && !flags.readOnly;
    }
}
