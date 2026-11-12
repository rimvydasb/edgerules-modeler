import {describe, expect, it, vi} from 'vitest';
import {ok} from '../../core/toolResult';
import type {ModelContextLike} from '../../platform/modelContext';
import {createToolQueue} from '../../platform/toolQueue';
import {createToolRegistry} from '../../platform/toolRegistry';
import type {ToolAvailability, ToolDefinition} from '../../protocol/toolDefinition';
import {createRecordingModelContext} from '../../testing/recordingModelContext';

type Run = ToolDefinition<object, object, {calls: number}>['run'];

function tool(
    name: string,
    availability: ToolAvailability,
    run?: Run,
): ToolDefinition<object, object, {calls: number}> {
    return {
        name,
        title: name,
        description: `The ${name} tool.`,
        summary: `The ${name} tool.`,
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
        annotations: {readOnlyHint: availability === 'always'},
        availability,
        run:
            run ??
            (async (_input, context) => {
                context.calls += 1;
                return ok({calls: context.calls});
            }),
    };
}

const TOOLS = [
    tool('edit-model', 'write'),
    tool('run-tests', 'always'),
    tool('open-in-editor', 'navigation'),
    tool('save-project', 'save'),
];

function setup(tools = TOOLS, modelContext = createRecordingModelContext()) {
    const context = {calls: 0};
    const registry = createToolRegistry({modelContext, tools, context, queue: createToolQueue()});
    return {registry, modelContext, context};
}

describe('ToolRegistry — availability', () => {
    it('registers the tools that the flags make available, in catalog order', () => {
        const {registry, modelContext} = setup();
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        expect(modelContext.names()).toEqual(['edit-model', 'run-tests']);

        const all = setup();
        all.registry.sync({readOnly: false, navigation: true, allowSave: true});
        expect(all.modelContext.names()).toEqual(['edit-model', 'run-tests', 'open-in-editor', 'save-project']);
        expect(all.registry.registered()).toEqual(['edit-model', 'run-tests', 'open-in-editor', 'save-project']);
    });

    it('readOnly unregisters the write and save tools; turning it off registers them again', () => {
        const {registry, modelContext} = setup();
        registry.sync({readOnly: false, navigation: true, allowSave: true});
        const changesBefore = modelContext.toolChanges;

        registry.sync({readOnly: true, navigation: true, allowSave: true});
        expect(modelContext.names()).toEqual(['run-tests', 'open-in-editor']);
        expect(modelContext.toolChanges).toBe(changesBefore + 2);

        registry.sync({readOnly: false, navigation: true, allowSave: true});
        expect(modelContext.names().sort()).toEqual(['edit-model', 'open-in-editor', 'run-tests', 'save-project']);
    });

    it('allowSave registers and unregisters only save-project', () => {
        const {registry, modelContext} = setup();
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        registry.sync({readOnly: false, navigation: false, allowSave: true});
        expect(modelContext.names()).toContain('save-project');
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        expect(modelContext.names()).toEqual(['edit-model', 'run-tests']);
    });

    it('reports a rejected registration and does not count the tool as registered', async () => {
        const onRegisterError = vi.fn();
        const modelContext: ModelContextLike = {registerTool: () => Promise.reject(new TypeError('bad name'))};
        const registry = createToolRegistry({
            modelContext,
            tools: [tool('run-tests', 'always')],
            context: {calls: 0},
            queue: createToolQueue(),
            onRegisterError,
        });
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        await vi.waitFor(() => expect(onRegisterError).toHaveBeenCalledWith('run-tests', expect.any(TypeError)));
        expect(registry.registered()).toEqual([]);
    });
});

describe('ToolRegistry — execute', () => {
    it('passes the context to run and returns its result', async () => {
        const {registry, modelContext} = setup();
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        expect(await modelContext.call('run-tests')).toEqual({ok: true, calls: 1});
        expect(await modelContext.call('edit-model')).toEqual({ok: true, calls: 2});
    });

    it('a tool that throws returns InternalError and does not reject', async () => {
        const throwing = tool('run-tests', 'always', async () => {
            throw new Error('unexpected');
        });
        const {registry, modelContext} = setup([throwing]);
        registry.sync({readOnly: false, navigation: false, allowSave: false});

        const result = await modelContext.call('run-tests');
        expect(result).toEqual({
            ok: false,
            error: {code: 'InternalError', message: 'run-tests failed unexpectedly: unexpected'},
        });
    });

    it('an AbortError of an aborted call becomes Aborted', async () => {
        const aborting = tool('run-tests', 'always', async (_input, _context, signal) => {
            signal.throwIfAborted();
            return ok({});
        });
        const {registry, modelContext} = setup([aborting]);
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        const controller = new AbortController();
        controller.abort();

        const result = await modelContext.call('run-tests', {}, {signal: controller.signal});
        expect(result).toEqual({ok: false, error: expect.objectContaining({code: 'Aborted'})});
    });

    it('dispose aborts the signal of every registration and of a running call', async () => {
        let callSignal: AbortSignal | undefined;
        let release!: () => void;
        const slow = tool('edit-model', 'write', async (_input, _context, signal) => {
            callSignal = signal;
            await new Promise<void>((resolve) => (release = resolve));
            return ok({});
        });
        const {registry, modelContext} = setup([slow, tool('run-tests', 'always')]);
        registry.sync({readOnly: false, navigation: false, allowSave: false});
        const running = modelContext.call('edit-model');
        await vi.waitFor(() => expect(callSignal).toBeDefined());

        registry.dispose();
        expect(modelContext.registrations.every((registration) => registration.signal?.aborted)).toBe(true);
        expect(modelContext.names()).toEqual([]);
        expect(callSignal?.aborted).toBe(true);
        release();
        await running;

        registry.sync({readOnly: false, navigation: false, allowSave: false});
        expect(modelContext.names()).toEqual([]);
    });
});
