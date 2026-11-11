import {forwardRef, useCallback, useImperativeHandle, useState, type ReactElement} from 'react';
import {ActionIcon, Alert, Button, Group, Menu, Modal, Popover, Select, Stack, Text, TextInput} from '@mantine/core';
import {IconDatabase, IconDotsVertical, IconPlus, IconSearch} from '@tabler/icons-react';
import {cx} from '#ui/cx';
import {SheetAction, SheetActions, SheetChip, SheetEmpty, SheetGrid, SheetPageHeader, sheetClasses} from '#ui/sheet';
import {
    type LoadedProject,
    type LocalProjectRepository,
    type ProjectBundleInput,
    type ProjectDescriptor,
    type ProjectFactory,
    type ProjectLocator,
} from '../project-session';
import type {LibraryClient} from '../example-library';
import {addWorkspaceProject} from './addWorkspaceProject';
import {ProjectDialog} from './ProjectDialog';
import {useWorkspaceProjects} from './useWorkspaceProjects';
import {isOutdated, useExampleIndustries, useNewestVersions} from './useNewestVersions';
import {ProjectCard} from './ProjectCard';
import {useWorkspaceStorage} from './useWorkspaceStorage';
import * as classes from './localWorkspace.module.css';
import {formatBytes, visibleProjects, type WorkspaceSort, type WorkspaceSource} from './workspaceModel';

function StorageMeter({usage, quota}: {usage: number; quota?: number}): ReactElement | null {
    if (quota === undefined || quota <= 0) return null;
    return (
        <span className={classes.meter} aria-hidden="true">
            <i style={{width: `${Math.max(1, (usage / quota) * 100)}%`}} />
        </span>
    );
}

export interface LocalWorkspaceProps {
    repository: LocalProjectRepository; // the IndexedDB repository of the workspace
    factory: ProjectFactory; // creates the bundle of a new project or a copy
    library?: LibraryClient; // resolves "Update available"; without it the badge is not shown
    onOpen: (locator: ProjectLocator) => void; // the host opens the project in the Shell
    onBrowseExamples?: () => void; // "Browse examples" and the "From example" action of the New project panel
}

export interface LocalWorkspaceHandle {
    addProject(input: ProjectBundleInput): Promise<LoadedProject>; // unique name and path, then repository.create
}

type Dialog =
    {kind: 'new'} | {kind: 'rename'; project: ProjectDescriptor} | {kind: 'delete'; project: ProjectDescriptor};

const SORT_OPTIONS = [
    {value: 'saved', label: 'Last saved'},
    {value: 'name', label: 'Name'},
];
const SOURCE_OPTIONS = [
    {value: 'all', label: 'All projects'},
    {value: 'examples', label: 'Example projects'},
    {value: 'own', label: 'My projects'},
];
const BLANK_MODEL = '{}';

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** The projects of the user in one local repository: list, search, open, create, duplicate, rename, delete. */
export const LocalWorkspace = forwardRef<LocalWorkspaceHandle, LocalWorkspaceProps>(function LocalWorkspace(
    {repository, factory, library, onOpen, onBrowseExamples},
    ref,
): ReactElement {
    const {projects, error: loadError, reload} = useWorkspaceProjects(repository);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<WorkspaceSort>('saved');
    const [source, setSource] = useState<WorkspaceSource>('all');
    const [dialog, setDialog] = useState<Dialog | undefined>();
    const [actionError, setActionError] = useState<string | undefined>();
    const storage = useWorkspaceStorage(projects);
    const newest = useNewestVersions(library);
    const industries = useExampleIndustries(library);

    const run = useCallback(
        async (work: () => Promise<unknown>) => {
            setActionError(undefined);
            try {
                await work();
            } catch (error) {
                setActionError(describeError(error));
            }
            await reload();
        },
        [reload],
    );

    const addProject = useCallback(
        async (input: ProjectBundleInput) => {
            const added = await addWorkspaceProject({repository, factory}, input);
            await reload();
            return added;
        },
        [repository, factory, reload],
    );
    useImperativeHandle(ref, () => ({addProject}), [addProject]);

    const duplicate = (project: ProjectDescriptor) =>
        run(async () => {
            const {bundle} = await repository.load(project.locator);
            const {manifest} = bundle;
            await addWorkspaceProject(
                {repository, factory},
                {
                    name: manifest.name,
                    ...(manifest.description !== undefined && {description: manifest.description}),
                    ...(manifest.tags !== undefined && {tags: manifest.tags}),
                    model: {dsl: bundle.model, name: manifest.model.name, version: manifest.model.version},
                    documentation: bundle.documentation,
                    tests: bundle.tests,
                    flow: bundle.flow,
                    readme: bundle.readme,
                    ...(manifest.origin !== undefined && {origin: manifest.origin}),
                },
            );
        });

    const rename = (project: ProjectDescriptor, name: string, description: string | undefined) =>
        run(async () => {
            const loaded = await repository.load(project.locator);
            const {description: _previous, ...rest} = loaded.bundle.manifest;
            const manifest = {...rest, name, ...(description ? {description} : {})};
            await repository.save(project.locator, {...loaded.bundle, manifest}, loaded.revision);
        });

    const remove = (project: ProjectDescriptor) => run(() => repository.remove(project.locator));

    const createBlank = (name: string) =>
        run(async () => {
            const created = await addWorkspaceProject({repository, factory}, {name, model: {dsl: BLANK_MODEL}});
            onOpen(created.locator);
        });

    const shown = projects ? visibleProjects(projects, {query, sort, source}) : [];
    const empty = projects !== undefined && projects.length === 0;

    const sourceCounts = {
        all: projects?.length ?? 0,
        examples: projects?.filter((project) => project.origin !== undefined).length ?? 0,
        own: projects?.filter((project) => project.origin === undefined).length ?? 0,
    };

    return (
        <Stack gap={28} className={sheetClasses.tokens} data-testid="local-workspace">
            <SheetPageHeader
                eyebrow="Local workspace"
                title="Workspace"
                aside={
                    <SheetAction primary icon={<IconPlus size={16} />} onClick={() => setDialog({kind: 'new'})}>
                        New project
                    </SheetAction>
                }
            />

            {(loadError ?? actionError) && (
                <Alert color="red" role="alert">
                    {loadError ?? actionError}
                </Alert>
            )}

            {empty ? (
                <SheetEmpty data-testid="workspace-empty">
                    <Text fw={600} c="var(--er-text)">
                        No projects yet
                    </Text>
                    <Text size="sm">Copy an example from the library, or start from an empty model.</Text>
                    <Group>
                        {onBrowseExamples && (
                            <Button color="dark" onClick={onBrowseExamples}>
                                Browse examples
                            </Button>
                        )}
                        <Button variant="default" onClick={() => setDialog({kind: 'new'})}>
                            New project
                        </Button>
                    </Group>
                </SheetEmpty>
            ) : (
                <div className={classes.layout}>
                    <aside className={cx(sheetClasses.facets, classes.side)} aria-label="Filters">
                        <div className={sheetClasses.facetGroup} role="group" aria-label="Source">
                            <div className={sheetClasses.eyebrow}>Source</div>
                            {SOURCE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={sheetClasses.facet}
                                    aria-pressed={source === option.value}
                                    onClick={() => setSource(option.value as WorkspaceSource)}
                                >
                                    {option.label}
                                    <span className={sheetClasses.facetCount}>
                                        {sourceCounts[option.value as WorkspaceSource]}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {storage.usage !== undefined && (
                            <div className={sheetClasses.facetGroup} data-testid="workspace-storage">
                                <div className={sheetClasses.eyebrow}>Storage</div>
                                <Popover position="top-start" width={300} shadow="md" withArrow={false}>
                                    <Popover.Target>
                                        <button type="button" className={classes.storage} aria-haspopup="dialog">
                                            <span className={classes.storageTop}>
                                                <IconDatabase size={14} aria-hidden="true" />
                                                {formatBytes(storage.usage)} used
                                                {storage.quota !== undefined && ` of ${formatBytes(storage.quota)}`}
                                            </span>
                                            <StorageMeter usage={storage.usage} quota={storage.quota} />
                                            {storage.persistent !== undefined && (
                                                <SheetChip tone={storage.persistent ? 'green' : 'orange'}>
                                                    {storage.persistent ? 'persistent' : 'not persistent'}
                                                </SheetChip>
                                            )}
                                        </button>
                                    </Popover.Target>
                                    <Popover.Dropdown aria-label="Storage details">
                                        <Stack gap={8}>
                                            <Text fw={600} size="sm">
                                                Projects live only in this browser.
                                            </Text>
                                            <Text size="sm" c="dimmed">
                                                {storage.persistent
                                                    ? 'The browser keeps them, even when it runs low on space.'
                                                    : 'The browser may delete them when it runs low on space. Ask it to keep them — the browser may show a prompt.'}
                                            </Text>
                                            <Group justify="space-between" className={classes.storageNumbers}>
                                                <span>{formatBytes(storage.usage)} used</span>
                                                {storage.quota !== undefined && (
                                                    <span>{formatBytes(storage.quota - storage.usage)} available</span>
                                                )}
                                            </Group>
                                            <StorageMeter usage={storage.usage} quota={storage.quota} />
                                            {storage.persistent === false && storage.canPersist && (
                                                <Button size="xs" color="dark" onClick={() => void storage.keep()}>
                                                    Keep my projects
                                                </Button>
                                            )}
                                            {storage.persistent === false && storage.keepDenied && (
                                                <Text size="xs" c="red" role="alert">
                                                    The browser declined to keep the projects. It decides on its own,
                                                    often based on how much you use this site; try again later or
                                                    bookmark the page.
                                                </Text>
                                            )}
                                            {storage.persistent === false && !storage.canPersist && (
                                                <Text size="xs" c="dimmed">
                                                    This browser cannot make storage persistent.
                                                </Text>
                                            )}
                                        </Stack>
                                    </Popover.Dropdown>
                                </Popover>
                            </div>
                        )}
                    </aside>
                    <div className={classes.results}>
                        <div className={classes.toolbar}>
                            <TextInput
                                className={classes.searchBox}
                                classNames={{input: classes.input}}
                                leftSection={<IconSearch size={15} />}
                                placeholder="Search name, description, example…"
                                aria-label="Search projects"
                                value={query}
                                onChange={(event) => setQuery(event.currentTarget.value)}
                            />
                            <Select
                                classNames={{input: classes.input}}
                                w={190}
                                leftSection={<span className={classes.sortLabel}>Sort</span>}
                                leftSectionWidth={44}
                                aria-label="Sort"
                                data={SORT_OPTIONS}
                                value={sort}
                                allowDeselect={false}
                                onChange={(value) => value && setSort(value as WorkspaceSort)}
                            />
                        </div>
                        <Text size="xs" c="dimmed" role="status">
                            {projects === undefined
                                ? 'Loading projects'
                                : `${shown.length} ${shown.length === 1 ? 'project' : 'projects'}`}
                        </Text>
                        <SheetGrid>
                            {shown.map((project) => (
                                <ProjectCard
                                    key={project.locator.projectPath}
                                    project={project}
                                    industry={project.origin ? industries.get(project.origin.id) : undefined}
                                    updateAvailable={project.origin ? isOutdated(project.origin, newest) : false}
                                    onOpen={() => onOpen(project.locator)}
                                    menu={
                                        <SheetActions>
                                            <Menu position="bottom-end" withinPortal>
                                                <Menu.Target>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="gray"
                                                        size="sm"
                                                        aria-label={`Menu of ${project.name}`}
                                                    >
                                                        <IconDotsVertical size={16} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Menu.Item onClick={() => onOpen(project.locator)}>Open</Menu.Item>
                                                    <Menu.Item onClick={() => setDialog({kind: 'rename', project})}>
                                                        Rename
                                                    </Menu.Item>
                                                    <Menu.Item onClick={() => void duplicate(project)}>
                                                        Duplicate
                                                    </Menu.Item>
                                                    <Menu.Item
                                                        color="red"
                                                        onClick={() => setDialog({kind: 'delete', project})}
                                                    >
                                                        Delete
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </SheetActions>
                                    }
                                />
                            ))}
                        </SheetGrid>
                        {projects && shown.length === 0 && <SheetEmpty>No project matches the filters.</SheetEmpty>}
                    </div>
                </div>
            )}

            {dialog?.kind === 'new' && (
                <ProjectDialog
                    title="New blank project"
                    submitLabel="Create"
                    initialName="Untitled project"
                    onCancel={() => setDialog(undefined)}
                    onSubmit={(name) => {
                        setDialog(undefined);
                        void createBlank(name);
                    }}
                />
            )}
            {dialog?.kind === 'rename' && (
                <ProjectDialog
                    title="Rename project"
                    submitLabel="Save"
                    initialName={dialog.project.name}
                    initialDescription={dialog.project.description ?? ''}
                    onCancel={() => setDialog(undefined)}
                    onSubmit={(name, description) => {
                        const {project} = dialog;
                        setDialog(undefined);
                        void rename(project, name, description);
                    }}
                />
            )}
            {dialog?.kind === 'delete' && (
                <Modal opened onClose={() => setDialog(undefined)} title="Delete project" size="sm">
                    <Text>
                        Delete <b>{dialog.project.name}</b> and its history? This cannot be undone.
                    </Text>
                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={() => setDialog(undefined)}>
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            onClick={() => {
                                const {project} = dialog;
                                setDialog(undefined);
                                void remove(project);
                            }}
                        >
                            Delete
                        </Button>
                    </Group>
                </Modal>
            )}
        </Stack>
    );
});
