import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {createProjectFactory} from '../../project-session';
import {nodeEngine} from '../../project-session/testing/sessionFixture';
import {createLibraryClient, INDEX_MAX_AGE_MS, validateLibraryIndex} from '../createLibraryClient';
import {
    FIXTURE_SOURCE,
    NEWEST_REF,
    OLDEST_REF,
    createFixtureClient,
    createFixtureFetch,
    fixtureIndex,
} from '../testing/fixtureLibrary';

describe('createLibraryClient', () => {
    it('loads and caches the index, and resolves coordinates from it', async () => {
        const client = createFixtureClient();
        expect(client.resolve({id: 'loan-repayment', version: '1.2.0'})).toBeUndefined(); // before loadIndex
        const index = await client.loadIndex();
        expect(index.examples.map((entry) => entry.id)).toContain('loan-repayment');
        expect(await client.loadIndex()).toBe(index);
        expect(client.requests.filter((url) => url === FIXTURE_SOURCE.indexUrl)).toHaveLength(1);

        expect(client.resolve({id: 'loan-repayment', version: '1.3.0'})?.ref).toBe(NEWEST_REF);
        expect(client.resolve({id: 'loan-repayment', version: '1.2.0'})?.ref).toBe(OLDEST_REF);
        expect(client.resolve({id: 'loan-repayment', version: '9.9.9'})).toBeUndefined();
    });

    it('refetches the index after 6 hours and revalidates the browser cache', async () => {
        let time = 0;
        const {fetch: inner, requests} = createFixtureFetch();
        const modes: (RequestCache | undefined)[] = [];
        const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input) === FIXTURE_SOURCE.indexUrl) modes.push(init?.cache);
            return inner(input, init);
        }) as typeof inner;
        const client = createLibraryClient(FIXTURE_SOURCE, {fetch, now: () => time});
        await client.loadIndex();
        time = INDEX_MAX_AGE_MS - 1;
        await client.loadIndex();
        expect(requests.filter((url) => url === FIXTURE_SOURCE.indexUrl)).toHaveLength(1);
        time = INDEX_MAX_AGE_MS;
        await client.loadIndex();
        expect(requests.filter((url) => url === FIXTURE_SOURCE.indexUrl)).toHaveLength(2);
        expect(modes).toEqual(['no-cache', 'no-cache']);
    });

    it('retries after an index failure', async () => {
        let fail = true;
        const {fetch} = createFixtureFetch();
        const client = createLibraryClient(FIXTURE_SOURCE, {
            fetch: (input) => (fail ? Promise.resolve(new Response('', {status: 503})) : fetch(input)),
        });
        await expect(client.loadIndex()).rejects.toThrow('library.json: HTTP 503');
        fail = false;
        expect((await client.loadIndex()).examples.length).toBeGreaterThan(0);
    });

    it('rejects an index with a wrong shape and names the member', () => {
        expect(() => validateLibraryIndex({schemaVersion: 2})).toThrow(/schemaVersion/);
        const index = fixtureIndex();
        expect(() => validateLibraryIndex({...index, examples: [{...index.examples[0], level: 'expert'}]})).toThrow(
            /examples\[0\]\.level/,
        );
    });

    it('skips unreleased versions (no ref) and examples without a released version', () => {
        const index = fixtureIndex();
        const [first] = index.examples;
        const released = first.versions[0];
        const loaded = validateLibraryIndex({
            ...index,
            examples: [
                {...first, versions: [{version: '9.0.0'}, released]},
                {...first, id: 'draft-only', versions: [{version: '1.0.0'}]},
            ],
        });
        expect(loaded.examples.map((entry) => entry.id)).toEqual([first.id]);
        expect(loaded.examples[0].versions).toEqual([released]);
        expect(() => validateLibraryIndex({...index, examples: [{...first, versions: [null]}]})).toThrow(/versions/);
    });

    it('loads the README of a version at its ref', async () => {
        const client = createFixtureClient();
        const index = await client.loadIndex();
        const entry = index.examples.find((candidate) => candidate.id === 'loan-repayment')!;
        expect(await client.loadReadme(entry, '1.2.0')).toContain('#');
        expect(client.requests.at(-1)).toBe(`https://fixture.test/${OLDEST_REF}/${entry.path}/README.md`);
    });

    it('loads all files of a version in parallel into a project with origin and README', async () => {
        const client = createFixtureClient();
        const entry = (await client.loadIndex()).examples.find((candidate) => candidate.id === 'loan-repayment')!;
        const loaded = await client.loadExample(entry, '1.3.0');

        expect(loaded.ref).toBe(NEWEST_REF);
        expect(loaded.project.origin).toEqual({
            library: FIXTURE_SOURCE.indexUrl,
            id: 'loan-repayment',
            version: '1.3.0',
        });
        expect(loaded.project.readme).toContain('#');
        expect(loaded.project.model.version).toBe('1.3.0');
        const bundle = createProjectFactory({engine: nodeEngine}).createBundle(loaded.project);
        expect(bundle.manifest.origin?.version).toBe('1.3.0');
        expect(Object.keys(bundle.tests.subjects).length).toBeGreaterThan(0);
        expect(client.requests.every((url) => url.includes(NEWEST_REF) || url === FIXTURE_SOURCE.indexUrl)).toBe(true);
    });

    it('names the file that failed to load', async () => {
        const client = createFixtureClient();
        const entry = (await client.loadIndex()).examples.find((candidate) => candidate.id === 'client-outreach')!;
        await expect(client.loadExample(entry, '1.0.0')).rejects.toThrow('edgerules.project.json: HTTP 404');
    });
});
