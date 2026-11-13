import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ProjectOverview} from '../../project/inspection/projectOverview';
import type {ChangeResult} from '../../tools/change/editModel';
import type {OpenResult} from '../../tools/host/openInEditor';
import type {SaveResultView} from '../../tools/host/saveProject';
import {LOAN_TESTS, openToolsFixture} from '../../testing/toolsFixture';
import type {ProjectToolsNavigation, ProjectToolsView} from '../../webmcp-types';

// The routes of a host: `open` records each navigation and moves the focus, as a Project Explorer click does.
function recordingNavigation() {
    const opened: [string, ProjectToolsView][] = [];
    let focus: {path: string; view: ProjectToolsView} = {path: '*', view: 'boxed'};
    const navigation: ProjectToolsNavigation = {
        getFocus: () => focus,
        open(path, view) {
            opened.push([path, view]);
            focus = {path, view};
        },
    };
    return {navigation, opened};
}

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

describe('host tool registration', () => {
    it('registers open-in-editor only with navigation, also when the project is read-only', async () => {
        const {navigation} = recordingNavigation();
        const readOnly = await openToolsFixture(undefined, {navigation, readOnly: true, allowSave: true});
        expect(readOnly.modelContext.names()).toEqual([...READ_TOOLS, 'open-in-editor']);

        const plain = await openToolsFixture();
        expect(plain.modelContext.names()).not.toContain('open-in-editor');
        expect(plain.modelContext.names()).not.toContain('save-project');
    });

    it('registers save-project with allowSave while not read-only, with consequentialHint', async () => {
        const {modelContext, handle} = await openToolsFixture(undefined, {allowSave: true});
        expect(modelContext.names().at(-1)).toBe('save-project');
        expect(modelContext.tool('save-project')?.annotations).toEqual({
            readOnlyHint: false,
            untrustedContentHint: false,
            consequentialHint: true,
        });
        handle.setReadOnly(true);
        expect(modelContext.names()).not.toContain('save-project');
        handle.setReadOnly(false);
        handle.setAllowSave(false);
        expect(modelContext.names()).not.toContain('save-project');
    });
});

describe('open-in-editor', () => {
    async function openFixture(input?: Parameters<typeof openToolsFixture>[0]) {
        const recording = recordingNavigation();
        const fixture = await openToolsFixture(input, {navigation: recording.navigation});
        return {...fixture, opened: recording.opened};
    }

    it('opens a path in the default view of its kind and moves the focus of the overview', async () => {
        const {call, opened} = await openFixture();

        expect(await call<OpenResult>('open-in-editor', {path: 'risk'})).toEqual({
            ok: true,
            path: 'risk',
            view: 'boxed',
        });
        expect(await call<OpenResult>('open-in-editor', {path: 'doc:README.md'})).toEqual({
            ok: true,
            path: 'doc:README.md',
            view: 'preview',
        });
        expect(await call<OpenResult>('open-in-editor', {path: 'applicant.age', view: 'code'})).toEqual({
            ok: true,
            path: 'applicant.age',
            view: 'code',
        });
        expect(opened).toEqual([
            ['risk', 'boxed'],
            ['doc:README.md', 'preview'],
            ['applicant.age', 'code'],
        ]);
        const overview = await call<ProjectOverview>('get-project-overview');
        expect(overview.ok && overview.focus).toEqual({path: 'applicant.age', view: 'code'});
    });

    it('opens the Flow view of a workbook by default, and the tests of a test subject', async () => {
        const {call} = await openFixture({
            model: {
                dsl: `{
    func risk(age: number): { level: if age < 25 then "high" else "low" }
    workbook book: {
        @InputNode
        applicant: { age: 30 }
    }
}`,
            },
            tests: LOAN_TESTS,
        });
        expect(await call<OpenResult>('open-in-editor', {path: 'book'})).toEqual({
            ok: true,
            path: 'book',
            view: 'flow',
        });
        expect(await call<OpenResult>('open-in-editor', {path: '*'})).toEqual({ok: true, path: '*', view: 'flow'});
        expect(await call<OpenResult>('open-in-editor', {path: 'risk', view: 'tests'})).toEqual({
            ok: true,
            path: 'risk',
            view: 'tests',
        });
    });

    it('rejects a view that the path does not have, and lists the views of the path', async () => {
        const {call, opened} = await openFixture();
        const result = await call('open-in-editor', {path: 'applicant', view: 'tests'});
        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'InvalidInput',
                path: 'applicant',
                hint: "The views of 'applicant': code, boxed, drd.",
            }),
        });
        const flow = await call('open-in-editor', {path: 'risk', view: 'flow'});
        expect(flow.ok).toBe(false);
        expect(opened).toEqual([]);
    });

    it('fails with NotFound for a missing path, and points a path inside a function to the function', async () => {
        const {call} = await openFixture();
        expect(await call('open-in-editor', {path: 'missing'})).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'NotFound', path: 'missing'}),
        });
        expect(await call('open-in-editor', {path: 'risk.level'})).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'InvalidInput', hint: "Open 'risk' instead."}),
        });
    });

    it('validates the input', async () => {
        const {call} = await openFixture();
        for (const input of [{}, {path: 'risk', view: 'table'}, {path: 'risk', extra: 1}, {path: 'a b'}]) {
            const result = await call('open-in-editor', input);
            expect(result.ok || result.error.code).toBe('InvalidInput');
        }
    });
});

describe('save-project', () => {
    it('saves the project as a new revision, and the overview shows nothing unsaved', async () => {
        const {call, session} = await openToolsFixture(undefined, {allowSave: true});
        const before = session.getSnapshot().revision;
        const changed = await call<ChangeResult>('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}]});
        expect(changed.ok).toBe(true);

        const result = await call<SaveResultView>('save-project', {baseVersion: session.getSnapshot().localVersion});

        expect(result).toEqual({ok: true, revision: expect.any(String), savedAt: expect.any(String)});
        expect(result.ok && result.revision).not.toBe(before);
        expect(result.ok && new Date(result.savedAt).toISOString()).toBe(result.ok && result.savedAt);
        const overview = await call<ProjectOverview>('get-project-overview');
        expect(overview.ok && overview.unsavedSlices).toEqual([]);
    });

    it('fails with VersionConflict on a stale baseVersion and saves nothing', async () => {
        const {call, session} = await openToolsFixture(undefined, {allowSave: true});
        const stale = session.getSnapshot().localVersion;
        await call<ChangeResult>('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}]});

        const result = await call('save-project', {baseVersion: stale});

        expect(result).toEqual({
            ok: false,
            error: expect.objectContaining({
                code: 'VersionConflict',
                currentVersion: session.getSnapshot().localVersion,
            }),
        });
        expect(session.getSnapshot().dirtySlices).toContain('model');
    });

    it('fails with ParseError while the user has invalid DSL in the Code view', async () => {
        const {call, session} = await openToolsFixture(undefined, {allowSave: true});
        session.execute({type: 'commitDsl', source: '{ broken: ( }'});

        expect(await call('save-project')).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'ParseError'}),
        });
    });

    it('fails with SaveConflict when the workspace has a newer revision', async () => {
        const {call, session, repository, locator} = await openToolsFixture(undefined, {allowSave: true});
        // Another tab saves the project first.
        await repository.save(locator, session.exportBundle(), session.getSnapshot().revision);

        expect(await call('save-project')).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'SaveConflict'}),
        });
        expect(session.getSnapshot().phase).toBe('conflict');
    });

    it('rejects an unknown member and a non-integer baseVersion', async () => {
        const {call} = await openToolsFixture(undefined, {allowSave: true});
        for (const input of [{force: true}, {baseVersion: 1.5}]) {
            const result = await call('save-project', input);
            expect(result.ok || result.error.code).toBe('InvalidInput');
        }
    });
});

describe('ProjectToolsHandle.activity', () => {
    it('reports the running tool from its start until it returns', async () => {
        const {modelContext, handle} = await openToolsFixture();
        const activity = handle.activity!;
        const seen: (string | undefined)[] = [];
        activity.subscribe(() => seen.push(activity.running()));

        await modelContext.call('run-tests');

        expect(seen).toEqual(['run-tests', undefined]);
        expect(activity.running()).toBeUndefined();
    });

    it('ends the running state when the agent cancels the call', async () => {
        const {modelContext, handle} = await openToolsFixture();
        const activity = handle.activity!;
        const cancel = new AbortController();
        const seen: (string | undefined)[] = [];
        activity.subscribe(() => seen.push(activity.running()));

        const pending = modelContext.call('evaluate-model', {target: 'decision'}, {signal: cancel.signal});
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
        cancel.abort();
        await pending;

        expect(seen.at(-1)).toBeUndefined();
        expect(activity.running()).toBeUndefined();
    });

    it('runs a Shell undo after the running tool call, as a change of its own', async () => {
        const {call, handle, session} = await openToolsFixture();
        const changed = await call<ChangeResult>('edit-model', {operations: [{op: 'set', path: 'unused', code: '2'}]});
        if (!changed.ok) throw new Error(changed.error.message);
        const activity = handle.activity!;

        const order: string[] = [];
        const running = call('run-tests').then(() => order.push('run-tests'));
        const undone = activity.undo(changed.changeId).then(() => order.push('undo'));
        await Promise.all([running, undone]);

        expect(order).toEqual(['run-tests', 'undo']);
        expect(session.engine.getCode('unused')).toBe('1');
        expect(activity.list()[0]).toEqual(expect.objectContaining({reverts: changed.changeId}));
    });
});
