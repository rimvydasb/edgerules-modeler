import {defineConfig, devices} from '@playwright/test';

// The e2e tests drive the Modeler app only, as a user does: http://localhost:5173 (`npm run dev`). Storybook has its
// own tests (the play functions of the stories); no spec here opens a story.
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const appPort = Number(new URL(APP_URL).port || 80);

export default defineConfig({
    testDir: './e2e',
    // Every test has its own browser context and its own projects (see e2e/support/fixtures.ts): the tests of one file
    // run on idle workers too. One dev server serves every worker.
    fullyParallel: true,
    workers: process.env.CI ? 2 : '70%',
    retries: process.env.CI ? 1 : 0,
    // The engine (WASM) loads and the example library is read before most pages show; on busy cores that takes longer
    // than the 5 s default.
    expect: {timeout: 15_000},
    timeout: 60_000,
    reporter: process.env.CI ? 'github' : 'list',
    // The local Modeler. A running `npm run dev` is used as is; otherwise this starts one on the same port. It is a
    // development build in `StrictMode`: React mounts, unmounts and mounts every effect again.
    // Every test is a first visit with a cold HTTP cache, so every test downloads the whole development bundle (one
    // module of it is 15 MB with its source map): the server gets a larger heap than the Node default.
    webServer: {
        command: `npx vite --config app/vite.config.ts --port ${appPort} --strictPort --open false`,
        url: APP_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {NODE_OPTIONS: '--max-old-space-size=8192'},
    },
    use: {
        ...devices['Desktop Chrome'],
        baseURL: APP_URL,
        // A first visit: no stored state and no service worker that could serve a cached page.
        storageState: undefined,
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
    },
    projects: [
        {name: 'app', testIgnore: ['webmcp/**']},
        // WebMCP is behind a Chromium feature flag; `document.modelContext` of the page exists only with it.
        {
            name: 'webmcp',
            testMatch: 'webmcp/**',
            use: {launchOptions: {args: ['--enable-features=WebMCP']}},
        },
    ],
});
