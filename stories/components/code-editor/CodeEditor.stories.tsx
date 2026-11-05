import {useState, type ReactElement} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {init, MutableDecisionService} from '@edgerules/web/mutable';
import {CodeEditor} from '../../../src/components/code-editor';
import {INVALID_MODEL_DSL, VALID_MODEL_DSL} from '../../../src/components/code-editor/testing/model.dsl';
import {SAMPLE_README} from '../../../src/components/markdown-view/testing/sampleReadme';

async function buildService() {
    await init();
    return MutableDecisionService;
}

function StatefulCodeEditor({
    service,
    initialValue,
}: {
    service: typeof MutableDecisionService;
    initialValue: string;
}): ReactElement {
    const [value, setValue] = useState(initialValue);
    return <CodeEditor value={value} onChange={setValue} service={service} />;
}

const meta: Meta<typeof CodeEditor> = {
    title: 'Components/Code Editor/Code Editor',
    component: CodeEditor,
    parameters: {
        docs: {
            description: {
                component:
                    'EdgeRules code editor: syntax highlighting, engine diagnostics, Ctrl+Space completion, ' +
                    'Ctrl+Click / F12 go-to-definition, Shift-Alt-F formatting.',
            },
        },
    },
};

export default meta;

type Story = StoryObj<typeof CodeEditor>;

export const Default: Story = {
    loaders: [async () => ({service: await buildService()})],
    render: (_args, {loaded}) => (
        <StatefulCodeEditor service={loaded.service as typeof MutableDecisionService} initialValue={VALID_MODEL_DSL} />
    ),
};

export const WithSyntaxError: Story = {
    loaders: [async () => ({service: await buildService()})],
    render: (_args, {loaded}) => (
        <StatefulCodeEditor
            service={loaded.service as typeof MutableDecisionService}
            initialValue={INVALID_MODEL_DSL}
        />
    ),
};

function StatefulMarkdownEditor({initialValue}: {initialValue: string}): ReactElement {
    const [value, setValue] = useState(initialValue);
    return <CodeEditor language="markdown" value={value} onChange={setValue} />;
}

// Markdown source with highlighting; `edgerules` fences are highlighted as DSL. No service, no diagnostics.
export const Markdown: Story = {
    render: () => <StatefulMarkdownEditor initialValue={SAMPLE_README} />,
};
