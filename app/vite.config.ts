import {defineConfig} from 'vite';

export default defineConfig({
    root: import.meta.dirname,
    server: {port: 5173, open: true},
    // `@edgerules/web` resolves its wasm binary relative to its own location; pre-bundling would break that.
    optimizeDeps: {exclude: ['@edgerules/web']},
});
