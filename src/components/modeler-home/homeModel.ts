import type {ExampleCoordinates} from '../example-library';
import {searchExamples, type SearchIndex} from '../example-library/internal';
import type {ProjectDescriptor} from '../project-session';
import {matchesQuery} from '../local-workspace/internal';

export const MAX_EXAMPLE_SUGGESTIONS = 5;
export const MAX_PROJECT_SUGGESTIONS = 3;
export const HOME_EXAMPLES = 4; // featured examples on the Home page: one row of four cards
export const HOME_PROJECTS = 4; // recent projects on the Home page: one row of four cards

export type Suggestion =
    | {kind: 'example'; key: string; label: string; detail: string; coordinates: ExampleCoordinates}
    | {kind: 'project'; key: string; label: string; detail: string; project: ProjectDescriptor};

/** Up to 5 example and up to 3 project suggestions for the hero search box, examples first. */
export function suggestionsFor(
    search: SearchIndex | undefined,
    projects: readonly ProjectDescriptor[] | undefined,
    query: string,
): Suggestion[] {
    if (!query.trim()) return [];
    const examples = search ? searchExamples(search, {query}).slice(0, MAX_EXAMPLE_SUGGESTIONS) : [];
    const own = (projects ?? []).filter((project) => matchesQuery(project, query)).slice(0, MAX_PROJECT_SUGGESTIONS);
    return [
        ...examples.map((entry): Suggestion => ({
            kind: 'example',
            key: `example:${entry.id}`,
            label: entry.name,
            detail: entry.description,
            coordinates: {id: entry.id, version: entry.versions[0].version},
        })),
        ...own.map((project): Suggestion => ({
            kind: 'project',
            key: `project:${project.locator.projectPath}`,
            label: project.name,
            detail: project.origin ? `${project.origin.id}@${project.origin.version}` : 'Own project',
            project,
        })),
    ];
}
