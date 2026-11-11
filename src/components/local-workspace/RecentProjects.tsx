import type {ReactElement} from 'react';
import {Text} from '@mantine/core';
import {IconChevronRight} from '@tabler/icons-react';
import {SheetGrid, SheetLinkButton, SheetSection} from '#ui/sheet';
import type {LibraryClient} from '../example-library';
import type {LocalProjectRepository, ProjectLocator} from '../project-session';
import {ProjectCard} from './ProjectCard';
import {DEFAULT_PROJECTS_LIMIT, recentProjects} from './workspaceModel';
import {useWorkspaceProjects} from './useWorkspaceProjects';
import {isOutdated, useExampleIndustries, useNewestVersions} from './useNewestVersions';

export interface RecentProjectsProps {
    repository: LocalProjectRepository; // the IndexedDB repository of the workspace
    library?: LibraryClient; // the industry label and the "Update available" badge of a copy; without it neither shows
    limit?: number; // number of project cards, default 3
    onOpen: (locator: ProjectLocator) => void; // the host opens the project in the Shell
    onShowAll?: () => void; // the "All projects" link, shown only when more projects exist than `limit`
}

/** The newest saved projects as cards under a "Workspace" heading, for the Home page. */
export function RecentProjects({
    repository,
    library,
    limit = DEFAULT_PROJECTS_LIMIT,
    onOpen,
    onShowAll,
}: RecentProjectsProps): ReactElement {
    const {projects, error} = useWorkspaceProjects(repository);
    const newest = useNewestVersions(library);
    const industries = useExampleIndustries(library);
    const recent = projects ? recentProjects(projects, limit) : [];

    return (
        <SheetSection
            label="Workspace"
            aria-label="Recent projects"
            count={projects?.length}
            actions={
                onShowAll &&
                projects &&
                projects.length > limit && (
                    <SheetLinkButton onClick={onShowAll}>
                        All projects <IconChevronRight size={14} aria-hidden="true" />
                    </SheetLinkButton>
                )
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
            <SheetGrid fourUp={limit === 4}>
                {recent.map((project) => (
                    <ProjectCard
                        key={project.locator.projectPath}
                        project={project}
                        industry={project.origin ? industries.get(project.origin.id) : undefined}
                        updateAvailable={project.origin ? isOutdated(project.origin, newest) : false}
                        onOpen={() => onOpen(project.locator)}
                    />
                ))}
            </SheetGrid>
        </SheetSection>
    );
}
