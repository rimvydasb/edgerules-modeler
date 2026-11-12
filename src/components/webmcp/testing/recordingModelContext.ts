import type {ToolResult} from '../core/toolResult';
import type {ModelContextLike, ModelContextToolLike} from '../platform/modelContext';

// The name rule of the WebMCP draft: ASCII letters, digits, '_', '-', '.'; 1 to 128 characters.
const PLATFORM_TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

export interface RecordedTool {
    tool: ModelContextToolLike;
    signal: AbortSignal | undefined; // the registration signal; aborting it unregisters the tool
}

/** A `ModelContextLike` that keeps the registered tools in memory and runs their `execute`, as the browser would. */
export interface RecordingModelContext extends ModelContextLike {
    names(): string[]; // the registered tools, in registration order
    tool(name: string): ModelContextToolLike | undefined;
    registrations: RecordedTool[]; // every registration, including the unregistered ones
    toolChanges: number; // how many times the tool list changed (the browser's `toolchange` event)
    // Calls `execute` and round-trips the result through JSON, as the browser does. Throws for an unknown tool.
    call<T = unknown>(name: string, input?: object, options?: {signal?: AbortSignal}): Promise<ToolResult<T>>;
}

export function createRecordingModelContext(): RecordingModelContext {
    const tools = new Map<string, ModelContextToolLike>();
    const context: RecordingModelContext = {
        registrations: [],
        toolChanges: 0,

        async registerTool(tool, options) {
            if (!PLATFORM_TOOL_NAME.test(tool.name)) throw new TypeError(`Invalid tool name '${tool.name}'.`);
            if (tools.has(tool.name))
                throw new DOMException(`Duplicate tool name '${tool.name}'.`, 'InvalidStateError');
            const signal = options?.signal;
            context.registrations.push({tool, signal});
            if (signal?.aborted) return;
            tools.set(tool.name, tool);
            context.toolChanges += 1;
            signal?.addEventListener(
                'abort',
                () => {
                    if (tools.get(tool.name) !== tool) return;
                    tools.delete(tool.name);
                    context.toolChanges += 1;
                },
                {once: true},
            );
        },

        names: () => [...tools.keys()],
        tool: (name) => tools.get(name),

        async call<T>(name: string, input: object = {}, options: {signal?: AbortSignal} = {}) {
            const tool = tools.get(name);
            if (!tool) throw new Error(`No registered tool '${name}'. Registered: ${[...tools.keys()].join(', ')}`);
            const signal = options.signal ?? new AbortController().signal;
            const result = await tool.execute(input, {signal});
            return JSON.parse(JSON.stringify(result)) as ToolResult<T>;
        },
    };
    return context;
}
