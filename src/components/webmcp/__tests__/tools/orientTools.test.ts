import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ProjectOverview} from '../../project/inspection/projectOverview';
import type {GuidePage} from '../../project/guide/languageGuide';
import {LOAN_MODEL, openToolsFixture} from '../../testing/toolsFixture';

describe('get-project-overview', () => {
    it('describes the project, the entries, the test totals and the save state', async () => {
        const {call, session} = await openToolsFixture();
        await call('run-tests');
        const result = await call<ProjectOverview>('get-project-overview');
        expect(result).toMatchObject({
            ok: true,
            project: {name: 'Loans'},
            model: {},
            version: session.getSnapshot().localVersion,
            phase: 'ready',
            dslValid: true,
            draftPending: false,
            counts: {methods: 1, variables: 3, types: 0, testSubjects: 2, testCases: 3},
            tests: {passed: 2, failed: 1},
            readOnly: false,
            canSave: false,
        });
        expect(result).not.toHaveProperty('focus');
        if (result.ok) expect(result.tests.ranAt).toBeTypeOf('number');
    });

    it('reports the version after a change and the unsaved slices', async () => {
        const {call} = await openToolsFixture();
        const before = await call<ProjectOverview>('get-project-overview');
        await call('set-documentation', {items: [{path: 'risk', text: 'Risk class.'}]});
        const after = await call<ProjectOverview>('get-project-overview');
        if (!before.ok || !after.ok) throw new Error('overview failed');
        expect(after.version).toBeGreaterThan(before.version);
        expect(after.unsavedSlices).toContain('documentation');
    });

    it('reports a pending DSL draft and an invalid DSL', async () => {
        const {call, session} = await openToolsFixture();
        session.setDslDraft('{ broken: ');
        expect(await call<ProjectOverview>('get-project-overview')).toMatchObject({ok: true, draftPending: true});
        session.execute({type: 'commitDsl', source: '{ broken: '});
        const result = await call<ProjectOverview>('get-project-overview');
        expect(result).toMatchObject({ok: true, dslValid: false});
        if (result.ok) expect(result.dslError).toBeTypeOf('string');
    });

    it('reports the focus only with navigation, and the read-only and save flags', async () => {
        const navigation = {
            getFocus: () => ({path: 'risk', view: 'boxed' as const}),
            open: () => {},
        };
        const {call, handle} = await openToolsFixture(undefined, {navigation, allowSave: true});
        expect(await call<ProjectOverview>('get-project-overview')).toMatchObject({
            ok: true,
            focus: {path: 'risk', view: 'boxed'},
            readOnly: false,
            canSave: true,
        });
        handle.setReadOnly(true);
        expect(await call<ProjectOverview>('get-project-overview')).toMatchObject({readOnly: true, canSave: false});
    });

    it('rejects an input member', async () => {
        const {call} = await openToolsFixture();
        expect(await call('get-project-overview', {path: 'x'})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
    });
});

describe('get-language-guide', () => {
    it('returns the introduction of a topic with its sections, then one section', async () => {
        const {call} = await openToolsFixture();
        const intro = await call<GuidePage>('get-language-guide', {topic: 'introduction'});
        if (!intro.ok) throw new Error(intro.error.message);
        expect(intro.sections.length).toBeGreaterThan(0);
        const section = await call<GuidePage>('get-language-guide', {
            topic: 'introduction',
            section: intro.sections[0],
        });
        expect(section).toMatchObject({ok: true, section: intro.sections[0]});
    });

    it('fails for an unknown topic and an unknown section', async () => {
        const {call} = await openToolsFixture();
        expect(await call('get-language-guide', {topic: 'nope'})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
        expect(await call('get-language-guide', {topic: 'dates', section: 'nope'})).toMatchObject({
            ok: false,
            error: {code: 'NotFound'},
        });
        expect(await call('get-language-guide', {})).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
    });

    it('is registered in a read-only session', async () => {
        const {modelContext} = await openToolsFixture(undefined, {readOnly: true});
        expect(modelContext.names()).toEqual(
            expect.arrayContaining([
                'get-project-overview',
                'get-language-guide',
                'list-model-entries',
                'evaluate-model',
            ]),
        );
        expect(modelContext.names()).not.toContain('edit-model');
        expect(LOAN_MODEL).toContain('risk');
    });
});
