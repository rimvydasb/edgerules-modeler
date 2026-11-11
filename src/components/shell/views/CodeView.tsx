import {Alert, Button, Group} from '@mantine/core';
import {useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactElement} from 'react';
import {isPortableError} from '#lib/portable';
import {CodeEditor, type CodeEditorService} from '../../code-editor';
import {useProjectSession, useProjectSlice, type ProjectSession} from '../../project-session';
import {codeEmbedContext, modelScopedService} from './codeViewLanguage';
import * as classes from '../shell.module.css';

// The Code view commits after this much time without an edit.
export const COMMIT_DELAY_MS = 500;

/** Uncommitted text of a root path, and the committed code it was typed over. */
export interface CodeDraft {
    text: string;
    base: string; // `baseCode`: the committed code when the view loaded or last committed its text
}

export interface CodeViewProps {
    root: string;
    languageService: CodeEditorService;
    readOnly?: boolean;
    // Uncommitted code by root path, kept across views and paths. The session also keeps the text of '*'.
    drafts: Map<string, CodeDraft>;
    onCommitError: (root: string, message: string | undefined) => void; // context and function paths only
    flushRef: MutableRefObject<(() => void) | undefined>; // the Shell commits a pending edit before it navigates
}

/**
 * The text of the Code view:
 * - `synced`: the text is the committed code; a model change reloads it.
 * - `editing`: the user typed; the commit delay or a navigation commits it.
 * - `conflict`: the committed code changed while the user typed; nothing commits until the user picks an action.
 */
type CodeViewState = 'synced' | 'editing' | 'conflict';

/** The committed code of the root path: the whole model for '*', otherwise the code of the entry. */
function committedCode(session: ProjectSession, root: string): string {
    if (root === '*') return session.getSlice('model').dsl;
    const code = session.engine.getCode(root);
    return isPortableError(code) ? '' : code;
}

// Writes the code of a context or function path. `setCode` does not link, so a model that no longer links rolls
// back with the transaction.
function commitPath(session: ProjectSession, root: string, code: string): string | undefined {
    const result = session.transaction(() => {
        const written = session.engine.setCode(root, code);
        if (isPortableError(written)) throw new Error(written.message);
        session.engine.link();
    });
    return result.ok ? undefined : result.error.message;
}

/**
 * The DSL code of the root path in a `CodeEditor`, committed after an idle time and before the Shell navigates. A
 * change of the committed code while the user types (an agent write, for example) is a conflict: the view keeps the
 * text, does not commit it, and lets the user load the latest code or keep the text.
 */
export function CodeView({
    root,
    languageService,
    readOnly,
    drafts,
    onCommitError,
    flushRef,
}: CodeViewProps): ReactElement {
    const session = useProjectSession();
    const {dsl} = useProjectSlice('model');
    // The code of an entity is analyzed inside the committed model, so references to the rest of the model resolve.
    const service = useMemo(() => {
        const context = codeEmbedContext(dsl, root, committedCode(session, root));
        return context ? modelScopedService(languageService, context) : languageService;
    }, [dsl, root, session, languageService]);

    // The kept draft of the root path, or the session draft of '*' (an invalid commit leaves one there).
    const initial = useMemo(() => {
        const committed = committedCode(session, root);
        const kept = drafts.get(root);
        const text = kept?.text ?? (root === '*' ? session.getDslDraft() : committed);
        const base = kept?.base ?? committed;
        const state: CodeViewState = base !== committed ? 'conflict' : text !== committed ? 'editing' : 'synced';
        return {text, base, state};
        // Read once: later changes go through the effects below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [text, setText] = useState(initial.text);
    const [state, setState] = useState<CodeViewState>(initial.state);
    const base = useRef(initial.base);
    const stateRef = useRef(state);
    stateRef.current = state;
    const pending = useRef<string | undefined>(undefined);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const remember = (code: string) => {
        drafts.set(root, {text: code, base: base.current});
        if (root === '*') session.setDslDraft(code);
    };

    const forget = () => {
        drafts.delete(root);
        if (root === '*') session.discardDslDraft();
    };

    // Writes `code` over the committed code. Returns false when the commit failed and the text stays a draft.
    const write = (code: string): boolean => {
        if (root === '*') {
            // The session keeps an invalid draft and reports it in its snapshot.
            const result = session.execute({type: 'commitDsl', source: code});
            if (!result.ok) return false;
            base.current = committedCode(session, root);
            drafts.delete(root);
            return true;
        }
        const message = code === committedCode(session, root) ? undefined : commitPath(session, root, code);
        onCommitError(root, message);
        if (message !== undefined) return false;
        base.current = committedCode(session, root);
        drafts.delete(root);
        return true;
    };

    // The latest props, so the timer and the unmount commit never use stale ones.
    const commit = useRef(() => {});
    commit.current = () => {
        clearTimeout(timer.current);
        timer.current = undefined;
        const code = pending.current;
        if (code === undefined || stateRef.current === 'conflict') return;
        pending.current = undefined;
        if (committedCode(session, root) !== base.current) {
            // The model changed while the user typed: the text stays in `drafts` and nothing commits.
            stateRef.current = 'conflict';
            setState('conflict');
            return;
        }
        const next: CodeViewState = write(code) ? 'synced' : 'editing';
        stateRef.current = next;
        setState(next);
    };

    useEffect(() => {
        const flush = () => commit.current();
        flushRef.current = flush;
        return () => {
            // Leaving the view or the path commits what is pending, unless it is a conflict.
            flush();
            if (flushRef.current === flush) flushRef.current = undefined;
        };
    }, [flushRef]);

    // A model change reloads the text of a synced view. Its own commit already moved `base`, so it reloads nothing.
    useEffect(() => {
        if (stateRef.current !== 'synced') return;
        const committed = committedCode(session, root);
        if (committed === base.current) return;
        base.current = committed;
        setText(committed);
    }, [dsl, session, root]);

    const onChange = (code: string) => {
        setText(code);
        remember(code);
        if (stateRef.current === 'conflict') return; // no commit until the user picks an action
        pending.current = code;
        stateRef.current = 'editing';
        setState('editing');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => commit.current(), COMMIT_DELAY_MS);
    };

    // "Load latest": drop the text and show the committed code.
    const loadLatest = () => {
        const committed = committedCode(session, root);
        base.current = committed;
        forget();
        onCommitError(root, undefined);
        setText(committed);
        stateRef.current = 'synced';
        setState('synced');
    };

    // "Keep my text": commit the text over the change.
    const keepText = () => {
        pending.current = undefined;
        const next: CodeViewState = write(text) ? 'synced' : 'editing';
        if (next === 'editing') base.current = committedCode(session, root);
        stateRef.current = next;
        setState(next);
    };

    return (
        <div className={classes.codeView}>
            {state === 'conflict' && (
                <Alert
                    className={classes.codeConflict}
                    color="yellow"
                    variant="light"
                    data-testid="code-conflict"
                    title="The model changed while you edited."
                >
                    <Group gap="xs">
                        <Button size="compact-xs" variant="light" onClick={loadLatest}>
                            Load latest
                        </Button>
                        <Button size="compact-xs" variant="subtle" onClick={keepText}>
                            Keep my text
                        </Button>
                    </Group>
                </Alert>
            )}
            <CodeEditor
                value={text}
                onChange={onChange}
                service={service}
                readOnly={readOnly}
                style={{flex: 1, minHeight: 0}} // fills the Shell body
            />
        </div>
    );
}
