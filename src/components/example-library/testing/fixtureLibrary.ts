import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createLibraryClient} from '../createLibraryClient';
import type {LibraryClient, LibraryIndex, LibrarySource} from '../types';

// A snapshot of the published `library.json` of rimvydasb/edgerules-examples and the files of two examples. The
// example `loan-repayment` has a second, newer version (1.3.0). Tests read it offline.
const FIXTURE = join(__dirname, 'fixture');

export const FIXTURE_SOURCE: LibrarySource = {
    indexUrl: 'https://fixture.test/library.json',
    fileBaseUrl: (ref) => `https://fixture.test/${ref}/`,
};

export const NEWEST_REF = '0123456789abcdef0123456789abcdef01234567';
export const OLDEST_REF = 'b1c7ed0e99e4620d7d6250be9b39901b4b3b82a3';

export function fixtureIndex(): LibraryIndex {
    return JSON.parse(readFileSync(join(FIXTURE, 'library.json'), 'utf8')) as LibraryIndex;
}

/** A `fetch` that serves the fixture; an unknown URL is a 404. `requests` records every URL. */
export function createFixtureFetch(index: LibraryIndex = fixtureIndex()) {
    const requests: string[] = [];
    const fixtureFetch = (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        requests.push(url);
        const respond = (body: string) => Promise.resolve(new Response(body, {status: 200}));
        if (url === FIXTURE_SOURCE.indexUrl) return respond(JSON.stringify(index));
        const prefix = 'https://fixture.test/';
        if (url.startsWith(prefix)) {
            try {
                return respond(readFileSync(join(FIXTURE, 'files', url.slice(prefix.length)), 'utf8'));
            } catch {
                // fall through to 404
            }
        }
        return Promise.resolve(new Response('not found', {status: 404}));
    };
    return {fetch: fixtureFetch as typeof fetch, requests};
}

export function createFixtureClient(index?: LibraryIndex): LibraryClient & {requests: string[]} {
    const {fetch, requests} = createFixtureFetch(index);
    return Object.assign(createLibraryClient(FIXTURE_SOURCE, {fetch}), {requests});
}
