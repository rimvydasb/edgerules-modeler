import {forwardRef, useCallback, useImperativeHandle, useState, type ReactElement} from 'react';
import {ActionIcon, Alert, Button, Group, Menu, Modal, Select, Stack, Text, TextInput} from '@mantine/core';
import {
    IconBooks,
    IconDatabase,
    IconDotsVertical,
    IconExternalLink,
    IconFile,
    IconFolders,
    IconPlus,
    IconSearch,
    IconSitemap,
} from '@tabler/icons-react';
import {KIND_COLORS} from '#ui/kindColors';
import {
    SheetAction,
    SheetActions,
    SheetBody,
    SheetChip,
    SheetDescription,
    SheetEmpty,
    SheetGrid,
    SheetMeta,
    SheetPageHeader,
    SheetPanel,
    SheetPanelHeader,
    SheetToken,
    SheetToolbar,
    sheetClasses,
} from '#ui/sheet';
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
import {isOutdated, useNewestVersions} from './useNewestVersions';
import {useWorkspaceStorage} from './useWorkspaceStorage';
import * as classes from './localWorkspace.module.css';
import {formatBytes, savedAgo, visibleProjects, type WorkspaceSort, type WorkspaceSource} from './workspaceModel';

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
    {value: 'all', label: 'All'},
    {value: 'examples', label: 'From examples'},
    {value: 'own', label: 'Own projects'},
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
    const count = projects?.length ?? 0;

    return (
        <Stack gap="md" data-testid="local-workspace">
            <SheetPageHeader
                icon={<IconFolders size={22} />}
                iconColor={KIND_COLORS.model}
                title="Workspace"
                subtitle={
                    projects === undefined
                        ? 'Loading projects'
                        : `${count} ${count === 1 ? 'project' : 'projects'} in this browser`
                }
                aside={
                    storage.usage !== undefined && (
                        <span className={classes.storage} data-testid="workspace-storage">
                            <IconDatabase size={14} aria-hidden="true" />
                            {formatBytes(storage.usage)} used
                            {storage.quota !== undefined && ` of ${formatBytes(storage.quota)}`}
                            {storage.persistent !== undefined && (
                                <SheetChip tone={storage.persistent ? 'green' : 'yellow'}>
                                    {storage.persistent ? 'persistent' : 'not persistent'}
                                </SheetChip>
                            )}
                        </span>
                    )
                }
            >
                <SheetToolbar>
                    <TextInput
                        className={sheetClasses.toolbarGrow}
                        size="xs"
                        leftSection={<IconSearch size={14} />}
                        placeholder="Search projects"
                        aria-label="Search projects"
                        value={query}
                        onChange={(event) => setQuery(event.currentTarget.value)}
                    />
                    <Select
                        size="xs"
                        w={150}
                        aria-label="Source"
                        data={SOURCE_OPTIONS}
                        value={source}
                        allowDeselect={false}
                        onChange={(value) => value && setSource(value as WorkspaceSource)}
                    />
                    <Select
                        size="xs"
                        w={140}
                        aria-label="Sort"
                        data={SORT_OPTIONS}
                        value={sort}
                        allowDeselect={false}
                        onChange={(value) => value && setSort(value as WorkspaceSort)}
                    />
                </SheetToolbar>
            </SheetPageHeader>

            {(loadError ?? actionError) && (
                <Alert color="red" role="alert">
                    {loadError ?? actionError}
                </Alert>
            )}
            {storage.persistent === false && (
                <Alert color="yellow" role="status" py={6}>
                    The browser may delete these projects when it runs low on space. Projects live only in this browser
                    profile.
                </Alert>
            )}

            {empty ? (
                <SheetEmpty data-testid="workspace-empty">
                    <Text fw={600} c="var(--mantine-color-text)">
                        No projects yet
                    </Text>
                    <Text size="sm">Copy an example from the library, or start from an empty model.</Text>
                    <Group>
                        {onBrowseExamples && <Button onClick={onBrowseExamples}>Browse examples</Button>}
                        <Button variant="default" onClick={() => setDialog({kind: 'new'})}>
                            New project
                        </Button>
                    </Group>
                </SheetEmpty>
            ) : (
                <SheetGrid>
                    <SheetPanel aria-label="New project" className={classes.newPanel}>
                        <SheetPanelHeader icon={<IconPlus size={18} />} title="New project" />
                        <div className={classes.newOptions}>
                            <button
                                type="button"
                                className={classes.newOption}
                                onClick={() => setDialog({kind: 'new'})}
                            >
                                <IconFile size={18} aria-hidden="true" />
                                <span>
                                    <span className={classes.newOptionTitle}>Blank project</span>
                                    <span className={classes.newOptionHint}>Start from an empty model</span>
                                </span>
                            </button>
                            {onBrowseExamples && (
                                <button type="button" className={classes.newOption} onClick={onBrowseExamples}>
                                    <IconBooks size={18} aria-hidden="true" />
                                    <span>
                                        <span className={classes.newOptionTitle}>From example →</span>
                                        <span className={classes.newOptionHint}>Copy a model of the library</span>
                                    </span>
                                </button>
                            )}
                        </div>
                    </SheetPanel>
                    {shown.map((project) => (
                        <SheetPanel key={project.locator.projectPath} data-testid="project-panel">
                            <SheetPanelHeader
                                icon={<IconSitemap size={18} />}
                                iconColor={KIND_COLORS.model}
                                title={
                                    <button
                                        type="button"
                                        role="link"
                                        className={sheetClasses.titleLink}
                                        onClick={() => onOpen(project.locator)}
                                    >
                                        <span className={sheetClasses.titleText}>{project.name}</span>
                                    </button>
                                }
                                aside={
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
                                            <Menu.Item onClick={() => void duplicate(project)}>Duplicate</Menu.Item>
                                            <Menu.Item color="red" onClick={() => setDialog({kind: 'delete', project})}>
                                                Delete
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                }
                            />
                            <SheetBody>
                                <SheetDescription>{project.description || <i>No description</i>}</SheetDescription>
                                <SheetMeta>
                                    {project.origin ? (
                                        <SheetToken>
                                            from {project.origin.id}@{project.origin.version}
                                        </SheetToken>
                                    ) : (
                                        <SheetChip tone="gray">Own project</SheetChip>
                                    )}
                                    {project.origin && isOutdated(project.origin, newest) && (
                                        <SheetChip tone="yellow">Update available</SheetChip>
                                    )}
                                    <span className={classes.saved}>{savedAgo(project.savedAt)}</span>
                                </SheetMeta>
                            </SheetBody>
                            <SheetActions>
                                <SheetAction
                                    primary
                                    icon={<IconExternalLink size={14} />}
                                    onClick={() => onOpen(project.locator)}
                                >
                                    Open
                                </SheetAction>
                            </SheetActions>
                        </SheetPanel>
                    ))}
                </SheetGrid>
            )}
            {projects && !empty && shown.length === 0 && <SheetEmpty>No project matches the filters.</SheetEmpty>}

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
