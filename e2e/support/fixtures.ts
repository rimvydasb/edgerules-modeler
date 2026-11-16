import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {test as base, expect, type BrowserContext, type Route} from '@playwright/test';

/**
 * The `test` of every e2e spec. Each test is a first visit of a new user to the app at http://localhost:5173:
 *
 * - A new browser context per test: no cookies, an empty HTTP cache, no localStorage, sessionStorage or IndexedDB
 *   database, and no service worker. `first-visit.spec.ts` asserts it.
 * - No analytics and no other third party: a request to any host but the app and the published example library is
 *   aborted, and the test fails when the app sends one.
 * - The published example library (`rimvydasb/edgerules-examples`) is real data, read from the network once and then
 *   served from a cache of the test runner (node_modules/.cache/e2e-example-library). The files of a version are pinned
 *   to a commit and never change; the index is read again every 10 minutes. This keeps the tests quick and keeps a slow
 *   CDN from failing them. The browser still sees a cold HTTP cache: the cache is in the test runner, not the browser.
 */

// The hosts the app may contact: itself, and the index and the files of the published example library.
const LIBRARY = [
    /^https:\/\/raw\.githubusercontent\.com\/rimvydasb\/edgerules-examples\//,
    /^https:\/\/cdn\.jsdelivr\.net\/gh\/rimvydasb\/edgerules-examples@/,
];
const APP_HOSTS = new Set(['localhost', '127.0.0.1']);

interface CachedResponse {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
}

interface Fixtures {
    /** Every request that left for a host that is not allowed: analytics, fonts, trackers. */
    blockedRequests: string[];
}

interface WorkerFixtures {
    libraryCache: Map<string, Promise<CachedResponse>>;
}

// Shared by every worker and every run. A file of a version is pinned to a commit (`@<sha>`) and kept for good; the
// index of the library (`main`) is read again after INDEX_TTL_MS.
const CACHE_DIR = path.join(import.meta.dirname, '..', '..', 'node_modules', '.cache', 'e2e-example-library');
const INDEX_TTL_MS = 10 * 60_000;
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function cacheFile(url: string): string {
    return path.join(CACHE_DIR, createHash('sha1').update(url).digest('hex'));
}

async function readCache(url: string): Promise<CachedResponse | undefined> {
    const file = cacheFile(url);
    try {
        const pinned = /@[0-9a-f]{40}\//.test(url);
        if (!pinned && Date.now() - (await stat(file)).mtimeMs > INDEX_TTL_MS) return undefined;
        const meta = JSON.parse(await readFile(`${file}.json`, 'utf8')) as Omit<CachedResponse, 'body'>;
        return {...meta, body: await readFile(file)};
    } catch {
        return undefined;
    }
}

async function writeCache(url: string, response: CachedResponse): Promise<void> {
    const file = cacheFile(url);
    await mkdir(CACHE_DIR, {recursive: true});
    // Written next to it, then renamed: a worker never reads half a file.
    const temporary = `${file}.${process.pid}.${Date.now()}`;
    await writeFile(`${temporary}.json`, JSON.stringify({status: response.status, headers: response.headers}));
    await writeFile(temporary, response.body);
    await rename(`${temporary}.json`, `${file}.json`);
    await rename(temporary, file);
}

async function fetchLibraryFile(route: Route): Promise<CachedResponse> {
    const url = route.request().url();
    const cached = await readCache(url);
    if (cached) return cached;
    let failure: unknown;
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
        try {
            const response = await route.fetch({timeout: FETCH_TIMEOUT_MS});
            const fetched = {status: response.status(), headers: response.headers(), body: await response.body()};
            if (fetched.status >= 500) throw new Error(`${url}: HTTP ${fetched.status}`);
            if (fetched.status === 200) await writeCache(url, fetched);
            return fetched;
        } catch (error) {
            failure = error;
        }
    }
    throw failure;
}

async function serveLibraryFile(route: Route, cache: Map<string, Promise<CachedResponse>>): Promise<void> {
    const url = route.request().url();
    let pending = cache.get(url);
    if (!pending) {
        pending = fetchLibraryFile(route);
        cache.set(url, pending);
        // A failed read is not kept: the next test reads the file again.
        pending.catch(() => cache.delete(url));
    }
    try {
        const response = await pending;
        await route.fulfill({status: response.status, headers: response.headers, body: response.body});
    } catch {
        await route.abort('failed');
    }
}

async function guardNetwork(
    context: BrowserContext,
    cache: Map<string, Promise<CachedResponse>>,
    blocked: string[],
): Promise<void> {
    await context.route(
        (url) => !APP_HOSTS.has(url.hostname),
        async (route) => {
            const url = route.request().url();
            if (LIBRARY.some((pattern) => pattern.test(url))) return serveLibraryFile(route, cache);
            blocked.push(url);
            await route.abort('blockedbyclient');
        },
    );
}

export const test = base.extend<Fixtures, WorkerFixtures>({
    libraryCache: [async ({}, use) => use(new Map()), {scope: 'worker'}],
    blockedRequests: [
        async ({context, libraryCache}, use) => {
            const blocked: string[] = [];
            await guardNetwork(context, libraryCache, blocked);
            await use(blocked);
            expect(blocked, 'the app must not contact analytics or any other third party').toEqual([]);
        },
        {auto: true},
    ],
});

export {expect};
export type {Locator, Page} from '@playwright/test';
