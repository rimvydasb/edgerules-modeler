import {useMemo, type ComponentPropsWithoutRef, type ReactElement, type ReactNode} from 'react';
import {Typography} from '@mantine/core';
import {renderMarkdownReact, type MarkdownComponents} from '@tanstack/markdown/react';
import {highlightEdgeRules} from '../code-editor/language/highlight';
import {cx} from '#ui/cx';
import {MODEL_SCHEME, parseReadme} from './markdownDocument';
import * as classes from './markdownView.module.css';

export interface MarkdownViewProps {
    markdown: string; // GitHub Flavored Markdown
    resolveUrl?: (relative: string) => string; // rewrites relative image and link URLs
    onModelLink?: (path: string) => void; // called for model: links; without it they render as text
}

function EdgeRulesCode({code}: {code: string}): ReactNode {
    return highlightEdgeRules(code).map((span, index) =>
        span.className ? (
            // eslint-disable-next-line react/no-array-index-key
            <span key={index} className={span.className}>
                {span.text}
            </span>
        ) : (
            span.text
        ),
    );
}

function markdownComponents(onModelLink: ((path: string) => void) | undefined): MarkdownComponents {
    return {
        a({href = '', children, ...props}: ComponentPropsWithoutRef<'a'>) {
            if (href.startsWith(MODEL_SCHEME)) {
                const path = href.slice(MODEL_SCHEME.length);
                if (!onModelLink) return <span>{children}</span>;
                return (
                    <a
                        {...props}
                        href={href}
                        data-model-link={path}
                        onClick={(event) => {
                            event.preventDefault();
                            onModelLink(path);
                        }}
                    >
                        {children}
                    </a>
                );
            }
            const external = href.startsWith('https:');
            return (
                <a {...props} href={href} {...(external && {target: '_blank', rel: 'noopener noreferrer'})}>
                    {children}
                </a>
            );
        },
        code({className, children, ...props}: ComponentPropsWithoutRef<'code'>) {
            const edgeRules = className === 'language-edgerules' && typeof children === 'string';
            return (
                <code {...props} className={cx(className, edgeRules && classes.edgerules)}>
                    {edgeRules ? <EdgeRulesCode code={children} /> : children}
                </code>
            );
        },
    };
}

/**
 * Read-only GitHub Flavored Markdown, such as the README of a project: tables, task lists, fenced code and relative
 * images. Raw HTML is dropped, and only `https`, `mailto`, `model:` and relative URLs are kept. `edgerules` fences are
 * highlighted as in the code editors.
 */
export function MarkdownView({markdown, resolveUrl, onModelLink}: MarkdownViewProps): ReactElement {
    const document = useMemo(() => parseReadme(markdown, resolveUrl), [markdown, resolveUrl]);
    const components = useMemo(() => markdownComponents(onModelLink), [onModelLink]);
    // The document has no raw HTML left; the renderer runs without `allowHtml`, so it never injects HTML.
    return (
        <Typography className={classes.root} data-markdown-view="">
            {renderMarkdownReact(document, {components})}
        </Typography>
    );
}
