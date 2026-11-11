// The transport-neutral result envelope of every tool. No WebMCP and no `ProjectSession` type is known here.

/** A model path, or the document path 'doc:README.md'. A model path never contains ':'. */
export type SourcePath = string;

export type ToolErrorCode =
    | 'InvalidInput' // the input fails validation; `message` names the member
    | 'NotFound' // the path, the test subject or the test case does not exist
    | 'VersionConflict' // the project changed after `baseVersion`
    | 'ParseError' // the DSL does not parse
    | 'LinkError' // the model does not link after the change
    | 'DuplicateName' // a set or rename collides with an existing entry
    | 'ExecutionError' // the engine failed to evaluate
    | 'SolverRequired' // the target calls an external function that has no resolver
    | 'UndoBlocked' // a target of the agent change changed later; `conflicts` names the targets
    | 'SaveConflict' // the repository has a newer revision
    | 'Aborted' // the agent aborted the call before its commit point
    | 'InternalError'; // an unexpected exception; the registry catches it, so `execute` never rejects

export interface ModelDiagnostic {
    source: 'parser' | 'linker';
    code?: string; // the engine code, for example `E101` or `UnexpectedToken`
    message: string;
    path?: string; // the entry that holds the problem
    line?: number; // 1-based, in the code of `path`
    column?: number; // 1-based
    excerpt?: string; // the source line, at most 120 characters
}

export interface ToolError {
    code: ToolErrorCode; // the discriminant the agent switches on
    message: string; // one sentence, at most 300 characters
    path?: string; // the model path the error is about
    operation?: number; // the index of the failed operation in a batch
    diagnostics?: ModelDiagnostic[]; // parse and link problems, at most 20
    currentVersion?: number; // with `VersionConflict`
    conflicts?: SourcePath[]; // with `UndoBlocked`: the targets that changed after the agent change
    hint?: string; // the next useful step, for example "Call list-tests to see the input paths"
}

export type ToolResult<T> = ({ok: true} & T) | {ok: false; error: ToolError};

export const MAX_ERROR_MESSAGE = 300;
export const MAX_DIAGNOSTICS = 20;

/** Cuts `text` to `max` characters, ending with '…' when it was longer. */
export function clipText(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function ok<T extends object>(value: T): ToolResult<T> {
    return {ok: true, ...value};
}

/** The error envelope. `message` is clipped to 300 characters and `diagnostics` to 20 entries. */
export function fail(
    code: ToolErrorCode,
    message: string,
    details: Omit<ToolError, 'code' | 'message'> = {},
): {
    ok: false;
    error: ToolError;
} {
    const error: ToolError = {code, message: clipText(message, MAX_ERROR_MESSAGE), ...details};
    if (error.diagnostics && error.diagnostics.length > MAX_DIAGNOSTICS) {
        error.diagnostics = error.diagnostics.slice(0, MAX_DIAGNOSTICS);
    }
    return {ok: false, error};
}

/** The message of any thrown value. */
export function messageOf(thrown: unknown): string {
    if (thrown instanceof Error) return thrown.message;
    if (typeof thrown === 'object' && thrown !== null && 'message' in thrown) return String(thrown.message);
    return String(thrown);
}

/** True for the `AbortError` that `AbortSignal.throwIfAborted` and aborted fetches throw. */
export function isAbortError(thrown: unknown): boolean {
    return typeof thrown === 'object' && thrown !== null && (thrown as {name?: unknown}).name === 'AbortError';
}
