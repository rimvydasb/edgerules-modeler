import {createServer, type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {test, expect} from '@playwright/test';

// The published `library.json` once reached users with `Cache-Control: max-age=604800` (jsDelivr, 7 days). A browser that
// had cached a broken index kept it after the fix. The library client reads the index with `cache: 'no-cache'`; this test
// proves in a real Chromium, against a server that sends the same 7-day header, that such a read sees a new index while
// a plain read keeps the stale one.

let server: Server;
let origin = '';
let version = 1;

test.beforeAll(async () => {
    server = createServer((request, response) => {
        if (request.url === '/library.json') {
            const body = JSON.stringify({version});
            // A strong validator, as a CDN sends: `no-cache` revalidates with it and gets the new body.
            const etag = `"v${version}"`;
            if (request.headers['if-none-match'] === etag) {
                response.writeHead(304, {etag, 'cache-control': 'public, max-age=604800'}).end();
                return;
            }
            response
                .writeHead(200, {
                    'content-type': 'application/json',
                    'cache-control': 'public, max-age=604800',
                    'access-control-allow-origin': '*',
                    etag,
                })
                .end(body);
            return;
        }
        response.writeHead(200, {'content-type': 'text/html'}).end('<!doctype html><title>x</title>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('a no-cache read sees a new index while a plain read keeps a 7-day cached one', async ({page}) => {
    version = 1;
    await page.goto(`${origin}/`);
    const read = (init?: RequestInit) =>
        page.evaluate(
            async ([url, options]) => (await (await fetch(url as string, options as RequestInit)).json()).version,
            [`${origin}/library.json`, init] as const,
        );

    expect(await read(), 'first read').toBe(1);
    version = 2; // the index is republished
    expect(await read(), 'a plain read is served from the 7-day browser cache').toBe(1);
    expect(await read({cache: 'no-cache'}), 'a no-cache read revalidates').toBe(2);
});
