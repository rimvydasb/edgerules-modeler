import type {ReactElement} from 'react';
import {Anchor, Button, Card, Group, SimpleGrid, Text} from '@mantine/core';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {DEFAULT_PROJECTS_LIMIT, recentProjects, savedAgo} from './workspaceModel';
import {useWorkspaceProjects} from './useWorkspaceProjects';

export interface RecentProjectsProps {
    repository: LocalProjectRepository; // the IndexedDB repository of the workspace
    limit?: number; // number of panels, default 6
    onOpen: (locator: ProjectLocator) => void; // the host opens the project in the Shell
    onNewProject?: () => void; // shows the "New project" action
    onShowAll?: () => void; // shows the "All" link to the Workspace page
}

/** The newest saved projects as compact panels, for the Home page. */
export function RecentProjects({
    repository,
    limit = DEFAULT_PROJECTS_LIMIT,
    onOpen,
    onNewProject,
    onShowAll,
}: RecentProjectsProps): ReactElement {
    const {projects, error} = useWorkspaceProjects(repository);
    const recent = projects ? recentProjects(projects, limit) : [];

    return (
        <section aria-label="Recent projects">
            <Group justify="space-between" mb="xs">
                <Text fw={600}>Continue</Text>
                <Group gap="sm">
                    {onNewProject && (
                        <Button size="compact-sm" variant="light" onClick={onNewProject}>
                            + New project
                        </Button>
                    )}
                    {onShowAll && (
                        <Anchor component="button" type="button" size="sm" onClick={onShowAll}>
                            All →
                        </Anchor>
                    )}
                </Group>
            </Group>
            {error && (
                <Text c="red" size="sm" role="alert">
                    {error}
                </Text>
            )}
            {projects && recent.length === 0 && !error && (
                <Text c="dimmed" size="sm">
                    No projects yet.
                </Text>
            )}
            <SimpleGrid cols={{base: 1, sm: 2, lg: 3}}>
                {recent.map((project) => (
                    <Card
                        key={project.locator.projectPath}
                        component="button"
                        type="button"
                        withBorder
                        padding="sm"
                        style={{textAlign: 'left', cursor: 'pointer'}}
                        aria-label={`Open ${project.name}`}
                        onClick={() => onOpen(project.locator)}
                    >
                        <Text fw={500} truncate>
                            {project.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {savedAgo(project.savedAt)}
                        </Text>
                    </Card>
                ))}
            </SimpleGrid>
        </section>
    );
}
