import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {syntaxHighlighting} from '@codemirror/language';
import type {Extension} from '@codemirror/state';
import {
    EditorView,
    drawSelection,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from '@codemirror/view';
import {tagHighlighter, tags as t} from '@lezer/highlight';
import {edgeRules, edgeRulesLanguage} from './language/language';

/** Stable `tok-*` classes for Markdown, as `edgeRulesHighlighter` emits for the DSL. */
const markdownHighlighter = tagHighlighter([
    {tag: t.heading, class: 'tok-heading'},
    {tag: t.strong, class: 'tok-strong'},
    {tag: t.emphasis, class: 'tok-emphasis'},
    {tag: t.strikethrough, class: 'tok-strikethrough'},
    {tag: t.link, class: 'tok-link'},
    {tag: t.url, class: 'tok-url'},
    {tag: t.monospace, class: 'tok-monospace'},
    {tag: t.quote, class: 'tok-quote'},
    {tag: [t.processingInstruction, t.contentSeparator, t.labelName], class: 'tok-meta'},
]);

const markdownTheme = EditorView.baseTheme({
    '.tok-heading': {fontWeight: 'bold'},
    '.tok-strong': {fontWeight: 'bold'},
    '.tok-emphasis': {fontStyle: 'italic'},
    '.tok-strikethrough': {textDecoration: 'line-through'},
    '.tok-url': {textDecoration: 'underline'},
    '&light .tok-heading': {color: '#1c4e80'},
    '&light .tok-link, &light .tok-url': {color: '#0070c1'},
    '&light .tok-monospace': {color: '#a31515'},
    '&light .tok-quote': {color: '#6a737d'},
    '&light .tok-meta': {color: '#8a8f98'},
    '&dark .tok-heading': {color: '#82aaff'},
    '&dark .tok-link, &dark .tok-url': {color: '#9cdcfe'},
    '&dark .tok-monospace': {color: '#ce9178'},
    '&dark .tok-quote': {color: '#7f848e'},
    '&dark .tok-meta': {color: '#7f848e'},
});

/**
 * Markdown source editing: GitHub Flavored Markdown highlighting, with `edgerules` fences highlighted as DSL, and
 * the standard editing keys. No diagnostics, completion or formatting.
 */
export function markdownExtensions(): Extension[] {
    return [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        markdown({base: markdownLanguage, codeLanguages: (info) => (info === 'edgerules' ? edgeRulesLanguage : null)}),
        syntaxHighlighting(markdownHighlighter),
        markdownTheme,
        edgeRules().support, // the DSL highlighting and colours of `edgerules` fences
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    ];
}
