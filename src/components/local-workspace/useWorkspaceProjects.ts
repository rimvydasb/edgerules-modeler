import {useCallback, useEffect, useState} from 'react';
import type {LocalProjectRepository, ProjectDescriptor} from '../project-session';

export interface WorkspaceProjects {
    projects: ProjectDescriptor[] | undefined; // undefined while loading
    error: string | undefined;
    reload: () => Promise<void>;
}

/** Lists the projects of a repository and reloads on demand. */
export function useWorkspaceProjects(repository: LocalProjectRepository): WorkspaceProjects {
    const [projects, setProjects] = useState<ProjectDescriptor[] | undefined>();
    const [error, setError] = useState<string | undefined>();

    const reload = useCallback(async () => {
        try {
            setProjects(await repository.list());
            setError(undefined);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
    }, [repository]);

    useEffect(() => {
        let cancelled = false;
        repository.list().then(
            (listed) => {
                if (cancelled) return;
                setProjects(listed);
                setError(undefined);
            },
            (failure: unknown) => {
                if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure));
            },
        );
        return () => {
            cancelled = true;
        };
    }, [repository]);

    return {projects, error, reload};
}
