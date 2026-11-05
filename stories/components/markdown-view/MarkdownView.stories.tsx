import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MarkdownView} from '../../../src/components/markdown-view';
import {SAMPLE_README} from '../../../src/components/markdown-view/testing/sampleReadme';

const meta: Meta<typeof MarkdownView> = {
    title: 'Components/Markdown View',
    component: MarkdownView,
    args: {markdown: SAMPLE_README, onModelLink: fn()},
    parameters: {
        docs: {
            description: {
                component:
                    'Read-only GitHub Flavored Markdown, such as a project README. Raw HTML is dropped; only ' +
                    '`https`, `mailto`, `model:` and relative URLs are kept. `model:` links call `onModelLink`, ' +
                    'relative URLs go through `resolveUrl`, and `edgerules` fences are highlighted.',
            },
        },
    },
    decorators: [(Story) => <div style={{maxWidth: 760}}>{Story()}</div>],
};

export default meta;

type Story = StoryObj<typeof MarkdownView>;

export const Readme: Story = {};

export const WithoutModelLinks: Story = {
    args: {onModelLink: undefined},
};

export const ResolvedRelativeUrls: Story = {
    args: {
        resolveUrl: (relative) =>
            `https://raw.githubusercontent.com/edgerules/edgerules-examples/main/loan-repayment/${relative}`,
    },
};

export const UnsafeContent: Story = {
    args: {
        markdown: [
            '# Unsafe content',
            '',
            '<div style="color: red">This raw HTML block is dropped.</div>',
            '',
            'Inline <b>tags</b> are dropped and their text is kept.',
            '',
            '- [A javascript: link](javascript:alert(1)) renders as text.',
            '- [An http: link](http://example.com) renders as text.',
            '- [A protocol-relative link](//example.com) renders as text.',
        ].join('\n'),
    },
};
