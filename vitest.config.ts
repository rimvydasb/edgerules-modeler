import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {storybookTest} from '@storybook/addon-vitest/vitest-plugin';
import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// `npm test` runs two projects:
// - `unit`: the React Testing Library and model tests, in jsdom.
// - `storybook`: every story of stories/ as a test (it renders, and its play function passes), in a headless Chromium.
export default defineConfig({
    test: {
        projects: [
            {
                resolve: {
                    alias: {'@testing-library/react': fileURLToPath(new URL('./vitest.rtl.tsx', import.meta.url))},
                },
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    globals: false,
                    setupFiles: ['./vitest.setup.ts'],
                    include: ['src/**/*.test.{ts,tsx}', 'models/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
                    // Process CSS Modules (class names kept as written) so class- and style-based assertions are real.
                    css: {include: /\.module\.css$/, modules: {classNameStrategy: 'non-scoped'}},
                },
            },
            {
                plugins: [storybookTest({configDir: path.join(dirname, '.storybook')})],
                test: {
                    name: 'storybook',
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{browser: 'chromium'}],
                    },
                    setupFiles: ['./.storybook/vitest.setup.ts'],
                },
            },
        ],
    },
});
