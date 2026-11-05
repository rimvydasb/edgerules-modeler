import type {PortableContext, PortableNode} from '@edgerules/portable';
import {untypedParameters} from '#lib/callables';

/** Literal `get()` argument for the root context. */
export const ROOT_FETCH_PATH = '*';

/** The six sections of the explorer, in display order. */
export type ExplorerSection = 'types' | 'methods' | 'services' | 'variables' | 'workbooks' | 'tests';

/** What an entry is: it picks the icon of the row and the editor the host opens for it. */
export type ExplorerEntryKind =
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
    path: string; // the fully qualified model path; the test subject ID for a test
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

// Widened to `string | undefined`: the engine's default filter returns `'function-schema'` and `'ruleset-schema'`
// for callables (see API_SPEC.md), shapes that are not part of the declared `PortableNode` union.
function kindOf(node: Record<string, unknown>): string | undefined {
    return node['@kind'] as string | undefined;
}

// The `@kind` of a function: a `func`, an external function, or a layer view. A `service` is a method too, listed apart.
const FUNCTION_KINDS = new Set(['function', 'function-schema', 'external-function', 'derivations', 'decisions']);

/**
 * The method kind of a callable field, or undefined when the field is not callable. A `service` declaration is
 * `@kind: 'service'` in an authored view; the linked schema view reports it as `'function-schema'`, so `isService`
 * tells it apart there (see `collectServicePaths`).
 */
export function methodKind(node: unknown, isService = false): 'function' | 'service' | 'ruleset' | undefined {
    if (!isRecord(node)) return undefined;
    const kind = kindOf(node);
    if (kind === 'service') return 'service';
    if (kind !== undefined && FUNCTION_KINDS.has(kind)) return isService ? 'service' : 'function';
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
    servicePaths: ReadonlySet<string>,
): void {
    for (const [name, node] of fields(context)) {
        const path = joinPath(contextPath, name);
        const kind = methodKind(node, servicePaths.has(path));
        if (kind) {
            const untypedArguments = untypedParameters(node);
            (kind === 'service' ? services : methods).push({
                kind,
                path,
                label: methodLabel(path, node as Record<string, unknown>),
                ...(untypedArguments.length > 0 && {untypedArguments}),
            });
        } else if (isContext(node)) collectMethods(path, node, methods, services, servicePaths);
    }
}

/** Structural subset of the engine service that `collectServicePaths` reads. */
interface FunctionDefinitionSource {
    get(path: string, filter: 'FUNCTION_DEFINITIONS'): unknown;
}

/**
 * The paths of every `service` declaration of `model`, at any context depth. The linked `get()` view reports a service
 * as `'function-schema'`; the `FUNCTION_DEFINITIONS` view of each context keeps `@kind: 'service'`.
 */
export function collectServicePaths(source: FunctionDefinitionSource, model: unknown): Set<string> {
    const paths = new Set<string>();
    const visit = (contextPath: string, context: Record<string, unknown>) => {
        const definitions = source.get(contextPath === '' ? ROOT_FETCH_PATH : contextPath, 'FUNCTION_DEFINITIONS');
        if (isRecord(definitions) && definitions['@kind'] !== 'error') {
            for (const [name, node] of fields(definitions)) {
                if (isRecord(node) && kindOf(node) === 'service') paths.add(joinPath(contextPath, name));
            }
        }
        for (const [name, node] of fields(context)) {
            if (isContext(node)) visit(joinPath(contextPath, name), node);
        }
    };
    if (isRecord(model)) visit('', model);
    return paths;
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
 * Splits the model into the explorer sections, each sorted by name:
 * - **Types**: the type definitions of the root.
 * - **Methods**: every function and ruleset, also inside contexts, by qualified path: `path(...)` when it has
 *   arguments, `path()` when it has none.
 * - **Services**: every `service` declaration, labelled like a method. `servicePaths` names the services of a linked
 *   schema view, where a service reads as a `'function-schema'` (see `collectServicePaths`).
 * - **Variables**: every other root field, contexts included.
 * - **Workbooks**: every root `workbook` declaration, labelled with its `@Name`, with its nodes as children. A model
 *   without a `workbook` declaration lists none.
 * - **Tests**: every test subject that has tests, labelled as its method.
 */
export function buildSections(
    model: PortableContext,
    types: PortableContext | undefined,
    testSubjects: readonly string[],
    servicePaths: ReadonlySet<string> = new Set(),
): ExplorerSections {
    const sections: ExplorerSections = {
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
    collectMethods('', model as Record<string, unknown>, sections.methods, sections.services, servicePaths);
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
