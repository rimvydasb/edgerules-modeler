import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({command, mode}) => {
    // `.env` sits at the repo root (Vite's root is app/). Only this one key is read, so no other secret can leak
    // into the bundle; CI passes it as an environment variable instead. Analytics is built in for `vite build`
    // only, so `npm run dev` never sends events.
    const {POSTHOG_PROJECT_TOKEN = ''} = loadEnv(mode, `${import.meta.dirname}/..`, 'POSTHOG_PROJECT_TOKEN');
    return {
        root: import.meta.dirname,
        // The site is served from a sub-path on GitHub Pages (`/edgerules-modeler/`); the deploy workflow sets BASE_PATH.
        base: process.env.BASE_PATH ?? '/',
        build: {outDir: 'dist', emptyOutDir: true},
        server: {port: 5173, open: true},
        define: {__POSTHOG_PROJECT_TOKEN__: JSON.stringify(command === 'build' ? POSTHOG_PROJECT_TOKEN : '')},
        // `@edgerules/web` resolves its wasm binary relative to its own location; pre-bundling would break that.
        optimizeDeps: {exclude: ['@edgerules/web']},
    };
});
