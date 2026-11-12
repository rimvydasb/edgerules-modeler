import {savedAgo} from '#lib/savedAgo';
import type {ProjectDescriptor} from '../project-session';

export {savedAgo};

export type WorkspaceSort = 'saved' | 'name';
export type WorkspaceSource = 'all' | 'examples' | 'own';

export interface WorkspaceView {
    query: string;
    sort: WorkspaceSort;
    source: WorkspaceSource;
}

export const DEFAULT_PROJECTS_LIMIT = 3;

/** Case-insensitive substring match on name, description and tags. */
export function matchesQuery(project: ProjectDescriptor, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [project.name, project.description ?? '', ...project.tags].some((text) =>
        text.toLowerCase().includes(needle),
    );
}

function matchesSource(project: ProjectDescriptor, source: WorkspaceSource): boolean {
    if (source === 'all') return true;
    return source === 'examples' ? project.origin !== undefined : project.origin === undefined;
}

/** Newest save first, or by name. */
export function compareProjects(sort: WorkspaceSort): (a: ProjectDescriptor, b: ProjectDescriptor) => number {
    return sort === 'name'
        ? (a, b) => a.name.localeCompare(b.name) || a.locator.projectPath.localeCompare(b.locator.projectPath)
        : (a, b) => b.savedAt.localeCompare(a.savedAt) || a.locator.projectPath.localeCompare(b.locator.projectPath);
}

export function visibleProjects(projects: readonly ProjectDescriptor[], view: WorkspaceView): ProjectDescriptor[] {
    return projects
        .filter((project) => matchesSource(project, view.source) && matchesQuery(project, view.query))
        .sort(compareProjects(view.sort));
}

/** The newest saved projects first. */
export function recentProjects(projects: readonly ProjectDescriptor[], limit: number): ProjectDescriptor[] {
    return [...projects].sort(compareProjects('saved')).slice(0, limit);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = -1;
    do {
        value /= 1024;
        unit += 1;
    } while (value >= 1024 && unit < units.length - 1);
    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "Loan repayment" taken: "Loan repayment (2)", then "(3)". */
export function uniqueProjectName(name: string, taken: ReadonlySet<string>): string {
    if (!taken.has(name)) return name;
    let counter = 2;
    while (taken.has(`${name} (${counter})`)) counter += 1;
    return `${name} (${counter})`;
}

/** A path-safe key for a project name; `project` when nothing is left. */
export function slugOf(name: string): string {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'project';
}

export function uniqueProjectPath(name: string, taken: ReadonlySet<string>): string {
    const base = slugOf(name);
    if (!taken.has(base)) return base;
    let counter = 2;
    while (taken.has(`${base}-${counter}`)) counter += 1;
    return `${base}-${counter}`;
}
