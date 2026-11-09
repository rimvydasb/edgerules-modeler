import type {ReactElement} from 'react';
import {CodeEditor} from '../../code-editor';
import {MarkdownView} from '../../markdown-view';
import {hasReadme} from '../shell-path';
import * as classes from '../shell.module.css';

export interface DocumentPreviewProps {
    markdown: string;
    onModelLink: (path: string) => void; // a `model:` link opens that model path
}

/**
 * The Preview view of a document root, and the Flow view of a model that has only a README: the rendered Markdown,
 * read-only, without a height limit.
 */
export function DocumentPreview({markdown, onModelLink}: DocumentPreviewProps): ReactElement {
    return (
        <div className={classes.document} data-testid="shell-document-preview">
            <div className={classes.documentPage}>
                {hasReadme(markdown) ? (
                    <MarkdownView markdown={markdown} onModelLink={onModelLink} />
                ) : (
                    <p className={classes.documentEmpty}>This document is empty. Write it in the Code view.</p>
                )}
            </div>
        </div>
    );
}

export interface DocumentCodeProps {
    markdown: string;
    readOnly?: boolean;
    onChange: (markdown: string) => void; // every edit; the session keeps it until a save
}

/** The Code view of a document root: its Markdown source in a `CodeEditor`. */
export function DocumentCode({markdown, readOnly, onChange}: DocumentCodeProps): ReactElement {
    return (
        <CodeEditor
            language="markdown"
            value={markdown}
            onChange={onChange}
            readOnly={readOnly}
            style={{height: '100%'}} // fills the Shell body
        />
    );
}
