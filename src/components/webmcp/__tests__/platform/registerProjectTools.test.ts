import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {openFixtureProject} from '../../../project-session/testing/sessionFixture';
import {getModelContext, registerProjectTools} from '../../index';
import type {RunTestsResult} from '../../tools/feedback/runTests';
import {openToolsFixture} from '../../testing/toolsFixture';

describe('getModelContext', () => {
    it('is undefined without document.modelContext, and returns it when present', () => {
        expect(getModelContext()).toBeUndefined();
        const modelContext = {registerTool: async () => {}};
        const doc = {modelContext} as unknown as Document;
        expect(getModelContext(doc)).toBe(modelContext);
        expect(getModelContext({modelContext: {}} as unknown as Document)).toBeUndefined();
    });
});

// The tools that a read-only project registers, in registration order.
const READ_TOOLS = [
    'run-tests',
    'get-project-overview',
    'get-language-guide',
    'list-model-entries',
    'read-source',
    'search-model',
    'list-tests',
    'evaluate-model',
];

describe('registerProjectTools', () => {
    it('returns an inactive handle and registers nothing without a model context', async () => {
        const {session} = await openFixtureProject();
        const handle = registerProjectTools({modelContext: undefined, session});
        expect(handle.active).toBe(false);
        handle.setReadOnly(true);
        handle.setAllowSave(true);
        handle.dispose();
    });

    it('registers run-tests, also when the project is read-only, and the change tools when it is not', async () => {
        const {modelContext, handle} = await openToolsFixture(undefined, {readOnly: true});
        expect(handle.active).toBe(true);
        expect(handle.activity?.list()).toEqual([]);
        expect(modelContext.names()).toEqual(READ_TOOLS);
        expect(modelContext.tool('run-tests')?.annotations).toEqual({
            readOnlyHint: true,
            untrustedContentHint: false,
            consequentialHint: false,
        });
        handle.setReadOnly(false);
        expect(modelContext.names()).toEqual([
            ...READ_TOOLS,
            'edit-model',
            'edit-tests',
            'set-documentation',
            'undo-agent-change',
        ]);
        expect(modelContext.tool('edit-model')?.annotations).toEqual({
            readOnlyHint: false,
            untrustedContentHint: false,
            consequentialHint: false,
        });
        handle.setReadOnly(true);
        expect(modelContext.names()).toEqual(READ_TOOLS);
    });

    it('takes the first baseline on registration, so the first run-tests reports what changed since', async () => {
        const {call} = await openToolsFixture();
        const result = await call<RunTestsResult>('run-tests');
        expect(result).toEqual({
            ok: true,
            regression: {
                status: 'complete',
                passed: 2,
                failed: 1,
                newlyFailing: [],
                stillFailing: [{subject: '*', caseId: 'unused-is-two', name: 'Unused is two'}],
                newlyPassing: [],
                truncated: false,
            },
        });
    });

    it('dispose aborts the signal of every tool and unregisters it', async () => {
        const {modelContext, handle} = await openToolsFixture();
        const registrations = [...modelContext.registrations];
        expect(registrations.length).toBeGreaterThan(0);
        expect(registrations.some((registration) => registration.signal?.aborted)).toBe(false);

        handle.dispose();
        expect(registrations.every((registration) => registration.signal?.aborted)).toBe(true);
        expect(modelContext.names()).toEqual([]);
    });

    it('a call of a tool that was disposed while queued returns Aborted', async () => {
        const {modelContext, handle} = await openToolsFixture();
        const tool = modelContext.tool('run-tests')!;
        const pending = tool.execute({}, {signal: new AbortController().signal});
        handle.dispose();
        expect(await pending).toEqual({ok: false, error: expect.objectContaining({code: 'Aborted'})});
    });
});
