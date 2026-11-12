import {isPortableError} from '#lib/portable';
import type {ProjectSession} from '../../../project-session';
import {pageOf} from '../../core/textPage';
import {README_PATH} from '../../core/paths';
import {fail, ok, type SourcePath, type ToolError, type ToolResult} from '../../core/toolResult';
import {toToolError} from '../../core/portableErrors';

export const SOURCE_PAGE_SIZE = 4_000;
// The characters of text and documentation that one `read-source` call with `paths` returns, over all its paths.
export const SOURCE_BATCH_BUDGET = 12_000;
// A path is deferred to `next` when less than this is left of the batch budget.
const MIN_BATCH_PAGE = 500;

/** One path with `path` and `offset`, or several with `paths` and `offsets`. */
export interface ReadSourceInput {
    path?: SourcePath;
    offset?: number; // character offset; default 0
    paths?: SourcePath[]; // 1 to 50 paths, read in order within one shared character budget
    offsets?: Record<SourcePath, number>; // the start of each path; default 0
}

export interface SourcePage {
    path: SourcePath;
    language: 'edgerules' | 'markdown';
    text: string; // `engine.getCode(path)` or the README Markdown, from `offset`; at most 4,000 characters
    offset: number;
    totalChars: number;
    nextOffset?: number;
    documentation?: string; // the description of a model path, when one exists
}

export interface SourceReadError {
    path: SourcePath;
    code: ToolError['code'];
    message: string;
}

/** The result of `read-source` with `paths`. */
export interface SourceBatch {
    pages: SourcePage[]; // in input order; a page cut by the budget has `nextOffset`
    errors?: SourceReadError[]; // the paths that could not be read
    next?: {paths: SourcePath[]; offsets: Record<SourcePath, number>}; // the input that reads the rest
}

/** The committed model or the README, in pages. The text is the committed model, also while a DSL draft is pending. */
export function readSource(
    session: ProjectSession,
    input: {path: SourcePath; offset?: number},
    pageSize: number = SOURCE_PAGE_SIZE,
): ToolResult<SourcePage> {
    const {path, offset = 0} = input;
    let full: string;
    let language: SourcePage['language'] = 'edgerules';
    if (path === README_PATH) {
        full = session.readme.exportDocument();
        language = 'markdown';
    } else {
        const code = session.engine.getCode(path);
        if (isPortableError(code)) return {ok: false, error: toToolError(code, {path})};
        full = code;
    }
    if (offset > full.length) {
        return fail('InvalidInput', `'offset' ${offset} is past the end of the text (${full.length} characters).`);
    }
    const page = pageOf(full, offset, pageSize);
    const documentation = path === README_PATH ? undefined : session.documentation.getDescription(path);
    return ok({
        path,
        language,
        text: page.text,
        offset,
        totalChars: full.length,
        ...(page.nextOffset !== undefined && {nextOffset: page.nextOffset}),
        ...(documentation !== undefined && documentation !== '' && {documentation}),
    });
}

/**
 * Several paths in one result. Each path is read from its offset while the shared budget lasts; a path that does not
 * fit, in whole or in part, goes to `next` with the offset to continue from. A path that fails is in `errors`.
 */
export function readSources(
    session: ProjectSession,
    input: {paths: SourcePath[]; offsets?: Record<SourcePath, number>},
): SourceBatch {
    const {offsets = {}} = input;
    let budget = SOURCE_BATCH_BUDGET;
    const pages: SourcePage[] = [];
    const errors: SourceReadError[] = [];
    const rest: SourcePath[] = [];
    const restOffsets: Record<SourcePath, number> = {};
    const defer = (path: SourcePath, offset: number) => {
        rest.push(path);
        restOffsets[path] = offset;
    };

    for (const path of new Set(input.paths)) {
        const offset = offsets[path] ?? 0;
        if (budget < MIN_BATCH_PAGE) {
            defer(path, offset);
            continue;
        }
        const result = readSource(session, {path, offset}, budget);
        if (!result.ok) {
            errors.push({path, code: result.error.code, message: result.error.message});
            continue;
        }
        const {ok: _ok, ...page} = result;
        pages.push(page);
        budget -= page.text.length + (page.documentation?.length ?? 0);
        if (page.nextOffset !== undefined) defer(path, page.nextOffset);
    }

    return {
        pages,
        ...(errors.length > 0 && {errors}),
        ...(rest.length > 0 && {next: {paths: rest, offsets: restOffsets}}),
    };
}
