import {isPortableError} from '#lib/portable';
import type {ProjectSession} from '../../../project-session';
import {pageOf} from '../../core/textPage';
import {README_PATH} from '../../core/paths';
import {fail, ok, type SourcePath, type ToolResult} from '../../core/toolResult';
import {toToolError} from '../../core/portableErrors';

export const SOURCE_PAGE_SIZE = 4_000;

export interface ReadSourceInput {
    path: SourcePath;
    offset?: number; // character offset; default 0
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

/** The committed model or the README, in pages. The text is the committed model, also while a DSL draft is pending. */
export function readSource(session: ProjectSession, input: ReadSourceInput): ToolResult<SourcePage> {
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
    const page = pageOf(full, offset, SOURCE_PAGE_SIZE);
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
