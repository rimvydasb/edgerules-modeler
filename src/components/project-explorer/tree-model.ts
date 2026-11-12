import type {PortableContext, PortableNode} from '@edgerules/portable';
import {untypedParameters} from '#lib/callables';
import {callableParameters, fieldsOf} from '#lib/portableUtils';

/** Literal `get()` argument for the root context. */
export const ROOT_FETCH_PATH = '*';

/** The nine sections of the explorer, in display order. */
export type ExplorerSection =
    'documents' | 'types' | 'factsLibrary' | 'methods' | 'decisions' | 'services' | 'variables' | 'workbooks' | 'tests';

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
    | 'facts'
    | 'function'
    | 'decision'
    | 'service'
    | 'ruleset'
    | 'loop'
    | 'optimise'
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
    // the fully qualified model path; the test subject ID for a test; `doc:<file>` for a document
    path: string;
    label: string;
    children?: ExplorerEntry[]; // the nodes of a workbook or of a service
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

function kindOf(node: Record<string, unknown>): string | undefined {
    return node['@kind'] as string | undefined;
}

// The `@kind` of a function: a `func` or an external function, in the declaration or the interface view.
const FUNCTION_KINDS = new Set(['method', 'method-interface', 'external-method']);

/** The kind of a callable entry: its row icon and the section it is listed in. */
export type MethodKind = 'function' | 'decision' | 'service' | 'ruleset' | 'loop' | 'optimise';

/**
 * The method kind of a callable field, or undefined when the field is not callable. A `service` and a `decision` are
 * listed apart; a `loop` and an `optimise` are methods.
 */
export function methodKind(node: unknown): MethodKind | undefined {
    if (!isRecord(node)) return undefined;
    const kind = kindOf(node);
    if (kind === 'service' || kind === 'service-interface') return 'service';
    if (kind === 'decision' || kind === 'decision-interface') return 'decision';
    if (kind !== undefined && FUNCTION_KINDS.has(kind)) return 'function';
    if (kind === 'ruleset' || kind === 'ruleset-interface') return 'ruleset';
    if (kind === 'loop' || kind === 'loop-interface') return 'loop';
    if (kind === 'optimise' || kind === 'optimise-interface') return 'optimise';
    return undefined;
}

function isContext(node: unknown): node is Record<string, unknown> {
    return isRecord(node) && kindOf(node) === 'context';
}

/** A root `workbook` declaration: `@kind: 'workbook'`. */
export function isWorkbook(node: unknown): node is Record<string, unknown> {
    return isRecord(node) && kindOf(node) === 'workbook';
}

export function joinPath(parentPath: string, name: string): string {
    return parentPath === '' ? name : `${parentPath}.${name}`;
}

// The own fields of a context or a workbook.
function fields(context: unknown): [string, PortableNode][] {
    return Object.entries(fieldsOf(context) ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [name, value as PortableNode]);
}

// A callable reads as a call, as in the Shell breadcrumbs: `name(...)` when it has arguments, `name()` when it has none.
function methodLabel(path: string, node: Record<string, unknown>): string {
    const parameters = callableParameters(node);
    return isRecord(parameters) && Object.keys(parameters).length > 0 ? `${path}(...)` : `${path}()`;
}

// Every callable of a context, at any depth: the services in `services`, the decisions in `decisions`, the other
// callables in `methods`. A function is atomic and a workbook holds nodes, not methods.
function collectMethods(contextPath: string, context: Record<string, unknown>, sections: ExplorerSections): void {
    for (const [name, node] of fields(context)) {
        const path = joinPath(contextPath, name);
        const kind = methodKind(node);
        if (kind) {
            const untypedArguments = untypedParameters(node);
            const section = kind === 'service' ? 'services' : kind === 'decision' ? 'decisions' : 'methods';
            const children = kind === 'service' ? serviceNodes(path, node as unknown as Record<string, unknown>) : [];
            sections[section].push({
                kind,
                path,
                label: methodLabel(path, node as unknown as Record<string, unknown>),
                ...(untypedArguments.length > 0 && {untypedArguments}),
                ...(children.length > 0 && {children}),
            });
        } else if (isContext(node)) collectMethods(path, node, sections);
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

// The nodes of the Flow view of a service, in its order: the parameters as inputs, then every field of its body. A call
// of a callable is a function node, the `return` the output, anything else a node.
function serviceNodes(servicePath: string, service: Record<string, unknown>): ExplorerEntry[] {
    const parameters = callableParameters(service);
    const inputs: ExplorerEntry[] = Object.keys(isRecord(parameters) ? parameters : {}).map((name) => ({
        kind: 'input-node',
        path: joinPath(servicePath, name),
        label: name,
    }));
    const body = fields(service.body).map(([name, node]): ExplorerEntry => {
        const kind: ExplorerEntryKind =
            name === 'return' ? 'output-node' : isRecord(node) && kindOf(node) === 'invocation' ? 'function-node' : 'node';
        return {kind, path: joinPath(servicePath, name), label: name};
    });
    return [...inputs, ...body];
}

function workbookNodeKind(node: unknown): ExplorerEntryKind {
    if (!isRecord(node)) return 'node';
    const annotation = node['@node'];
    if (typeof annotation === 'string' && NODE_KINDS[annotation]) return NODE_KINDS[annotation];
    const method = methodKind(node);
    if (method) return method;
    const kind = kindOf(node);
    if (kind === 'invocation') return 'function-node';
    if (kind === 'context' || kind === 'placeholder') return 'input-node';
    return 'node';
}

// The label of a workbook: its `@Name` (`@name`), else its name.
function workbookLabel(name: string, workbook: Record<string, unknown>): string {
    const label = workbook['@name'];
    return typeof label === 'string' && label !== '' ? label : name;
}

function byLabel(a: ExplorerEntry, b: ExplorerEntry): number {
    if (a.path === '*' || b.path === '*') return a.path === '*' ? -1 : 1;
    return a.label.localeCompare(b.label);
}

/**
 * Splits the project into the explorer sections, each sorted by name:
 * - **Documents**: the document files of `documents`, such as `README.md`, as `doc:<file>` paths. The engine has none.
 * - **Types**: the `type` declarations of the root.
 * - **Facts Library**: the `facts` declarations of the root.
 * - **Methods**: every function, ruleset, loop and optimise, also inside contexts, by qualified path: `path(...)` when it has
 *   arguments, `path()` when it has none.
 * - **Decisions**: every `decision` declaration, labelled like a method.
 * - **Services**: every `service` declaration, labelled like a method, with the nodes of its Flow view as children: its
 *   parameters, then the fields of its body.
 * - **Variables**: every other root field, contexts included.
 * - **Workbooks**: every root `workbook` declaration, labelled with its `@Name`, with its nodes as children. A model
 *   without a `workbook` declaration lists none.
 * - **Tests**: every test subject that has tests, labelled as its method.
 */
export function buildSections(
    model: PortableContext,
    testSubjects: readonly string[],
    documents: readonly string[] = [],
): ExplorerSections {
    const sections: ExplorerSections = {
        documents: documents.map((name) => ({kind: 'document', path: documentPath(name), label: name})),
        types: [],
        factsLibrary: [],
        methods: [],
        decisions: [],
        services: [],
        variables: [],
        workbooks: [],
        tests: [],
    };

    collectMethods('', model as unknown as Record<string, unknown>, sections);
    for (const [name, node] of fields(model)) {
        if (methodKind(node)) continue;
        const kind = isRecord(node) ? kindOf(node) : undefined;
        if (kind === 'type') {
            sections.types.push({kind: 'type', path: name, label: name});
            continue;
        }
        if (kind === 'facts') {
            sections.factsLibrary.push({kind: 'facts', path: name, label: name});
            continue;
        }
        if (isWorkbook(node)) {
            const children = workbookNodes(name, node);
            sections.workbooks.push({kind: 'workbook', path: name, label: workbookLabel(name, node), children});
        } else {
            sections.variables.push({kind: isContext(node) ? 'context' : 'variable', path: name, label: name});
        }
    }
    const methodLabels = new Map(
        [...sections.methods, ...sections.decisions, ...sections.services].map((entry) => [entry.path, entry.label]),
    );
    for (const subjectId of testSubjects) {
        const label = subjectId === '*' ? 'Model' : (methodLabels.get(subjectId) ?? `${subjectId}()`);
        sections.tests.push({kind: 'test', path: subjectId, label});
    }
    // A section lists its entries by name, the model test first.
    for (const entries of Object.values(sections)) entries.sort(byLabel);
    return sections;
}

/** The names of the record types of the root (a `type` with fields, not an alias), by name: what a `facts` is for. */
export function recordTypes(model: PortableContext): string[] {
    return fields(model)
        .filter(([, node]) => isRecord(node) && kindOf(node) === 'type' && isRecord(node.fields))
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b));
}

/** An EdgeRules identifier (EBNF.md): a letter or `_`, then letters, digits or `_`. */
export function isIdentifier(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
