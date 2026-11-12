import {isPortableError} from '#lib/portable';
import {fieldsOf} from '#lib/portableUtils';
import type {ProjectSession} from '../../../project-session';
import {LIMITS, LIST_OUTPUT_BUDGET} from '../../core/limits';
import type {ModelPath} from '../../core/paths';
import {clipText, ok, type ToolResult} from '../../core/toolResult';
import {toToolError} from '../../core/portableErrors';
import {fitOutput} from '../../core/outputBudget';
import {buildOutline} from './modelOutline';

export type SearchScope = 'code' | 'names' | 'documentation';

export const SEARCH_SCOPES: readonly SearchScope[] = ['code', 'names', 'documentation'];

export interface SearchModelInput {
    query: string;
    scope?: SearchScope[]; // default: all three
    limit?: number;
}

export interface SearchMatch {
    path: ModelPath;
    scope: SearchScope;
    line?: number;
    excerpt: string;
}

export interface SearchResult {
    matches: SearchMatch[];
    truncated: boolean; // more matches exist than `limit`, or than fit the output budget
}

const MAX_EXCERPT = 120;

function linesMatching(text: string, needle: string): {line: number; excerpt: string}[] {
    const found: {line: number; excerpt: string}[] = [];
    text.split('\n').forEach((line, index) => {
        if (line.toLowerCase().includes(needle))
            found.push({line: index + 1, excerpt: clipText(line.trim(), MAX_EXCERPT)});
    });
    return found;
}

/** Case-insensitive text search over the `getCode` text of each top-level declaration, the entry names and the docs. */
export function searchModel(session: ProjectSession, input: SearchModelInput): ToolResult<SearchResult> {
    const {query, scope = SEARCH_SCOPES, limit = LIMITS.listLimitDefault} = input;
    const needle = query.toLowerCase();
    const matches: SearchMatch[] = [];

    if (scope.includes('code')) {
        const model = session.engine.get('*');
        if (isPortableError(model)) return {ok: false, error: toToolError(model)};
        for (const name of Object.keys(fieldsOf(model) ?? {})) {
            const code = session.engine.getCode(name);
            if (typeof code !== 'string') continue;
            for (const {line, excerpt} of linesMatching(code, needle)) {
                matches.push({path: name, scope: 'code', line, excerpt});
            }
        }
    }
    if (scope.includes('names')) {
        const outline = buildOutline(session);
        if (!Array.isArray(outline)) return {ok: false, error: outline};
        for (const entry of outline) {
            if (entry.path.toLowerCase().includes(needle)) {
                matches.push({path: entry.path, scope: 'names', excerpt: entry.path});
            }
        }
    }
    if (scope.includes('documentation')) {
        for (const [path, text] of Object.entries(session.documentation.exportDocument().byPath)) {
            for (const {line, excerpt} of linesMatching(text, needle)) {
                matches.push({path, scope: 'documentation', line, excerpt});
            }
        }
    }

    const limited = matches.slice(0, limit);
    const fitted = fitOutput(
        limited,
        (current) => (current.length > 1 ? current.slice(0, -1) : undefined),
        LIST_OUTPUT_BUDGET,
    );
    return ok({matches: fitted.value, truncated: matches.length > fitted.value.length});
}
