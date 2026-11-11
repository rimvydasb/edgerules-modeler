import {authoredEntries, fieldsOf, isRecord} from './portableUtils';

// The root paths of the Shell and the views that show each of them. The Shell and the WebMCP `open-in-editor` tool
// both read these rules, so they live here and not in either component.

/** A Shell view; the same values as `ShellView` of the Shell. */
export type RootView = 'code' | 'boxed' | 'flow' | 'tests' | 'preview';

/** What a root path segment is; it picks the icon of the header and the views that can show it. */
export type RootPathKind =
    'context' | 'workbook' | 'function' | 'decision' | 'facts' | 'service' | 'ruleset' | 'type' | 'field';

/** One breadcrumb item of a root path. */
export interface RootPathSegment {
    name: string; // the field name
    path: string; // the fully qualified path of the field
    kind: RootPathKind;
}

// The kind of a model entry. Only a context or a workbook has fields that a root path can address.
function pathKind(node: unknown): RootPathKind {
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
        case 'method':
        case 'external-method':
            return 'function';
        case 'ruleset':
            return 'ruleset';
        case 'type':
            return 'type';
        case 'facts':
            return 'facts';
        default:
            return 'field';
    }
}

/**
 * The segments of the longest prefix of `path` that is a valid root path of `model`: contexts and workbooks at any
 * position, and any other entity (a function, a ruleset, a type, a facts declaration or a plain field) last only. An
 * index, an annotation or a missing field ends the walk.
 */
export function rootPathSegments(model: unknown, path: string): RootPathSegment[] {
    if (path === '*' || path === '') return [];
    const segments: RootPathSegment[] = [];
    let context = model;
    for (const name of path.split('.')) {
        const fields = fieldsOf(context);
        if (name.includes('[') || name.startsWith('@') || !fields) break;
        const child = fields[name];
        if (child === undefined) break;
        const kind = pathKind(child);
        const segmentPath = segments.length === 0 ? name : `${segments.at(-1)!.path}.${name}`;
        segments.push({name, path: segmentPath, kind});
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
export type RootKind = 'model' | 'document' | RootPathKind;

/**
 * The views of each root path kind; the view switch, the view fallback and the Project Explorer routing all read it.
 * - Code and Boxed show every entity.
 * - Flow is the canvas of every field of a `workbook`, and of the body of a `service`, with its parameters and its
 *   result. The Flow view of the model shows its README, workbooks and services: only a model with a workbook, a
 *   service or a README has it (see `rootViews`). Another context, a function, a ruleset, a type and a plain field have
 *   no Flow view.
 * - Preview and Code show a document: its rendered Markdown and its source. Only a document has Preview.
 * - Tests are the tests of a callable: the model, a function, a decision, a service or a ruleset. A facts declaration
 *   is not a test subject: it needs the owner of the instance. A function is a test subject only
 *   when every argument has a type (see `untypedParameters`).
 */
export const ROOT_VIEWS: Record<RootKind, readonly RootView[]> = {
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

export function rootKind(segments: RootPathSegment[]): RootKind {
    return segments.at(-1)?.kind ?? 'model';
}

/**
 * The views of a model or entity root path, from `ROOT_VIEWS`. The model has a Flow view only when it has a workbook,
 * a service or a README (`readme`: the README is not blank).
 */
export function rootViews(segments: RootPathSegment[], model: unknown, readme = false): readonly RootView[] {
    const views = ROOT_VIEWS[rootKind(segments)];
    if (segments.length > 0 || hasModelFlow(model, readme)) return views;
    return views.filter((view) => view !== 'flow');
}

/** The view a root path opens in from a link: Preview for a document, Flow when the path has it, otherwise Boxed. */
export function primaryRootView(views: readonly RootView[]): RootView {
    if (views.includes('preview')) return 'preview';
    return views.includes('flow') ? 'flow' : 'boxed';
}

/** True when the model root has a Flow view: the model has a workbook, a service or a README. */
export function hasModelFlow(model: unknown, readme: boolean): boolean {
    return readme || modelWorkbooks(model).length > 0 || hasService(model);
}

// A `service` declaration anywhere in the contexts of the model, as the Service Methods of the Project Explorer.
function hasService(node: unknown): boolean {
    return authoredEntries(node).some(([, child]) => {
        if (!isRecord(child)) return false;
        const kind = child['@kind'];
        if (kind === 'service' || kind === 'service-interface') return true;
        return kind === 'context' && hasService(child);
    });
}

/** The names of the workbooks that are direct fields of the model. */
export function modelWorkbooks(model: unknown): string[] {
    return authoredEntries(model)
        .filter(([, child]) => pathKind(child) === 'workbook')
        .map(([name]) => name);
}
