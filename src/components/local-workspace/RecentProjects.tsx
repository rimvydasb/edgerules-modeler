import type {ReactElement} from 'react';
import {Text} from '@mantine/core';
import {IconArrowRight, IconSitemap} from '@tabler/icons-react';
import {KIND_COLORS} from '#ui/kindColors';
import {SheetGrid, SheetPanelButton, SheetPanelHeader, SheetSection} from '#ui/sheet';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {DEFAULT_PROJECTS_LIMIT, recentProjects, savedAgo} from './workspaceModel';
import {useWorkspaceProjects} from './useWorkspaceProjects';
import * as classes from './localWorkspace.module.css';

export interface RecentProjectsProps {
    repository: LocalProjectRepository; // the IndexedDB repository of the workspace
    limit?: number; // number of project panels, default 3
    onOpen: (locator: ProjectLocator) => void; // the host opens the project in the Shell
    onShowAll?: () => void; // the "Browse other projects" panel, shown only when more projects exist than `limit`
}

/** The newest saved projects as compact one-row panels, for the Home page. */
export function RecentProjects({
    repository,
    limit = DEFAULT_PROJECTS_LIMIT,
    onOpen,
    onShowAll,
}: RecentProjectsProps): ReactElement {
    const {projects, error} = useWorkspaceProjects(repository);
    const recent = projects ? recentProjects(projects, limit) : [];

    return (
        <SheetSection label="Workspace" aria-label="Recent projects">
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
                {onShowAll && projects && projects.length > limit && (
                    <SheetPanelButton onClick={onShowAll}>
                        <SheetPanelHeader only icon={<IconArrowRight size={18} />} title="Browse other projects" />
                    </SheetPanelButton>
                )}
            </SheetGrid>
        </SheetSection>
    );
}
