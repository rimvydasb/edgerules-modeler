import {Menu} from '@mantine/core';
import {IconChevronDown} from '@tabler/icons-react';
import type {ReactElement} from 'react';
import {savedAgo} from '#lib/savedAgo';
import {cx} from '#ui/cx';
import {SheetProjectMark} from '#ui/sheet';
import type {ProjectOrigin} from '../project-session';
import * as classes from './shell.module.css';
import type {ShellNavigation} from './shell-types';

const RECENT_LIMIT = 5;

export interface ShellProjectMenuProps {
    name: string; // the project name
    projectId: string; // the open project: left out of the recent projects
    origin?: ProjectOrigin; // the library example that the project is a copy of
    savedAt?: string; // ISO time of the last save
    navigation: ShellNavigation;
    current?: boolean; // the root path is the model: the name reads as the current item
    onOpenOverview?: () => void; // "Overview": the model root in its main view
    onOpenReadme: () => void;
}

/**
 * The project name in the middle of the Shell bar: a menu to the recent projects, the Library and the source example.
 * It has no way back to the Workspace: the host navigation owns that, so a click in the Shell never leaves the project
 * by accident.
 */
export function ShellProjectMenu({
    name,
    projectId,
    origin,
    savedAt,
    navigation,
    current,
    onOpenOverview,
    onOpenReadme,
}: ShellProjectMenuProps): ReactElement {
    const {onBrowseExamples, onOpenProject, recentProjects, onShowOrigin, originStatus, onDuplicate} = navigation;
    const recent = (recentProjects ?? []).filter((project) => project.projectId !== projectId).slice(0, RECENT_LIMIT);

    return (
        <Menu position="bottom" withinPortal>
            <Menu.Target>
                <button
                    type="button"
                    className={cx(classes.projectMenu, current && classes.projectMenuCurrent)}
                    aria-label={`Project menu: ${name}`}
                >
                    <SheetProjectMark name={name} size="xs" />
                    <span className={classes.projectName}>{name}</span>
                    <IconChevronDown aria-hidden="true" size={14} />
                </button>
            </Menu.Target>
            <Menu.Dropdown>
                <div className={classes.projectMenuHeader} data-testid="shell-project-menu-header">
                    <div className={classes.projectMenuName}>{name}</div>
                    {savedAt && <div className={classes.projectMenuMeta}>{savedAgo(savedAt)}</div>}
                    {origin && (
                        <Menu.Item
                            component="button"
                            type="button"
                            className={classes.originChip}
                            data-testid="shell-origin-chip"
                            disabled={!onShowOrigin}
                            onClick={() => onShowOrigin?.(origin)}
                        >
                            from {origin.id}@{origin.version} ↗
                            {originStatus === 'update-available' && (
                                <span className={classes.originStatus}> Update available</span>
                            )}
                        </Menu.Item>
                    )}
                </div>
                {onOpenOverview && <Menu.Item onClick={onOpenOverview}>Overview</Menu.Item>}
                <Menu.Divider />
                {recent.length > 0 && <Menu.Label>Recent projects</Menu.Label>}
                {recent.map((project) => (
                    <Menu.Item
                        key={project.projectId}
                        leftSection={<SheetProjectMark name={project.name} size="sm" />}
                        onClick={() => onOpenProject(project.locator)}
                    >
                        {project.name}
                    </Menu.Item>
                ))}
                <Menu.Item onClick={onBrowseExamples}>Browse examples</Menu.Item>
                {origin && onShowOrigin && (
                    <Menu.Item onClick={() => onShowOrigin(origin)}>View original example</Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item onClick={onOpenReadme}>Open README</Menu.Item>
                {onDuplicate && <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>}
            </Menu.Dropdown>
        </Menu>
    );
}
