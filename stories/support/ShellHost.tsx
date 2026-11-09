import '@xyflow/react/dist/style.css';
import {useState, type ReactElement} from 'react';
import {Button, Code, Group, Text} from '@mantine/core';
import type {ArgTypes, Meta} from '@storybook/react-vite';
import {MutableDecisionService} from '@edgerules/web/mutable';
import {
    ProjectProvider,
    useProjectSession,
    useProjectSnapshot,
    type ProjectSession,
} from '../../src/components/project-session';
import {Shell, type ShellNavigation, type ShellView} from '../../src/components/shell';

export interface ShellHostArgs {
    defaultPath?: string;
    defaultView?: ShellView;
    readOnly?: boolean;
    defaultExplorerOpen?: boolean;
    controlled?: boolean; // the host holds the path and the view, and prints them
    saveable?: boolean; // the host has a Save button and prints the save state of the session
    navigation?: 'copy' | 'own'; // the Workspace crumb and the project menu; a copy has an origin chip
    projectKey?: string; // with `openStoredStoryProject`: the stored project the story reopens after a reload
}

/** The Save button of a host page, and the save state of the session: its revision and its dirty slices. */
function SaveBar(): ReactElement {
    const session = useProjectSession();
    const {revision, dirtySlices, phase} = useProjectSnapshot();
    return (
        <Group gap="md" mb="xs">
            <Button size="compact-sm" disabled={dirtySlices.length === 0} onClick={() => void session.save()}>
                Save
            </Button>
            <Text size="xs" data-testid="host-save-state">
                {phase} · revision <Code>{revision}</Code> · dirty: {dirtySlices.join(', ') || 'none'}
            </Text>
        </Group>
    );
}

/** The Shell as a host page embeds it: full height, with the host state printed above it when `controlled`. */
export function ShellHost({
    defaultPath,
    defaultView,
    readOnly,
    defaultExplorerOpen,
    controlled,
    saveable,
    navigation,
}: ShellHostArgs): ReactElement {
    const [path, setPath] = useState(defaultPath ?? '*');
    const [view, setView] = useState<ShellView>(defaultView ?? 'boxed');
    const [forwarded, setForwarded] = useState<string>();
    const [navigated, setNavigated] = useState<string>();
    const shellNavigation: ShellNavigation | undefined = navigation && {
        onBrowseExamples: () => setNavigated('examples'),
        onOpenProject: (locator) => setNavigated(`project ${locator.projectPath}`),
        onShowOrigin: (origin) => setNavigated(`example ${origin.id}@${origin.version}`),
        onDuplicate: () => setNavigated('duplicate'),
        ...(navigation === 'copy' && {originStatus: 'update-available' as const}),
        recentProjects: ['Claims triage', 'My pricing'].map((name, index) => ({
            projectId: `recent-${index}`,
            name,
            tags: [],
            locator: {provider: 'indexeddb', resource: 'story', projectPath: `recent-${index}`},
            headRevision: '1',
            savedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
        })),
    };
    return (
        <div style={{height: '100vh', display: 'flex', flexDirection: 'column', padding: 12, boxSizing: 'border-box'}}>
            {controlled && (
                <Group gap="md" mb="xs" data-testid="host-state">
                    <Text size="xs">
                        path <Code>{path}</Code>
                    </Text>
                    <Text size="xs">
                        view <Code>{view}</Code>
                    </Text>
                    {forwarded && (
                        <Text size="xs">
                            forwarded to the host <Code>{forwarded}</Code>
                        </Text>
                    )}
                </Group>
            )}
            {navigated && (
                <Text size="xs" mb="xs" data-testid="host-navigated">
                    host navigates to <Code>{navigated}</Code>
                </Text>
            )}
            {saveable && <SaveBar />}
            <div style={{flex: 1, minHeight: 0}}>
                <Shell
                    languageService={MutableDecisionService}
                    readOnly={readOnly}
                    defaultExplorerOpen={defaultExplorerOpen}
                    {...(controlled
                        ? {path, onPathChange: setPath, view, onViewChange: setView}
                        : {defaultPath, defaultView})}
                    navigation={shellNavigation}
                    onOpenNode={(target) => setForwarded(`${target.kind} ${target.path}`)}
                />
            </div>
        </div>
    );
}

/** Controls of the Shell's initial state: changing one remounts the Shell over the same project session. */
export const SHELL_HOST_ARG_TYPES: Partial<ArgTypes<ShellHostArgs>> = {
    navigation: {
        control: 'inline-radio',
        options: [undefined, 'copy', 'own'],
        description: 'The Workspace crumb and the project menu; `copy` adds the origin chip',
    },
    defaultPath: {
        control: 'text',
        description: 'The path the Shell opens: `*`, `applicant`, `riskScore`…, or the document `doc:README.md`',
    },
    defaultView: {control: 'inline-radio', options: ['boxed', 'code', 'flow', 'tests', 'preview']},
    readOnly: {control: 'boolean'},
    defaultExplorerOpen: {control: 'boolean'},
    controlled: {table: {disable: true}},
    saveable: {table: {disable: true}},
    projectKey: {control: 'text', description: 'The stored project a reload reopens'},
};

/** Renders a story's Shell over the project session its loader opened (`loaded.session`). */
export const renderShellHost: NonNullable<Meta<typeof ShellHost>['render']> = (args, {loaded}) => {
    return (
        <ProjectProvider session={loaded.session as ProjectSession}>
            {/* The Shell reads its `default*` props on mount only: a new key applies a changed control. */}
            <ShellHost key={JSON.stringify(args)} {...args} />
        </ProjectProvider>
    );
};
