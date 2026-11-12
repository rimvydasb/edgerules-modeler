import {authoredEntries, fieldsOf, isRecord} from '#lib/portableUtils';
import {rootPathSegments, type RootKind, type RootPathKind, type RootPathSegment} from '#lib/rootViews';
import {DOCUMENT_PATH_PREFIX, documentPath} from '../project-explorer/internal';

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
export type ShellPathKind = RootPathKind;

/** One breadcrumb item of a root path. */
export type ShellPathSegment = RootPathSegment;

/** What a root path is: the whole model ('*'), a document, or the kind of its last segment. */
export type ShellRootKind = RootKind;

export {
    hasModelFlow,
    isRootPath,
    modelWorkbooks,
    resolveRootPath,
    ROOT_VIEWS,
    rootKind,
    rootPathSegments,
    rootViews,
} from '#lib/rootViews';

/** The `@InputNode` and `@FunctionNode` fields of the workbook `name` of `model`. */
export function workbookNodeCounts(model: unknown, name: string): {inputs: number; functions: number} {
    const workbook = fieldsOf(model)?.[name];
    const counts = {inputs: 0, functions: 0};
    for (const [, field] of authoredEntries(workbook)) {
        if (!isRecord(field)) continue;
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
    for (const name of path.split('.')) node = fieldsOf(node)?.[name];
    if (!isRecord(node)) return undefined;
    const kind = typeof node['@node'] === 'string' ? node['@node'] : undefined;
    const label = typeof node['@name'] === 'string' ? node['@name'] : undefined;
    if (kind === undefined && label === undefined) return undefined;
    return {...(kind !== undefined && {node: kind}), ...(label !== undefined && {name: label})};
}

/** True when the root path has settings: the model, a workbook, a service and every annotated entity. */
export function hasRootSettings(model: unknown, path: string): boolean {
    if (path === '*') return true;
    const kind = rootPathSegments(model, path).at(-1)?.kind;
    return kind === 'workbook' || kind === 'service' || annotationAt(model, path) !== undefined;
}

/** The model name of the project metadata (the model itself has none), or 'Model'. */
export function modelName(metadata: {name?: string} | undefined): string {
    const name = metadata?.name;
    return typeof name === 'string' && name !== '' ? name : 'Model';
}
