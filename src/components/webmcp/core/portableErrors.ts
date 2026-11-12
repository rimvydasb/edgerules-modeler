import type {PortableError} from '@edgerules/portable';
import {isPortableError} from '#lib/portable';
import {clipText, fail, messageOf, type ModelDiagnostic, type ToolError, type ToolErrorCode} from './toolResult';

export const MAX_EXCERPT = 120;

// The engine codes inside a message: `linker error: E102: unresolved reference 'zz'` and
// `parse error: Parse errors: MissingExpression at 9, UnclosedDelimiter at 10`.
const LINKER_CODE = /\b(E\d{2,4}):/;
const PARSER_CODE = /Parse errors?: ([A-Z][A-Za-z]+)/;
// `execute` and `link` report a model that does not link as an `Execution` error with this text.
const LINKER_MESSAGE = /\blinker error\b/;

/**
 * Where the error happened. The engine reports a linking failure with the type `Execution`, so the caller says
 * whether the failed call linked (`link`: after a write) or evaluated (`execute`).
 */
export type EnginePhase = 'link' | 'execute';

/** The `ToolErrorCode` of a `PortableError`. */
export function toolErrorCodeOf(error: PortableError, phase: EnginePhase = 'execute'): ToolErrorCode {
    switch (error.type) {
        case 'EntryNotFound':
            return 'NotFound';
        case 'DuplicateName':
            return 'DuplicateName';
        case 'Parse':
            return 'ParseError';
        case 'Execution':
            return phase === 'link' || LINKER_MESSAGE.test(error.message) ? 'LinkError' : 'ExecutionError';
        case 'WrongFieldPath':
            return 'InvalidInput';
        default:
            return 'InternalError';
    }
}

/** The first engine code in `message`, for example `E102` or `MissingExpression`. */
export function engineCodeOf(message: string): string | undefined {
    return LINKER_CODE.exec(message)?.[1] ?? PARSER_CODE.exec(message)?.[1];
}

/** Line `line` (1-based) of `source`, clipped to 120 characters; `undefined` when the line does not exist. */
export function excerptOf(source: string | undefined, line: number | undefined): string | undefined {
    if (source === undefined) return undefined;
    const lines = source.split('\n');
    const index = (line ?? 1) - 1;
    if (index < 0 || index >= lines.length) return undefined;
    const text = lines[index].trim();
    return text === '' ? undefined : clipText(text, MAX_EXCERPT);
}

/**
 * The diagnostic of a parse or link `PortableError`. `source` is the code the error is about when the caller has
 * it; otherwise the excerpt comes from the expression the engine echoes back.
 */
export function toModelDiagnostic(
    error: PortableError,
    options: {source?: string; path?: string} = {},
): ModelDiagnostic {
    const location = error.location;
    const diagnostic: ModelDiagnostic = {
        source: error.type === 'Parse' ? 'parser' : 'linker',
        message: clipText(error.message, 300),
    };
    const code = engineCodeOf(error.message);
    if (code !== undefined) diagnostic.code = code;
    const path = error.path ?? options.path;
    if (path !== undefined) diagnostic.path = path;
    if (location?.line !== undefined) diagnostic.line = location.line;
    if (location?.column !== undefined) diagnostic.column = location.column;
    const excerpt = excerptOf(options.source ?? location?.expression, location?.line);
    if (excerpt !== undefined) diagnostic.excerpt = excerpt;
    return diagnostic;
}

/**
 * The `ToolError` of a value that an engine call returned or threw. A `PortableError` keeps its path; a parse or link
 * error also carries one diagnostic. Any other thrown value is an `InternalError`.
 */
export function toToolError(
    thrown: unknown,
    options: {phase?: EnginePhase; source?: string; path?: string} = {},
): ToolError {
    if (!isPortableError(thrown)) return fail('InternalError', messageOf(thrown)).error;
    const code = toolErrorCodeOf(thrown, options.phase);
    const path = thrown.path ?? options.path;
    const diagnostics =
        code === 'ParseError' || code === 'LinkError'
            ? [toModelDiagnostic(thrown, {source: options.source, path})]
            : undefined;
    return fail(code, thrown.message, {
        ...(path !== undefined && {path}),
        ...(diagnostics && {diagnostics}),
    }).error;
}
