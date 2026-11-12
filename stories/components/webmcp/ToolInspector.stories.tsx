import {useEffect, useRef, useState, type ReactElement} from 'react';
import {Button, Code, Group, Select, Stack, Text, Textarea} from '@mantine/core';
import {MutableDecisionService} from '@edgerules/web/mutable';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {ProjectProvider, type ProjectSession, type TestSuitesDocument} from '../../../src/components/project-session';
import {Shell, type ShellView} from '../../../src/components/shell';
import {registerProjectTools, type ProjectToolsHandle} from '../../../src/components/webmcp';
import {
    createRecordingModelContext,
    type RecordingModelContext,
} from '../../../src/components/webmcp/testing/recordingModelContext';
import {openStoryProject} from '../../support/storyProject';

// The model and tests of `webmcp/testing/toolsFixture.ts`, which runs on `@edgerules/node` and so stays out of the
// browser: `risk` passes both cases, the model case `unused-is-two` always fails.
const LOAN_MODEL = `{
    func risk(age: number): { level: if age < 25 then "high" else "low" }
    applicant: { age: 30, income: 5000 }
    decision: risk(applicant.age)
    unused: 1
}`;

const LOAN_TESTS: TestSuitesDocument = {
    schemaVersion: 1,
    subjects: {
        risk: {
            cases: [
                {id: 'young', name: 'Young', order: 0, inputs: {age: '20'}, assertions: {level: 'high'}},
                {id: 'senior', name: 'Senior', order: 1, inputs: {age: '60'}, assertions: {level: 'low'}},
            ],
            rows: [
                {path: 'age', section: 'inputs', order: 0, type: 'number', present: true},
                {path: 'level', section: 'assertions', order: 0, type: 'string', present: true},
            ],
        },
        '*': {
            cases: [{id: 'unused-is-two', name: 'Unused is two', order: 0, inputs: {}, assertions: {unused: '2'}}],
            rows: [{path: 'unused', section: 'assertions', order: 0, type: 'number', present: true}],
        },
    },
};

// A first input for each tool, so a run shows a result without typing.
const SAMPLE_INPUTS: Record<string, object> = {
    'edit-model': {operations: [{op: 'set', path: 'unused', code: '2'}]},
    'edit-tests': {
        subject: 'risk',
        operations: [{op: 'add', name: 'Middle', inputs: {age: '25'}, assertions: {level: 'low'}}],
    },
    'set-documentation': {items: [{path: 'risk', text: 'The risk level of an applicant by age.'}]},
    'undo-agent-change': {changeId: 'ac-1'},
    'read-source': {path: 'risk'},
    'search-model': {query: 'age'},
    'list-tests': {subject: 'risk'},
    'evaluate-model': {target: 'decision'},
    'open-in-editor': {path: 'risk', view: 'code'},
};

const sampleInput = (name: string | null) => JSON.stringify((name && SAMPLE_INPUTS[name]) ?? {}, null, 2);

interface ToolInspectorProps {
    session: ProjectSession;
    readOnly?: boolean;
}

// Registers the project tools on an in-memory model context, as the browser would, and runs one tool with a JSON
// input. The result is the JSON that the agent receives. The Shell beside it shows each change with a toast, and
// `open-in-editor` navigates it.
function ToolInspector({session, readOnly = false}: ToolInspectorProps): ReactElement {
    const [modelContext, setModelContext] = useState<RecordingModelContext>();
    const [handle, setHandle] = useState<ProjectToolsHandle>();
    const [name, setName] = useState<string | null>(null);
    const [input, setInput] = useState('{}');
    const [output, setOutput] = useState('');
    const [path, setPath] = useState('*');
    const [view, setView] = useState<ShellView>('boxed');
    const focus = useRef({path, view});
    focus.current = {path, view};

    useEffect(() => {
        const recording = createRecordingModelContext();
        const registered = registerProjectTools({
            modelContext: recording,
            session,
            readOnly,
            navigation: {
                getFocus: () => focus.current,
                open: (nextPath, nextView) => {
                    setPath(nextPath);
                    setView(nextView);
                },
            },
        });
        const first = recording.names()[0] ?? null;
        setModelContext(recording);
        setHandle(registered);
        setName(first);
        setInput(sampleInput(first));
        return () => registered.dispose();
    }, [session, readOnly]);

    const tool = name ? modelContext?.tool(name) : undefined;

    const select = (next: string | null): void => {
        setName(next);
        setInput(sampleInput(next));
        setOutput('');
    };

    const run = (): void => {
        if (!modelContext || !name) return;
        let parsed: object;
        try {
            parsed = JSON.parse(input) as object;
        } catch (error) {
            setOutput(`Input is not JSON: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        modelContext.call(name, parsed).then(
            (result) => setOutput(JSON.stringify(result, null, 2)),
            (error: unknown) => setOutput(`Rejected: ${error instanceof Error ? error.message : String(error)}`),
        );
    };

    return (
        <ProjectProvider session={session}>
            <div style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: 16, height: '85vh'}}>
                <Stack gap="xs" style={{overflow: 'auto'}}>
                    <Select
                        label="Tool"
                        data={modelContext?.names() ?? []}
                        value={name}
                        onChange={select}
                        allowDeselect={false}
                        data-testid="tool-select"
                    />
                    {tool && (
                        <Text size="sm" c="dimmed">
                            {tool.description}
                        </Text>
                    )}
                    <Textarea
                        label="Input (JSON)"
                        value={input}
                        onChange={(event) => setInput(event.currentTarget.value)}
                        autosize
                        minRows={2}
                        styles={{input: {fontFamily: 'var(--mantine-font-family-monospace)'}}}
                        data-testid="tool-input"
                    />
                    <Group>
                        <Button size="compact-sm" onClick={run} disabled={!tool}>
                            Run
                        </Button>
                    </Group>
                    {output && (
                        <Code block data-testid="tool-output">
                            {output}
                        </Code>
                    )}
                </Stack>
                <Shell
                    languageService={MutableDecisionService}
                    path={path}
                    onPathChange={setPath}
                    view={view}
                    onViewChange={setView}
                    readOnly={readOnly}
                    agentActivity={handle?.activity}
                />
            </div>
        </ProjectProvider>
    );
}

const meta: Meta = {
    title: 'Services/WebMCP Tools',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The WebMCP tools of an open project, registered with `registerProjectTools` on an in-memory ' +
                    'model context. Pick a tool, enter its input as JSON and run it to see the result the agent ' +
                    'gets. The Shell beside it shows each agent change with a toast and its "Undo", and ' +
                    '`open-in-editor` navigates it.',
            },
        },
    },
};

export default meta;

type Story = StoryObj;

const loadLoanProject = async () => ({
    session: await openStoryProject({name: 'Loans', model: {dsl: LOAN_MODEL}, tests: LOAN_TESTS}),
});

/** The loan model with one passing subject (`risk`) and one failing model case. Run `edit-model`: the toast shows the
 * regression totals, and "Undo" reverts the change. */
export const LoanProject: Story = {
    loaders: [loadLoanProject],
    render: (_args, {loaded}) => <ToolInspector session={loaded.session as ProjectSession} />,
};

/** A read-only project: only the read tools and `open-in-editor` are registered. */
export const ReadOnly: Story = {
    loaders: [loadLoanProject],
    render: (_args, {loaded}) => <ToolInspector session={loaded.session as ProjectSession} readOnly />,
};
