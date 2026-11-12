import {
    isProjectError,
    type LoadedProject,
    type LocalProjectRepository,
    type ProjectBundleInput,
    type ProjectFactory,
} from '../project-session';
import {uniqueProjectName, uniqueProjectPath} from './workspaceModel';

export interface WorkspaceStore {
    repository: LocalProjectRepository;
    factory: ProjectFactory;
}

const MAX_ATTEMPTS = 5;

/**
 * Adds a project to the workspace. A taken name gets a suffix (`Loan repayment (2)`) and the path is derived from the
 * final name, so two copies of one example never collide.
 */
export async function addWorkspaceProject(
    {repository, factory}: WorkspaceStore,
    input: ProjectBundleInput,
): Promise<LoadedProject> {
    for (let attempt = 0; ; attempt += 1) {
        const projects = await repository.list();
        const name = uniqueProjectName(input.name, new Set(projects.map((project) => project.name)));
        const path = uniqueProjectPath(name, new Set(projects.map((project) => project.locator.projectPath)));
        try {
            return await repository.create(repository.locatorFor(path), factory.createBundle({...input, name}));
        } catch (error) {
            // Another tab took the path between the listing and the create: list again.
            if (!isProjectError(error) || error.code !== 'already-exists' || attempt >= MAX_ATTEMPTS) throw error;
        }
    }
}
