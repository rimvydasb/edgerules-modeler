import type {Kind, PortableContext} from '@edgerules/portable';
import {isPortableError} from '#lib/portable';
import {callableParameters, isRecord, portableAtPath, typeText} from '#lib/portableUtils';
import type {ProjectSession} from '../../../project-session';
import {buildSections, type ExplorerEntryKind, type ExplorerSection} from '../../../project-explorer/internal';
import {LIMITS, LIST_OUTPUT_BUDGET} from '../../core/limits';
import type {ModelPath, ModelSection} from '../../core/paths';
import {fitOutput} from '../../core/outputBudget';
import {clipText, fail, ok, type ToolResult} from '../../core/toolResult';
import {toToolError} from '../../core/portableErrors';

export const MODEL_SECTIONS: readonly ModelSection[] = [
    'types',
    'factsLibrary',
    'methods',
    'decisions',
    'services',
    'variables',
    'workbooks',
];

// The interface view of the model: signatures and types, without bodies.
const INTERFACE_KINDS: readonly Kind[] = [
    'context',
    'expression-interface',
    'type',
    'facts',
    'workbook',
    'method-interface',
    'ruleset-interface',
    'decision-interface',
    'service-interface',
    'loop-interface',
    'optimise-interface',
];

export const MAX_DOC_LINE = 120;

export interface ListModelEntriesInput {
    sections?: ModelSection[]; // default: every section
    under?: ModelPath; // only entries at or below this context; default '*'
    offset?: number; // from `nextOffset` of the previous page
    limit?: number;
}

export interface OutlineEntry {
    path: ModelPath;
    section: ModelSection;
    kind: ExplorerEntryKind; // the Project Explorer kind, for example 'function' or 'ruleset'
    signature?: string; // a callable: '(amount: number, rate: number): number'; a field or type: its type
    doc?: string; // the first line of the documentation, at most 120 characters
    testCases?: number; // only when the entry is a test subject with cases
}

export interface ModelEntriesPage {
    entries: OutlineEntry[]; // in Project Explorer order: section, then name
    total: number;
    nextOffset?: number; // present when more entries exist
}

/** The first non-empty line of `text`, at most 120 characters. */
export function firstLine(text: string | undefined): string | undefined {
    const line = text?.split('\n').find((candidate) => candidate.trim() !== '');
    return line === undefined ? undefined : clipText(line.trim(), MAX_DOC_LINE);
}

function signatureOf(node: unknown): string | undefined {
    if (!isRecord(node)) return undefined;
    const kind = node['@kind'];
    if (typeof kind === 'string' && kind.endsWith('-interface') && kind !== 'expression-interface') {
        const parameters = callableParameters(node);
        const list = isRecord(parameters)
            ? Object.entries(parameters).map(([name, type]) => {
                  const text = typeText(type);
                  return text === undefined || text === 'any' ? name : `${name}: ${text}`;
              })
            : [];
        const returned = typeText(node.return);
        return `(${list.join(', ')})${returned === undefined ? '' : `: ${returned}`}`;
    }
    return typeText(node);
}

/** Every entry of the model as the Project Explorer lists it, without the documents and tests sections. */
export function buildOutline(session: ProjectSession): OutlineEntry[] | ReturnType<typeof toToolError> {
    const model = session.engine.get('*');
    if (isPortableError(model)) return toToolError(model);
    const interfaces = session.engine.get('*', INTERFACE_KINDS);
    const sections = buildSections(model as PortableContext, []);
    const suites = session.tests.exportDocument().subjects;
    const entries: OutlineEntry[] = [];
    for (const section of MODEL_SECTIONS) {
        for (const entry of sections[section satisfies ExplorerSection]) {
            const signature = isPortableError(interfaces)
                ? undefined
                : signatureOf(portableAtPath(interfaces, entry.path));
            const doc = firstLine(session.documentation.getDescription(entry.path));
            const testCases = suites[entry.path]?.cases.length ?? 0;
            entries.push({
                path: entry.path,
                section,
                kind: entry.kind,
                ...(signature !== undefined && signature !== '' && {signature}),
                ...(doc !== undefined && {doc}),
                ...(testCases > 0 && {testCases}),
            });
        }
    }
    return entries;
}

export function listModelEntries(session: ProjectSession, input: ListModelEntriesInput): ToolResult<ModelEntriesPage> {
    const {sections = MODEL_SECTIONS, under = '*', offset = 0, limit = LIMITS.listLimitDefault} = input;
    const outline = buildOutline(session);
    if (!Array.isArray(outline)) return {ok: false, error: outline};
    const matching = outline.filter(
        (entry) =>
            sections.includes(entry.section) &&
            (under === '*' || entry.path === under || entry.path.startsWith(`${under}.`)),
    );
    if (offset > matching.length) {
        return fail('InvalidInput', `'offset' ${offset} is past the end of the list (${matching.length}).`);
    }
    const page = matching.slice(offset, offset + limit);
    // A page fits the list budget; the entries that do not fit move to the next page.
    const fitted = fitOutput(
        page,
        (current) => (current.length > 1 ? current.slice(0, -1) : undefined),
        LIST_OUTPUT_BUDGET,
    );
    const next = offset + fitted.value.length;
    return ok({
        entries: fitted.value,
        total: matching.length,
        ...(next < matching.length && {nextOffset: next}),
    });
}
