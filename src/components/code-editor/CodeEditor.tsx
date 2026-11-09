import {useEffect, useRef, type CSSProperties, type ReactElement} from 'react';
import {EditorState} from '@codemirror/state';
import {forceLinting} from '@codemirror/lint';
import {EditorView} from '@codemirror/view';
import {edgeRulesExtensions} from './language/extensions';
import {markdownExtensions} from './markdownExtensions';
import type {CodeEditorService} from './language/service';
import {cx} from '#ui/cx';
import * as classes from './codeEditor.module.css';

export type {CodeEditorDiagnostic, CodeEditorDiagnosticsService, CodeEditorService} from './language/service';

interface CodeEditorBaseProps {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    className?: string;
    style?: CSSProperties;
}

export type CodeEditorProps = CodeEditorBaseProps &
    (
        | {
              language?: 'edgerules'; // the default
              /**
               * EdgeRules language service — the dev builds of `MutableDecisionService` (from
               * `@edgerules/web/mutable` or `@edgerules/node/mutable`) satisfy this directly. Diagnostics
               * power lint markers; `completions` (when present) powers Ctrl+Space suggestions.
               */
              service: CodeEditorService;
          }
        // Markdown source with highlighting; no diagnostics, completion or formatting, so no service.
        | {language: 'markdown'; service?: undefined}
    );

/**
 * A controlled EdgeRules code editor powered by CodeMirror: DSL syntax highlighting,
 * engine-backed diagnostics and completions (Ctrl+Space), Ctrl+Click / F12 go-to-definition,
 * and Shift-Alt-F document formatting. With `language: 'markdown'` it edits Markdown source instead.
 */
export function CodeEditor({
    value,
    onChange,
    language = 'edgerules',
    service,
    readOnly = false,
    className,
    style,
}: CodeEditorProps): ReactElement {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const serviceRef = useRef(service);
    const onChangeRef = useRef(onChange);
    const syncingFromPropRef = useRef(false);

    useEffect(() => {
        serviceRef.current = service;
        if (viewRef.current && language === 'edgerules') {
            forceLinting(viewRef.current);
        }
    }, [service, language]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!hostRef.current) {
            return;
        }

        const view = new EditorView({
            parent: hostRef.current,
            state: EditorState.create({
                doc: value,
                extensions: [
                    EditorView.lineWrapping,
                    EditorView.editable.of(!readOnly),
                    EditorState.readOnly.of(readOnly),
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged || syncingFromPropRef.current) {
                            return;
                        }
                        onChangeRef.current(update.state.doc.toString());
                    }),
                    language === 'markdown'
                        ? markdownExtensions()
                        : edgeRulesExtensions({
                              // The props type requires a service for the EdgeRules language.
                              service: () => serviceRef.current!,
                              variant: 'editor',
                              lintDelay: 0,
                          }),
                ],
            }),
        });

        viewRef.current = view;
        if (language === 'edgerules') forceLinting(view);

        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // The initial doc is intentionally not a dependency; prop updates flow through the effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly, language]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) {
            return;
        }

        const currentValue = view.state.doc.toString();
        if (currentValue === value) {
            return;
        }

        syncingFromPropRef.current = true;
        view.dispatch({
            changes: {from: 0, to: currentValue.length, insert: value},
        });
        syncingFromPropRef.current = false;
    }, [value]);

    return (
        <div className={cx(classes.root, className)} style={style}>
            <div ref={hostRef} className={classes.host} />
        </div>
    );
}
