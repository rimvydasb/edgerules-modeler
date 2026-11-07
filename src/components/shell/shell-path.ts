import {FACTS_KEY} from '#lib/factsPaths';
import {isRecord} from '#lib/portableUtils';
import {DOCUMENT_PATH_PREFIX, documentPath} from '../project-explorer/internal';
import type {ShellView} from './shell-types';

/** The file name of the project README, the only document of a project. */
export const README_FILE = 'README.md';

/** The document root path of the project README. */
export const README_PATH = documentPath(README_FILE);

/** The document files the Project Explorer lists. */
export const DOCUMENTS: readonly string[] = [README_FILE];

/** True for a document path (`doc:` prefix). A model path never contains `:`. */
export function isDocumentPath(path: string): boolean {
    return path.startsWith(DOCUMENT_PATH_PREFIX);
}

/** The file name of a document path: `README.md` for `doc:README.md`. */
export function documentFile(path: string): string {
    return path.slice(DOCUMENT_PATH_PREFIX.length);
}

/** True when the README has content: Markdown that is not blank. */
export function hasReadme(markdown: string): boolean {
    return markdown.trim() !== '';
}

/** What a root path segment is; it picks the icon of the header and the views that can show it. */
export type ShellPathKind =
    'context' | 'workbook' | 'function' | 'decision' | 'facts' | 'service' | 'ruleset' | 'type' | 'field';

/** One breadcrumb item of a root path. */
export interface ShellPathSegment {
    name: string; // the field name
    path: string; // the fully qualified path of the field
    kind: ShellPathKind;
}

// The kind of a model entry. Only a context or a workbook has fields that a root path can address.
function pathKind(node: unknown): ShellPathKind {
    if (!isRecord(node)) return 'field';
    switch (node['@kind']) {
        case 'context':
            return 'context';
        case 'workbook':
            return 'workbook';
        case 'service':
            return 'service';
        case 'decision':
            return 'decision';
        case 'function':
        case 'external-function':
            return 'function';
        case 'ruleset':
            return 'ruleset';
        case 'type-definition':
            return 'type';
        default:
            return 'field';
    }
}

/**
 * The segments of the longest prefix of `path` that is a valid root path of `model`: contexts and workbooks at any
 * position, and any other entity (a function, a ruleset, a type or a plain field) last only. An index, an annotation
 * or a missing field ends the walk. The one exception is `<Type>.@facts`: the facts declaration of a type, whose
 * segment follows the type segment (`#lib/factsPaths`).
 */
export function rootPathSegments(model: unknown, path: string): ShellPathSegment[] {
    if (path === '*' || path === '') return [];
    const segments: ShellPathSegment[] = [];
    let context = model;
    const names = path.split('.');
    for (const [index, name] of names.entries()) {
        if (name.includes('[') || name.startsWith('@') || !isRecord(context)) break;
        const child = context[name];
        if (child === undefined) break;
        const kind = pathKind(child);
        const segmentPath = segments.length === 0 ? name : `${segments.at(-1)!.path}.${name}`;
        segments.push({name, path: segmentPath, kind});
        const facts = kind === 'type' && isRecord(child) ? child[FACTS_KEY] : undefined;
        if (segments.length === 1 && names[index + 1] === FACTS_KEY && isRecord(facts)) {
            segments.push({name: FACTS_KEY, path: `${segmentPath}.${FACTS_KEY}`, kind: 'facts'});
        }
        // A function is atomic, and only a context has fields: the root path never goes below anything else.
        if (kind !== 'context' && kind !== 'workbook') break;
        context = child;
    }
    return segments;
}

/** `path` when it is a valid root path of `model`, otherwise its nearest valid ancestor; '*' at the latest. */
export function resolveRootPath(model: unknown, path: string): string {
    return rootPathSegments(model, path).at(-1)?.path ?? '*';
}

export function isRootPath(model: unknown, path: string): boolean {
    return resolveRootPath(model, path) === path;
}

/** What a root path is: the whole model ('*'), a document, or the kind of its last segment. */
export type ShellRootKind = 'model' | 'document' | ShellPathKind;

/**
 * The views of each root path kind; the view switch, the view fallback and the Project Explorer routing all read it.
 * - Code and Boxed show every entity.
 * - Flow is the canvas of every field of a `workbook`, and of the body of a `service`, with its parameters and its
 *   result. The Flow view of the model shows its README, workbooks and services: only a model with a workbook, a
 *   service or a README has it (see `rootViews`). Another context, a function, a ruleset, a type and a plain field have
 *   no Flow view.
 * - Preview and Code show a document: its rendered Markdown and its source. Only a document has Preview.
 * - Tests are the tests of a callable: the model, a function, a decision, a service or a ruleset. The facts of a type
 *   are not a test subject: they need the owner of the instance. A function is a test subject only
 *   when every argument has a type (see `untypedParameters`).
 */
export const ROOT_VIEWS: Record<ShellRootKind, readonly ShellView[]> = {
    model: ['code', 'boxed', 'flow', 'tests'],
    document: ['preview', 'code'],
    workbook: ['code', 'boxed', 'flow'],
    context: ['code', 'boxed'],
    function: ['code', 'boxed', 'tests'],
    decision: ['code', 'boxed', 'tests'],
    facts: ['code', 'boxed'],
    service: ['code', 'boxed', 'flow', 'tests'],
    ruleset: ['code', 'boxed', 'tests'],
    type: ['code', 'boxed'],
    field: ['code', 'boxed'],
};

export function rootKind(segments: ShellPathSegment[]): ShellRootKind {
    return segments.at(-1)?.kind ?? 'model';
}

/**
 * The views of a model or entity root path, from `ROOT_VIEWS`. The model has a Flow view only when it has a workbook,
 * a service or a README (`readme`: the README is not blank).
 */
export function rootViews(segments: ShellPathSegment[], model: unknown, readme = false): readonly ShellView[] {
    const views = ROOT_VIEWS[rootKind(segments)];
    if (segments.length > 0 || hasModelFlow(model, readme)) return views;
    return views.filter((view) => view !== 'flow');
}

/** True when the model root has a Flow view: the model has a workbook, a service or a README. */
export function hasModelFlow(model: unknown, readme: boolean): boolean {
    return readme || modelWorkbooks(model).length > 0 || hasService(model);
}

// A `service` declaration anywhere in the contexts of the model, as the Service Methods of the Project Explorer.
function hasService(node: unknown): boolean {
    if (!isRecord(node)) return false;
    return Object.entries(node).some(([name, child]) => {
        if (name.startsWith('@') || !isRecord(child)) return false;
        const kind = child['@kind'];
        if (kind === 'service' || kind === 'service-schema') return true;
        return (kind === undefined || kind === 'context') && hasService(child);
    });
}

/** The names of the workbooks that are direct fields of the model. */
export function modelWorkbooks(model: unknown): string[] {
    if (!isRecord(model)) return [];
    return Object.keys(model).filter((name) => !name.startsWith('@') && pathKind(model[name]) === 'workbook');
}

/** The `@InputNode` and `@FunctionNode` fields of the workbook `name` of `model`. */
export function workbookNodeCounts(model: unknown, name: string): {inputs: number; functions: number} {
    const workbook = isRecord(model) ? model[name] : undefined;
    const counts = {inputs: 0, functions: 0};
    if (!isRecord(workbook)) return counts;
    for (const [key, field] of Object.entries(workbook)) {
        if (key.startsWith('@') || !isRecord(field)) continue;
        if (field['@node'] === 'InputNode') counts.inputs += 1;
        else if (field['@node'] === 'FunctionNode') counts.functions += 1;
    }
    return counts;
}

/**
 * The annotation of an entity: `@InputNode(name: "Applicant")` is `{node: 'InputNode', name: 'Applicant'}`, and the
 * label-only `@Name("Main Workbook")` is `{name: 'Main Workbook'}`.
 */
export interface ShellAnnotation {
    node?: string;
    name?: string;
}

/** The annotation of the entity at `path` of `model`, when it has one. */
export function annotationAt(model: unknown, path: string): ShellAnnotation | undefined {
    if (path === '*') return undefined;
    let node = model;
    for (const name of path.split('.')) node = isRecord(node) ? node[name] : undefined;
    if (!isRecord(node)) return undefined;
    const kind = typeof node['@node'] === 'string' ? node['@node'] : undefined;
    const label = typeof node['@node-name'] === 'string' ? node['@node-name'] : undefined;
    if (kind === undefined && label === undefined) return undefined;
    return {...(kind !== undefined && {node: kind}), ...(label !== undefined && {name: label})};
}

/** True when the root path has settings: the model, a workbook, a service and every annotated entity. */
export function hasRootSettings(model: unknown, path: string): boolean {
    if (path === '*') return true;
    const kind = rootPathSegments(model, path).at(-1)?.kind;
    return kind === 'workbook' || kind === 'service' || annotationAt(model, path) !== undefined;
}

/** The model name of the `@model-name` of `model`, or 'Model'. */
export function modelName(model: unknown): string {
    const name = isRecord(model) ? model['@model-name'] : undefined;
    return typeof name === 'string' && name !== '' ? name : 'Model';
}
