// A Markdown file imported as its text, e.g. the `README.md` of a model (Vite `?raw`).
declare module '*.md?raw' {
    const markdown: string;
    export default markdown;
}
