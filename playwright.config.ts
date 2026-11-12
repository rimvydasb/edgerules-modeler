import {defineConfig, devices} from '@playwright/test';

const storybookPort = Number(process.env.STORYBOOK_PORT ?? 6006);

export default defineConfig({
    testDir: './e2e',
    webServer: {
        command: `npm run storybook:build && npx http-server storybook-static -p ${storybookPort} -s`,
        port: storybookPort,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    use: {
        baseURL: `http://localhost:${storybookPort}`,
    },
    projects: [
        {testIgnore: 'webmcp/**'},
        // WebMCP is behind a Chromium feature flag; `page.webmcp` reads `document.modelContext` of the page.
        {
            name: 'webmcp',
            testMatch: 'webmcp/**',
            use: {...devices['Desktop Chrome'], launchOptions: {args: ['--enable-features=WebMCP']}},
        },
    ],
});
