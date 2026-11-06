import type {PortableContext, PortableNode} from '@edgerules/portable';
import {untypedParameters} from '#lib/callables';

/** Literal `get()` argument for the root context. */
export const ROOT_FETCH_PATH = '*';

/** The seven sections of the explorer, in display order. */
export type ExplorerSection = 'documents' | 'types' | 'methods' | 'services' | 'variables' | 'workbooks' | 'tests';

/** The prefix of a document path: `doc:README.md`. A model path never contains `:`, so the two never collide. */
export const DOCUMENT_PATH_PREFIX = 'doc:';

/** The path of the document file `name`: `doc:README.md` for `README.md`. */
export function documentPath(name: string): string {
    return `${DOCUMENT_PATH_PREFIX}${name}`;
}

/** What an entry is: it picks the icon of the row and the editor the host opens for it. */
export type ExplorerEntryKind =
    | 'document'
    | 'type'
    | 'function'
    | 'service'
    | 'ruleset'
    | 'context'
    | 'variable'
    | 'workbook'
    | 'input-node'
    | 'function-node'
    | 'output-node'
    | 'chart-node'
    | 'node'
    | 'test';

export interface ExplorerEntry {
    kind: ExplorerEntryKind;
    path: string; // the fully qualified model path; the test subject ID for a test; `doc:<file>` for a document
    label: string;
    children?: ExplorerEntry[]; // the nodes of a workbook
    untypedArguments?: string[]; // a generic function: the arguments without a type, which keep it from being tested
}

export type ExplorerSections = Record<ExplorerSection, ExplorerEntry[]>;

const NODE_KINDS: Record<string, ExplorerEntryKind> = {
    InputNode: 'input-node',
    FunctionNode: 'function-node',
    OutputNode: 'output-node',
    ChartNode: 'chart-node',
};

function isRecord(node: unknown): node is Record<string, unknown> {
    return node !== null && typeof node === 'object' && !Array.isArray(node);
}

// Widened to `string | undefined`: the engine's default filter returns schema kinds (`'function-schema'`,
// `'service-schema'`, `'ruleset-schema'`, …) for callables (see API_SPEC.md), shapes that are not part of the declared
// `PortableNode` union.
function kindOf(node: Record<string, unknown>): string | undefined {
    return node['@kind'] as string | undefined;
}

// The `@kind` of a function: a `func`, an external function, or a layer view, in the authored or the schema view.
const FUNCTION_KINDS = new Set([
    'function',
    'function-schema',
    'external-function',
    'derivations',
    'derivations-schema',
    'decisions',
    'decisions-schema',
]);

/** The method kind of a callable field, or undefined when the field is not callable. A `service` is listed apart. */
export function methodKind(node: unknown): 'function' | 'service' | 'ruleset' | undefined {
    if (!isRecord(node)) return undefined;
    const kind = kindOf(node);
    if (kind === 'service' || kind === 'service-schema') return 'service';
    if (kind !== undefined && FUNCTION_KINDS.has(kind)) return 'function';
    if (kind === 'ruleset' || kind === 'ruleset-schema') return 'ruleset';
    return undefined;
}

function isContext(node: unknown): node is Record<string, unknown> {
    if (!isRecord(node)) return false;
    const kind = kindOf(node);
    return kind === undefined || kind === 'context';
}

/** A root `workbook` declaration: `@kind: 'workbook'`. */
export function isWorkbook(node: unknown): node is Record<string, unknown> {
    return isRecord(node) && kindOf(node) === 'workbook';
}

export function joinPath(parentPath: string, name: string): string {
    return parentPath === '' ? name : `${parentPath}.${name}`;
}

// The own fields of a context. A `.` never appears in an identifier (EBNF.md), so a dotted key is a projection
// artifact of the engine, not a field.
function fields(context: Record<string, unknown>): [string, PortableNode][] {
    return Object.entries(context)
        .filter(([name, value]) => !name.startsWith('@') && !name.includes('.') && value !== undefined)
        .map(([name, value]) => [name, value as PortableNode]);
}

// A callable reads as a call, as in the Shell breadcrumbs: `name(...)` when it has arguments, `name()` when it has none.
function methodLabel(path: string, node: Record<string, unknown>): string {
    const parameters = node['@parameters'];
    return isRecord(parameters) && Object.keys(parameters).length > 0 ? `${path}(...)` : `${path}()`;
}

// Every callable of a context, at any depth: the services in `services`, the other callables in `methods`. A function is
// atomic and a workbook holds nodes, not methods.
function collectMethods(
    contextPath: string,
    context: Record<string, unknown>,
    methods: ExplorerEntry[],
    services: ExplorerEntry[],
): void {
    for (const [name, node] of fields(context)) {
        const path = joinPath(contextPath, name);
        const kind = methodKind(node);
        if (kind) {
            const untypedArguments = untypedParameters(node);
            (kind === 'service' ? services : methods).push({
                kind,
                path,
                label: methodLabel(path, node as Record<string, unknown>),
                ...(untypedArguments.length > 0 && {untypedArguments}),
            });
        } else if (isContext(node)) collectMethods(path, node, methods, services);
    }
}

// Every field of a workbook, annotated or not, in model order. A node annotation picks the kind of its row; without one,
// an invocation is a function node, a record or a typed input an input node, a callable a method, anything else a node.
function workbookNodes(workbookPath: string, workbook: Record<string, unknown>): ExplorerEntry[] {
    return fields(workbook).map(([name, node]) => ({
        kind: workbookNodeKind(node),
        path: joinPath(workbookPath, name),
        label: name,
    }));
}

function workbookNodeKind(node: unknown): ExplorerEntryKind {
    if (!isRecord(node)) return 'node';
    const annotation = node['@node'];
    if (typeof annotation === 'string' && NODE_KINDS[annotation]) return NODE_KINDS[annotation];
    const method = methodKind(node);
    if (method) return method;
    const kind = kindOf(node);
    if (kind === 'invocation') return 'function-node';
    if (kind === 'context' || kind === 'type') return 'input-node';
    return 'node';
}

// The label of a workbook: its `@Name` (`@node-name`), else its name.
function workbookLabel(name: string, workbook: Record<string, unknown>): string {
    const label = workbook['@node-name'];
    return typeof label === 'string' && label !== '' ? label : name;
}

function byLabel(a: ExplorerEntry, b: ExplorerEntry): number {
    if (a.path === '*' || b.path === '*') return a.path === '*' ? -1 : 1;
    return a.label.localeCompare(b.label);
}

/**
 * Splits the project into the explorer sections, each sorted by name:
 * - **Documents**: the document files of `documents`, such as `README.md`, as `doc:<file>` paths. The engine has none.
 * - **Types**: the type definitions of the root.
 * - **Methods**: every function and ruleset, also inside contexts, by qualified path: `path(...)` when it has
 *   arguments, `path()` when it has none.
 * - **Services**: every `service` declaration, labelled like a method.
 * - **Variables**: every other root field, contexts included.
 * - **Workbooks**: every root `workbook` declaration, labelled with its `@Name`, with its nodes as children. A model
 *   without a `workbook` declaration lists none.
 * - **Tests**: every test subject that has tests, labelled as its method.
 */
export function buildSections(
    model: PortableContext,
    types: PortableContext | undefined,
    testSubjects: readonly string[],
    documents: readonly string[] = [],
): ExplorerSections {
    const sections: ExplorerSections = {
        documents: documents.map((name) => ({kind: 'document', path: documentPath(name), label: name})),
        types: [],
        methods: [],
        services: [],
        variables: [],
        workbooks: [],
        tests: [],
    };

    for (const [name] of types ? fields(types) : []) {
        sections.types.push({kind: 'type', path: name, label: name});
    }
    collectMethods('', model as Record<string, unknown>, sections.methods, sections.services);
    for (const [name, node] of fields(model)) {
        if (methodKind(node)) continue;
        if (isWorkbook(node)) {
            const children = workbookNodes(name, node);
            sections.workbooks.push({kind: 'workbook', path: name, label: workbookLabel(name, node), children});
        } else {
            sections.variables.push({kind: isContext(node) ? 'context' : 'variable', path: name, label: name});
        }
    }
    const methodLabels = new Map([...sections.methods, ...sections.services].map((entry) => [entry.path, entry.label]));
    for (const subjectId of testSubjects) {
        const label = subjectId === '*' ? 'Model' : (methodLabels.get(subjectId) ?? `${subjectId}()`);
        sections.tests.push({kind: 'test', path: subjectId, label});
    }
    // The engine projection does not keep the source order: a section lists its entries by name, the model test first.
    for (const entries of Object.values(sections)) entries.sort(byLabel);
    return sections;
}

/** An EdgeRules identifier (EBNF.md): a letter or `_`, then letters, digits or `_`. */
export function isIdentifier(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
