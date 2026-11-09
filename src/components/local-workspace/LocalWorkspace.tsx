import {forwardRef, useCallback, useImperativeHandle, useState, type ReactElement} from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Card,
    Group,
    Menu,
    Modal,
    Select,
    SimpleGrid,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
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

    return (
        <Stack gap="md" data-testid="local-workspace">
            <Group align="flex-end" wrap="wrap">
                <Text fw={700} size="xl">
                    Workspace
                </Text>
                <TextInput
                    placeholder="Search projects"
                    aria-label="Search projects"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                />
                <Select
                    aria-label="Source"
                    data={SOURCE_OPTIONS}
                    value={source}
                    allowDeselect={false}
                    onChange={(value) => value && setSource(value as WorkspaceSource)}
                />
                <Select
                    aria-label="Sort"
                    data={SORT_OPTIONS}
                    value={sort}
                    allowDeselect={false}
                    onChange={(value) => value && setSort(value as WorkspaceSort)}
                />
            </Group>

            {(loadError ?? actionError) && (
                <Alert color="red" role="alert">
                    {loadError ?? actionError}
                </Alert>
            )}
            {storage.persistent === false && (
                <Alert color="yellow" role="status">
                    The browser may delete these projects when it runs low on space. Projects live only in this browser
                    profile.
                </Alert>
            )}

            <SimpleGrid cols={{base: 1, sm: 2, lg: 3, xl: 4}}>
                <Card withBorder padding="md" aria-label="New project">
                    <Text fw={600}>+ New project</Text>
                    <Stack gap={4} mt="xs" align="flex-start">
                        <Button variant="subtle" size="compact-sm" onClick={() => setDialog({kind: 'new'})}>
                            Blank project
                        </Button>
                        {onBrowseExamples && (
                            <Button variant="subtle" size="compact-sm" onClick={onBrowseExamples}>
                                From example →
                            </Button>
                        )}
                    </Stack>
                </Card>
                {shown.map((project) => (
                    <Card key={project.locator.projectPath} withBorder padding="md" data-testid="project-panel">
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <Text
                                fw={600}
                                truncate
                                role="link"
                                tabIndex={0}
                                style={{cursor: 'pointer'}}
                                onClick={() => onOpen(project.locator)}
                                onKeyDown={(event) => event.key === 'Enter' && onOpen(project.locator)}
                            >
                                {project.name}
                            </Text>
                            <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                    <ActionIcon variant="subtle" aria-label={`Menu of ${project.name}`}>
                                        ⋮
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item onClick={() => onOpen(project.locator)}>Open</Menu.Item>
                                    <Menu.Item onClick={() => setDialog({kind: 'rename', project})}>Rename</Menu.Item>
                                    <Menu.Item onClick={() => void duplicate(project)}>Duplicate</Menu.Item>
                                    <Menu.Item color="red" onClick={() => setDialog({kind: 'delete', project})}>
                                        Delete
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>
                        {project.description && (
                            <Text size="sm" c="dimmed" lineClamp={2}>
                                {project.description}
                            </Text>
                        )}
                        <Text size="xs" c="dimmed" mt="xs">
                            {project.origin ? `from ${project.origin.id}@${project.origin.version}` : 'Own project'}
                            {project.origin && isOutdated(project.origin, newest) && (
                                <Badge ml="xs" size="xs" color="yellow" variant="light">
                                    Update available
                                </Badge>
                            )}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {savedAgo(project.savedAt)}
                        </Text>
                    </Card>
                ))}
            </SimpleGrid>

            {empty && (
                <Stack gap="xs" align="center" data-testid="workspace-empty">
                    <Text fw={600}>No projects yet</Text>
                    <Group>
                        {onBrowseExamples && <Button onClick={onBrowseExamples}>Browse examples</Button>}
                        <Button variant="default" onClick={() => setDialog({kind: 'new'})}>
                            New project
                        </Button>
                    </Group>
                </Stack>
            )}
            {projects && !empty && shown.length === 0 && <Text c="dimmed">No project matches the filters.</Text>}

            {storage.usage !== undefined && (
                <Text size="xs" c="dimmed" data-testid="workspace-storage">
                    Storage: {formatBytes(storage.usage)} used
                    {storage.quota !== undefined && ` of ${formatBytes(storage.quota)}`}
                    {storage.persistent !== undefined && (
                        <Badge ml="xs" size="xs" variant="light" color={storage.persistent ? 'green' : 'yellow'}>
                            {storage.persistent ? 'persistent' : 'not persistent'}
                        </Badge>
                    )}
                </Text>
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
