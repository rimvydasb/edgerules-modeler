import {describe, expect, it} from 'vitest';
import {ok} from '../../core/toolResult';
import {createToolQueue} from '../../platform/toolQueue';
import {createToolRegistry} from '../../platform/toolRegistry';
import type {ToolDefinition} from '../../protocol/toolDefinition';
import {createRecordingModelContext} from '../../testing/recordingModelContext';

function deferred(): {promise: Promise<void>; resolve: () => void} {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => (resolve = done));
    return {promise, resolve};
}

function tool(name: string, run: () => Promise<void>): ToolDefinition<object, object, undefined> {
    return {
        name,
        title: name,
        description: name,
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
        annotations: {},
        availability: 'always',
        async run() {
            await run();
            return ok({});
        },
    };
}

describe('ToolQueue', () => {
    it('runs tasks one at a time in arrival order, after a failed task too', async () => {
        const queue = createToolQueue();
        const log: string[] = [];
        const first = queue.run(async () => {
            log.push('first');
            throw new Error('boom');
        });
        const second = queue.run(async () => {
            log.push('second');
            return 2;
        });
        await expect(first).rejects.toThrow('boom');
        await expect(second).resolves.toBe(2);
        expect(log).toEqual(['first', 'second']);
    });

    it('starts a second tool call after the first call and its regression run end', async () => {
        const log: string[] = [];
        const regression = deferred();
        const modelContext = createRecordingModelContext();
        const registry = createToolRegistry({
            modelContext,
            context: undefined,
            queue: createToolQueue(),
            tools: [
                tool('edit-model', async () => {
                    log.push('write start');
                    await regression.promise; // the regression run after the write
                    log.push('regression end');
                }),
                tool('run-tests', async () => {
                    log.push('second start');
                }),
            ],
        });
        registry.sync({readOnly: false, navigation: false, allowSave: false});

        const firstCall = modelContext.call('edit-model');
        const secondCall = modelContext.call('run-tests');
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(log).toEqual(['write start']);

        regression.resolve();
        await Promise.all([firstCall, secondCall]);
        expect(log).toEqual(['write start', 'regression end', 'second start']);
    });
});
