import type {ReactElement} from 'react';
import {Text} from '@mantine/core';
import {IconSitemap} from '@tabler/icons-react';
import {KIND_COLORS} from '#ui/kindColors';
import {SheetGrid, SheetLinkButton, SheetPanelButton, SheetPanelHeader, SheetSection} from '#ui/sheet';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {DEFAULT_PROJECTS_LIMIT, recentProjects, savedAgo} from './workspaceModel';
import {useWorkspaceProjects} from './useWorkspaceProjects';
import * as classes from './localWorkspace.module.css';

export interface RecentProjectsProps {
    repository: LocalProjectRepository; // the IndexedDB repository of the workspace
    limit?: number; // number of panels, default 6
    onOpen: (locator: ProjectLocator) => void; // the host opens the project in the Shell
    onNewProject?: () => void; // shows the "New project" action
    onShowAll?: () => void; // shows the "All" link to the Workspace page
}

/** The newest saved projects as compact one-row panels, for the Home page. */
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
        <SheetSection
            label="Continue"
            aria-label="Recent projects"
            count={projects?.length}
            actions={
                <>
                    {onNewProject && <SheetLinkButton onClick={onNewProject}>+ New project</SheetLinkButton>}
                    {onShowAll && <SheetLinkButton onClick={onShowAll}>All projects →</SheetLinkButton>}
                </>
            }
        >
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
            <SheetGrid compact>
                {recent.map((project) => (
                    <SheetPanelButton
                        key={project.locator.projectPath}
                        aria-label={`Open ${project.name}`}
                        onClick={() => onOpen(project.locator)}
                    >
                        <SheetPanelHeader
                            only
                            icon={<IconSitemap size={18} />}
                            iconColor={KIND_COLORS.model}
                            title={project.name}
                            aside={<span className={classes.recentMeta}>{savedAgo(project.savedAt)}</span>}
                        />
                    </SheetPanelButton>
                ))}
            </SheetGrid>
        </SheetSection>
    );
}
