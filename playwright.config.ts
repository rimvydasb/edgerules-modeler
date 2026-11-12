import {defineConfig, devices} from '@playwright/test';

const storybookPort = Number(process.env.STORYBOOK_PORT ?? 6006);
const appPort = Number(process.env.APP_PORT ?? 5180);

export default defineConfig({
    testDir: './e2e',
    webServer: [
        {
            command: `npm run storybook:build && npx http-server storybook-static -p ${storybookPort} -s`,
            port: storybookPort,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        // The local Modeler (`npm run dev`) on its own port. It is a development build in `StrictMode`: React mounts,
        // unmounts and mounts every effect again, which the production Storybook build never does.
        {
            command: `npx vite --config app/vite.config.ts --port ${appPort} --strictPort --open false`,
            port: appPort,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
    ],
    use: {
        baseURL: `http://localhost:${storybookPort}`,
    },
    projects: [
        {testIgnore: ['webmcp/**', 'app/**']},
        // WebMCP is behind a Chromium feature flag; `page.webmcp` reads `document.modelContext` of the page.
        {
            name: 'webmcp',
            testMatch: 'webmcp/**',
            use: {...devices['Desktop Chrome'], launchOptions: {args: ['--enable-features=WebMCP']}},
        },
        // The authoring flows of the local Modeler app, in Chromium: Chrome fires `blur` when a focused element is
        // removed, the browser behaviour behind the StrictMode bugs these specs guard against.
        {
            name: 'app',
            testMatch: 'app/**',
            use: {...devices['Desktop Chrome'], baseURL: `http://localhost:${appPort}`},
        },
    ],
});
