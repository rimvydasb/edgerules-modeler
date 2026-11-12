import {defineConfig} from 'vite';

export default defineConfig({
    root: import.meta.dirname,
    // The site is served from a sub-path on GitHub Pages (`/edgerules-react/`); the deploy workflow sets BASE_PATH.
    base: process.env.BASE_PATH ?? '/',
    build: {outDir: 'dist', emptyOutDir: true},
    server: {port: 5173, open: true},
    // `@edgerules/web` resolves its wasm binary relative to its own location; pre-bundling would break that.
    optimizeDeps: {exclude: ['@edgerules/web']},
});
