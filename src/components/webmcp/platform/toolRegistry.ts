import {fail, isAbortError, messageOf, type ToolResult} from '../core/toolResult';
import {isAvailable, type AnyToolDefinition, type ToolAvailabilityFlags} from '../protocol/toolDefinition';
import type {ModelContextLike, ModelContextToolLike} from './modelContext';
import type {ToolQueue} from './toolQueue';

export interface ToolRegistryOptions<C> {
    modelContext: ModelContextLike;
    tools: readonly AnyToolDefinition<C>[]; // in catalog order
    context: C; // passed to every `run`
    queue: ToolQueue;
    onRegisterError?: (name: string, error: unknown) => void; // `registerTool` rejected, for example a duplicate name
    // A call starts to run (`running` true), or returns or is aborted (`running` false); once each per call.
    onRunning?: (name: string, running: boolean) => void;
}

export interface ToolRegistry {
    readonly signal: AbortSignal; // aborted by `dispose`; every registration and every call follows it
    // Registers the tools that `flags` make available and unregisters the others. Only the difference changes.
    sync(flags: ToolAvailabilityFlags): void;
    registered(): readonly string[]; // the names of the registered tools, in catalog order
    dispose(): void; // unregisters every tool and aborts every running call
}

function abortedResult(): ToolResult<never> {
    return fail('Aborted', 'The call was aborted before its commit point.');
}

/**
 * The WebMCP adapter of a tool list. Registers every tool under one `AbortController`; a tool that the flags turn off
 * is unregistered through its own controller, which follows the shared one. Each call runs through `queue`, and
 * `execute` never rejects: a thrown error becomes `InternalError`, an `AbortError` becomes `Aborted`.
 */
export function createToolRegistry<C>(options: ToolRegistryOptions<C>): ToolRegistry {
    const {modelContext, tools, context, queue} = options;
    const all = new AbortController();
    const active = new Map<string, AbortController>();

    function adapt(tool: AnyToolDefinition<C>): ModelContextToolLike {
        return {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            annotations: tool.annotations,
            execute(input, callOptions) {
                const signals = [all.signal, callOptions?.signal].filter((s): s is AbortSignal => s !== undefined);
                const signal = AbortSignal.any(signals);
                return queue.run(async () => {
                    if (signal.aborted) return abortedResult();
                    const ended = running(tool.name, signal);
                    try {
                        return await tool.run(input ?? {}, context, signal);
                    } catch (thrown) {
                        if (isAbortError(thrown) && signal.aborted) return abortedResult();
                        return fail('InternalError', `${tool.name} failed unexpectedly: ${messageOf(thrown)}`);
                    } finally {
                        ended();
                    }
                });
            },
        };
    }

    // Reports the start of a call, and its end when it returns or when the agent cancels it.
    function running(name: string, signal: AbortSignal): () => void {
        const {onRunning} = options;
        if (!onRunning) return () => {};
        let done = false;
        const end = () => {
            if (done) return;
            done = true;
            signal.removeEventListener('abort', end);
            onRunning(name, false);
        };
        signal.addEventListener('abort', end, {once: true});
        onRunning(name, true);
        return end;
    }

    function register(tool: AnyToolDefinition<C>): void {
        const own = new AbortController();
        active.set(tool.name, own);
        const signal = AbortSignal.any([all.signal, own.signal]);
        modelContext.registerTool(adapt(tool), {signal}).catch((error: unknown) => {
            if (active.get(tool.name) === own) active.delete(tool.name);
            options.onRegisterError?.(tool.name, error);
        });
    }

    function unregister(name: string): void {
        active.get(name)?.abort();
        active.delete(name);
    }

    return {
        signal: all.signal,
        sync(flags) {
            if (all.signal.aborted) return;
            for (const tool of tools) {
                const wanted = isAvailable(tool.availability, flags);
                if (wanted && !active.has(tool.name)) register(tool);
                if (!wanted && active.has(tool.name)) unregister(tool.name);
            }
        },
        registered: () => tools.filter((tool) => active.has(tool.name)).map((tool) => tool.name),
        dispose() {
            all.abort();
            active.clear();
        },
    };
}
