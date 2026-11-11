import type {ReactElement, ReactNode} from 'react';
import {IconClock, IconArrowUp} from '@tabler/icons-react';
import {
    SheetBody,
    SheetChip,
    SheetDescription,
    SheetFooter,
    SheetMeta,
    SheetPanel,
    SheetPanelHeader,
    SheetProjectMark,
    SheetTokens,
    sheetClasses,
} from '#ui/sheet';
import type {ProjectDescriptor} from '../project-session';
import {savedAgo} from './workspaceModel';

export interface ProjectCardProps {
    project: ProjectDescriptor;
    industry?: string; // the industry of the example that the project was copied from
    updateAvailable?: boolean; // the example has a newer version than the copy
    menu?: ReactNode; // the actions of the card, shown in the footer on hover
    onOpen: () => void;
}

/** The eyebrow of a project: the industry of its example, "Example project", or "Own project". */
export function projectEyebrow(project: ProjectDescriptor, industry: string | undefined): string {
    return project.origin ? (industry ?? 'Example project') : 'Own project';
}

/** A project of the workspace as a card: kind label, name, description, tags and the save time. The card opens it. */
export function ProjectCard({project, industry, updateAvailable, menu, onOpen}: ProjectCardProps): ReactElement {
    return (
        <SheetPanel data-testid="project-panel" data-project-path={project.locator.projectPath}>
            <SheetPanelHeader
                eyebrow={projectEyebrow(project, industry)}
                title={
                    <button type="button" role="link" className={sheetClasses.titleLink} onClick={onOpen}>
                        <span className={sheetClasses.titleWithMark}>
                            <SheetProjectMark name={project.name} />
                            <span className={sheetClasses.titleText}>{project.name}</span>
                        </span>
                    </button>
                }
                aside={
                    updateAvailable && (
                        <SheetChip tone="yellow">
                            <IconArrowUp size={12} aria-hidden="true" />
                            Update available
                        </SheetChip>
                    )
                }
            />
            <SheetBody>
                <SheetDescription>{project.description || <i>No description</i>}</SheetDescription>
                {project.tags.length > 0 && <SheetTokens items={project.tags} max={2} />}
            </SheetBody>
            <SheetFooter>
                <SheetMeta>
                    <span>
                        <IconClock size={12} aria-hidden="true" style={{verticalAlign: '-1px'}} />{' '}
                        {savedAgo(project.savedAt).replace(/^saved /, '')}
                    </span>
                    {project.origin && (
                        <span>
                            {project.origin.id}@{project.origin.version}
                        </span>
                    )}
                </SheetMeta>
                {menu}
            </SheetFooter>
        </SheetPanel>
    );
}
