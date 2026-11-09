import type {BlockNode, InlineNode, MarkdownDocument, TableCellNode} from '@tanstack/markdown';
import {autolinksExtension} from '@tanstack/markdown/extensions/autolinks';
import {parseMarkdown} from '@tanstack/markdown/parser';

export const MODEL_SCHEME = 'model:';

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
// Characters a browser ignores inside a URL, so `java\tscript:` cannot pass as a relative path.
const IGNORED = /[\u0000-\u001F\u007F\s]+/g;

/**
 * The URL a link or image keeps, or null to render it as text. Keeps `https`, `mailto` and `model` links, `https`
 * images and relative URLs; `resolveUrl` rewrites a relative URL that is not a fragment. A protocol-relative URL
 * (`//host`) points at another host, so it is not relative.
 */
export function transformUrl(
    url: string,
    kind: 'link' | 'image',
    resolveUrl?: (relative: string) => string,
): string | null {
    const trimmed = url.replace(IGNORED, '');
    const scheme = SCHEME.exec(trimmed)?.[1].toLowerCase();
    if (scheme === undefined) {
        if (/^[\\/]{2}/.test(trimmed)) return null;
        if (trimmed === '' || trimmed.startsWith('#') || !resolveUrl) return trimmed;
        return resolveUrl(trimmed);
    }
    if (scheme === 'https') return trimmed;
    if (kind === 'link' && (scheme === 'mailto' || scheme === 'model')) return trimmed;
    return null;
}

function stripInlines(nodes: InlineNode[]): InlineNode[] {
    return nodes.flatMap((node): InlineNode[] => {
        switch (node.type) {
            case 'inlineHtml':
                return [];
            case 'strong':
            case 'emphasis':
            case 'strike':
            case 'link':
            case 'inlineComponent':
                return [{...node, children: stripInlines(node.children)}];
            default:
                return [node];
        }
    });
}

function stripCell(cell: TableCellNode): TableCellNode {
    return {...cell, children: stripInlines(cell.children)};
}

function stripBlocks(nodes: BlockNode[]): BlockNode[] {
    return nodes.flatMap((node): BlockNode[] => {
        switch (node.type) {
            case 'html':
                return [];
            case 'paragraph': {
                const children = stripInlines(node.children);
                // A paragraph of raw HTML only leaves nothing to show.
                return children.length === 0 ? [] : [{...node, children}];
            }
            case 'heading':
                return [{...node, children: stripInlines(node.children)}];
            case 'list':
                return [{...node, items: node.items.map((item) => ({...item, children: stripBlocks(item.children)}))}];
            case 'blockquote':
            case 'callout':
            case 'component':
                return [{...node, children: stripBlocks(node.children)}];
            case 'table':
                return [
                    {...node, header: node.header.map(stripCell), rows: node.rows.map((row) => row.map(stripCell))},
                ];
            case 'footnotes':
                return [{...node, items: node.items.map((item) => ({...item, children: stripBlocks(item.children)}))}];
            default:
                return [node];
        }
    });
}

/**
 * Parses a README into a document with no raw HTML and only allowed URLs. The parser recognizes raw HTML so that it
 * can be dropped: without `allowHtml` it would show as literal text.
 */
export function parseReadme(markdown: string, resolveUrl?: (relative: string) => string): MarkdownDocument {
    const document = parseMarkdown(markdown, {
        allowHtml: true,
        headingIds: false, // the view is part of a larger page; generated ids could collide with its ids
        extensions: [autolinksExtension()],
        urlTransform: (url, kind) => transformUrl(url, kind, resolveUrl),
    });
    return {...document, children: stripBlocks(document.children)};
}
