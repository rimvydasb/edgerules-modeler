import {useEffect, useState, type ReactElement} from 'react';
import {Button, Code, Group, Select, Stack, Text, Textarea} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {ProjectSession, TestSuitesDocument} from '../../../src/components/project-session';
import {registerProjectTools} from '../../../src/components/webmcp';
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

interface ToolInspectorProps {
    session: ProjectSession;
}

// Registers the project tools on an in-memory model context, as the browser would, and runs one tool with a JSON
// input. The result is the JSON that the agent receives.
function ToolInspector({session}: ToolInspectorProps): ReactElement {
    const [modelContext, setModelContext] = useState<RecordingModelContext>();
    const [name, setName] = useState<string | null>(null);
    const [input, setInput] = useState('{}');
    const [output, setOutput] = useState('');

    useEffect(() => {
        const recording = createRecordingModelContext();
        const handle = registerProjectTools({modelContext: recording, session});
        setModelContext(recording);
        setName(recording.names()[0] ?? null);
        return () => handle.dispose();
    }, [session]);

    const tool = name ? modelContext?.tool(name) : undefined;

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
        <Stack gap="xs" maw={720}>
            <Select
                label="Tool"
                data={modelContext?.names() ?? []}
                value={name}
                onChange={setName}
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
    );
}

const meta: Meta = {
    title: 'Services/WebMCP Tools',
    parameters: {
        docs: {
            description: {
                component:
                    'The WebMCP tools of an open project, registered with `registerProjectTools` on an in-memory ' +
                    'model context. Pick a tool, enter its input as JSON and run it to see the result the agent gets.',
            },
        },
    },
};

export default meta;

type Story = StoryObj;

/** The loan model with one passing subject (`risk`) and one failing model case: run `run-tests`. */
export const LoanProject: Story = {
    loaders: [
        async () => ({
            session: await openStoryProject({name: 'Loans', model: {dsl: LOAN_MODEL}, tests: LOAN_TESTS}),
        }),
    ],
    render: (_args, {loaded}) => <ToolInspector session={loaded.session as ProjectSession} />,
};
