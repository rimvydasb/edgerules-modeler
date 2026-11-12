import {Menu} from '@mantine/core';
import {IconChevronDown} from '@tabler/icons-react';
import type {ReactElement} from 'react';
import {cx} from '#ui/cx';
import {SheetProjectMark} from '#ui/sheet';
import type {ProjectOrigin} from '../project-session';
import * as classes from './shell.module.css';
import type {ShellNavigation} from './shell-types';

export interface ShellProjectMenuProps {
    name: string; // the project name
    origin?: ProjectOrigin; // the library example that the project is a copy of
    navigation: ShellNavigation;
    current?: boolean; // the root path is the model: the name reads as the current item
    onOpenOverview?: () => void; // "Project Overview": the model root in its main view
    onOpenTestsOverview?: () => void; // "Tests Overview": the results of every test of the project
    onOpenReadme?: () => void; // "README.md": left out when the project has no README
}

/**
 * The project name in the middle of the Shell bar: a menu to the project overview, the tests overview, the README and
 * the source example.
 * The Shell bar already links to the Workspace and the Library, so the menu does not repeat them.
 * It has no way back to the Workspace: the host navigation owns that, so a click in the Shell never leaves the project
 * by accident.
 */
export function ShellProjectMenu({
    name,
    origin,
    navigation,
    current,
    onOpenOverview,
    onOpenTestsOverview,
    onOpenReadme,
}: ShellProjectMenuProps): ReactElement {
    const {onShowOrigin} = navigation;

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
                {onOpenOverview && <Menu.Item onClick={onOpenOverview}>Project Overview</Menu.Item>}
                {onOpenTestsOverview && <Menu.Item onClick={onOpenTestsOverview}>Tests Overview</Menu.Item>}
                {onOpenReadme && <Menu.Item onClick={onOpenReadme}>README.md</Menu.Item>}
                {origin && onShowOrigin && (
                    <>
                        <Menu.Divider />
                        <Menu.Item onClick={() => onShowOrigin(origin)}>View original example</Menu.Item>
                    </>
                )}
            </Menu.Dropdown>
        </Menu>
    );
}
