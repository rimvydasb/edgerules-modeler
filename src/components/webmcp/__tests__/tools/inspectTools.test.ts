import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ModelEntriesPage} from '../../project/inspection/modelOutline';
import type {EvaluationResult} from '../../project/inspection/modelEvaluator';
import type {SearchResult} from '../../project/inspection/modelSearch';
import {SOURCE_BATCH_BUDGET, type SourceBatch, type SourcePage} from '../../project/inspection/sourceReader';
import type {TestSuiteView} from '../../project/inspection/testSuiteView';
import {LOAN_TESTS, openToolsFixture} from '../../testing/toolsFixture';

describe('list-model-entries', () => {
    it('lists the entries in Project Explorer order with signature, documentation and test count', async () => {
        const {call, session} = await openToolsFixture();
        session.documentation.setDescription('risk', '\nRisk class by age.\nSecond line');
        expect(await call<ModelEntriesPage>('list-model-entries')).toEqual({
            ok: true,
            total: 4,
            entries: [
                {
                    path: 'risk',
                    section: 'methods',
                    kind: 'function',
                    signature: '(age: number): object',
                    doc: 'Risk class by age.',
                    testCases: 2,
                },
                {path: 'applicant', section: 'variables', kind: 'context'},
                {path: 'decision', section: 'variables', kind: 'variable'},
                {path: 'unused', section: 'variables', kind: 'variable', signature: 'number'},
            ],
        });
    });

    it('filters by section and by context, and pages with offset and limit', async () => {
        const {call, session} = await openToolsFixture();
        session.execute({type: 'commitDsl', source: '{ lib: { func double(x: number): x * 2 \n k: 1 } \n top: 2 }'});
        const methods = await call<ModelEntriesPage>('list-model-entries', {sections: ['methods']});
        expect(methods).toMatchObject({
            ok: true,
            total: 1,
            entries: [{path: 'lib.double', signature: '(x: number): number'}],
        });
        const under = await call<ModelEntriesPage>('list-model-entries', {under: 'lib'});
        if (under.ok) expect(under.entries.map((entry) => entry.path)).toEqual(['lib.double', 'lib']);
        const first = await call<ModelEntriesPage>('list-model-entries', {limit: 1});
        expect(first).toMatchObject({ok: true, total: 3, nextOffset: 1});
        const next = await call<ModelEntriesPage>('list-model-entries', {limit: 2, offset: 1});
        expect(next).toMatchObject({ok: true, total: 3});
        if (next.ok) expect(next.entries).toHaveLength(2);
    });

    it('fits the list budget and continues with nextOffset', async () => {
        const {call, session} = await openToolsFixture();
        const fields = Array.from({length: 60}, (_, index) => `field${index}: ${index}`).join('\n');
        session.execute({type: 'commitDsl', source: `{ ${fields} }`});
        const page = await call<ModelEntriesPage>('list-model-entries');
        if (!page.ok) throw new Error(page.error.message);
        expect(JSON.stringify(page).length).toBeLessThanOrEqual(1_500);
        expect(page.total).toBe(60);
        expect(page.nextOffset).toBe(page.entries.length);
    });

    it('rejects an unknown section, a bad path and an offset past the end', async () => {
        const {call} = await openToolsFixture();
        for (const input of [{sections: ['nope']}, {under: 'a b'}, {limit: 0}, {offset: 99}]) {
            expect(await call('list-model-entries', input)).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
        }
    });
});

describe('read-source', () => {
    it('returns the DSL of an entry with its documentation, the whole model and the README', async () => {
        const {call, session} = await openToolsFixture();
        session.documentation.setDescription('risk', 'Risk class.');
        expect(await call<SourcePage>('read-source', {path: 'risk'})).toEqual({
            ok: true,
            path: 'risk',
            language: 'edgerules',
            text: 'func risk(age: number): {\n    level: if age < 25 then "high" else "low"\n}',
            offset: 0,
            totalChars: 73,
            documentation: 'Risk class.',
        });
        expect(await call('read-source', {path: '*'})).toMatchObject({ok: true, language: 'edgerules'});
        expect(await call('read-source', {path: 'doc:README.md'})).toMatchObject({
            ok: true,
            language: 'markdown',
            text: '# Loans\n',
        });
    });

    it('pages a long text at line breaks and rebuilds it', async () => {
        const {call, session} = await openToolsFixture();
        session.readme.setMarkdown(Array.from({length: 400}, (_, index) => `line ${index} of the readme`).join('\n'));
        let text = '';
        let offset: number | undefined = 0;
        let pages = 0;
        while (offset !== undefined) {
            const page: Awaited<ReturnType<typeof call<SourcePage>>> = await call<SourcePage>('read-source', {
                path: 'doc:README.md',
                offset,
            });
            if (!page.ok) throw new Error(page.error.message);
            expect(page.text.length).toBeLessThanOrEqual(4_000);
            if (page.nextOffset !== undefined) expect(page.text.endsWith('\n')).toBe(true);
            text += page.text;
            offset = page.nextOffset;
            pages += 1;
        }
        expect(pages).toBeGreaterThan(1);
        expect(text).toBe(session.readme.exportDocument());
    });

    it('reads the committed model while a DSL draft is pending', async () => {
        const {call, session} = await openToolsFixture();
        session.setDslDraft('{ draft: 1 }');
        const page = await call<SourcePage>('read-source', {path: 'unused'});
        expect(page).toMatchObject({ok: true, text: '1'});
    });

    it('fails with NotFound for a missing entry and InvalidInput for a bad path or offset', async () => {
        const {call} = await openToolsFixture();
        expect(await call('read-source', {path: 'nope'})).toMatchObject({ok: false, error: {code: 'NotFound'}});
        expect(await call('read-source', {path: 'a:b'})).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
        expect(await call('read-source', {path: 'risk', offset: 500})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
    });
});

describe('read-source with paths', () => {
    it('reads several entries in one call, in order, with their documentation', async () => {
        const {call, session} = await openToolsFixture();
        session.documentation.setDescription('risk', 'Risk class.');
        const result = await call<SourceBatch>('read-source', {paths: ['unused', 'risk', 'doc:README.md']});
        expect(result).toEqual({
            ok: true,
            pages: [
                {path: 'unused', language: 'edgerules', text: '1', offset: 0, totalChars: 1},
                expect.objectContaining({path: 'risk', offset: 0, totalChars: 73, documentation: 'Risk class.'}),
                {path: 'doc:README.md', language: 'markdown', text: '# Loans\n', offset: 0, totalChars: 8},
            ],
        });
    });

    it('shares one budget and continues with next until every text is read', async () => {
        const {call, session} = await openToolsFixture();
        const long = Array.from({length: 1_000}, (_, index) => `line ${index} of the readme`).join('\n');
        session.readme.setMarkdown(long);
        const read: Record<string, string> = {};
        let input: {paths: string[]; offsets?: Record<string, number>} | undefined = {
            paths: ['doc:README.md', 'risk', 'unused'],
        };
        let calls = 0;
        while (input) {
            const result: Awaited<ReturnType<typeof call<SourceBatch>>> = await call<SourceBatch>('read-source', input);
            if (!result.ok) throw new Error(result.error.message);
            const chars = result.pages.reduce((total, page) => total + page.text.length, 0);
            expect(chars).toBeLessThanOrEqual(SOURCE_BATCH_BUDGET);
            for (const page of result.pages) read[page.path] = (read[page.path] ?? '') + page.text;
            input = result.next;
            calls += 1;
        }
        expect(calls).toBeGreaterThan(1);
        expect(read['doc:README.md']).toBe(session.readme.exportDocument());
        expect(read.risk).toBe(session.engine.getCode('risk'));
        expect(read.unused).toBe('1');
    });

    it('reports a path that cannot be read and returns the others', async () => {
        const {call} = await openToolsFixture();
        expect(await call<SourceBatch>('read-source', {paths: ['nope', 'unused']})).toEqual({
            ok: true,
            pages: [{path: 'unused', language: 'edgerules', text: '1', offset: 0, totalChars: 1}],
            errors: [{path: 'nope', code: 'NotFound', message: expect.any(String)}],
        });
    });

    it.each([
        ['both path and paths', {path: 'risk', paths: ['risk']}],
        ['neither path nor paths', {}],
        ['an empty paths', {paths: []}],
        ['a bad path in paths', {paths: ['a:b']}],
        ['offset with paths', {paths: ['risk'], offset: 1}],
        ['offsets with path', {path: 'risk', offsets: {risk: 1}}],
        ['an offset of a path not in paths', {paths: ['risk'], offsets: {unused: 1}}],
        ['a negative offset', {paths: ['risk'], offsets: {risk: -1}}],
    ])('rejects %s', async (_label, input) => {
        const {call} = await openToolsFixture();
        expect(await call('read-source', input)).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
    });
});

describe('search-model', () => {
    it('finds code, names and documentation without regard to case', async () => {
        const {call, session} = await openToolsFixture();
        session.documentation.setDescription('unused', 'An UNUSED value.\nSecond');
        const result = await call<SearchResult>('search-model', {query: 'UNUSED'});
        expect(result).toEqual({
            ok: true,
            truncated: false,
            matches: [
                {path: 'unused', scope: 'names', excerpt: 'unused'},
                {path: 'unused', scope: 'documentation', line: 1, excerpt: 'An UNUSED value.'},
            ],
        });
    });

    it('limits the scope and the number of matches', async () => {
        const {call} = await openToolsFixture();
        const names = await call<SearchResult>('search-model', {query: 'risk', scope: ['names']});
        expect(names).toMatchObject({ok: true, matches: [{path: 'risk', scope: 'names'}]});
        const limited = await call<SearchResult>('search-model', {query: 'age', limit: 1});
        expect(limited).toMatchObject({ok: true, truncated: true});
        if (limited.ok) expect(limited.matches).toHaveLength(1);
    });

    it('returns no match for an absent text and rejects a bad query or scope', async () => {
        const {call} = await openToolsFixture();
        expect(await call('search-model', {query: 'zzz'})).toEqual({ok: true, matches: [], truncated: false});
        for (const input of [{query: ''}, {query: 'x'.repeat(201)}, {query: 'a', scope: ['x']}, {}]) {
            expect(await call('search-model', input)).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
        }
    });
});

describe('list-tests', () => {
    it('returns the cases with raw values and the paths that cases can use', async () => {
        const {call} = await openToolsFixture();
        expect(await call<TestSuiteView>('list-tests', {subject: 'risk'})).toEqual({
            ok: true,
            subject: 'risk',
            paths: [
                {path: 'age', section: 'inputs', type: 'number'},
                {path: 'level', section: 'assertions', type: 'string'},
            ],
            cases: [
                {id: 'young', name: 'Young', inputs: {age: '20'}, assertions: {level: 'high'}},
                {id: 'senior', name: 'Senior', inputs: {age: '60'}, assertions: {level: 'low'}},
            ],
        });
    });

    it('returns derived paths and no cases for a subject without a stored suite', async () => {
        const {call} = await openToolsFixture({tests: {schemaVersion: 1, subjects: {}}});
        const result = await call<TestSuiteView>('list-tests', {subject: 'risk'});
        expect(result).toMatchObject({ok: true, cases: []});
        if (result.ok) expect(result.paths.map((row) => row.path)).toEqual(['age', 'level']);
    });

    it('fails with NotFound for a subject that is not a function and InvalidInput for a bad path', async () => {
        const {call} = await openToolsFixture();
        expect(await call('list-tests', {subject: 'applicant'})).toMatchObject({ok: false, error: {code: 'NotFound'}});
        expect(await call('list-tests', {subject: 'a b'})).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
        expect(LOAN_TESTS.subjects.risk.cases).toHaveLength(2);
    });
});

describe('evaluate-model', () => {
    it('evaluates a function with an input object and the whole model', async () => {
        const {call} = await openToolsFixture();
        expect(await call<EvaluationResult>('evaluate-model', {target: 'risk', input: {age: 20}})).toEqual({
            ok: true,
            result: {level: 'high'},
            truncated: false,
        });
        expect(await call('evaluate-model', {target: '*'})).toMatchObject({ok: true, result: {unused: 1}});
    });

    it('changes nothing in the project', async () => {
        const {call, session} = await openToolsFixture();
        await call('get-project-overview'); // waits for the first regression run
        const before = session.getSnapshot().localVersion;
        await call('evaluate-model', {target: 'risk', input: {age: 20}});
        expect(session.getSnapshot().localVersion).toBe(before);
    });

    it('trims a result longer than 6,000 characters', async () => {
        const {call, session} = await openToolsFixture();
        session.execute({type: 'commitDsl', source: '{ func echo(text: string): text \n x: 1 }'});
        const result = await call<EvaluationResult>('evaluate-model', {
            target: 'echo',
            input: {text: 'a'.repeat(7_000)},
        });
        if (!result.ok) throw new Error(result.error.message);
        expect(result.truncated).toBe(true);
        expect(result.result).toBeTypeOf('string');
        expect((result.result as string).length).toBe(6_000);
    });

    it('fails with NotFound for a missing target and InvalidInput for a bad input', async () => {
        const {call} = await openToolsFixture();
        expect(await call('evaluate-model', {target: 'nope'})).toMatchObject({ok: false, error: {code: 'NotFound'}});
        expect(await call('evaluate-model', {target: 'risk', input: [1]})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
        expect(await call('evaluate-model', {})).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
    });

    it('returns an engine special value as the result', async () => {
        const {call, session} = await openToolsFixture();
        session.execute({type: 'commitDsl', source: '{ func f(x: number): x / 0 }'});
        expect(await call('evaluate-model', {target: 'f', input: {x: 1}})).toMatchObject({
            ok: true,
            result: expect.stringContaining('division by zero'),
        });
    });
});
