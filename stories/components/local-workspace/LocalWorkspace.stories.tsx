import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, fn, userEvent, within} from 'storybook/test';
import {LocalWorkspace, type LocalWorkspaceProps} from '../../../src/components/local-workspace';
import {COPIES, openStoryWorkspace} from '../../support/workspaceStory';

type Loaded = Awaited<ReturnType<typeof openStoryWorkspace>>;

const meta: Meta<LocalWorkspaceProps> = {
    title: 'Components/Local Workspace',
    component: LocalWorkspace,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The projects of the user in one IndexedDB repository: search, sort, source filter, open, new, ' +
                    'duplicate, rename and delete. The host owns the routes and gets `onOpen` and `onBrowseExamples`.',
            },
        },
    },
    args: {onOpen: fn(), onBrowseExamples: fn()},
    render: (args, {loaded}) => <LocalWorkspace {...args} {...(loaded as Loaded)} />,
};
export default meta;

type Story = StoryObj<LocalWorkspaceProps>;

export const EmptyWorkspace: Story = {
    loaders: [async () => openStoryWorkspace()],
};

export const WorkspaceWithCopies: Story = {
    loaders: [async () => openStoryWorkspace(COPIES)],
};

export const DeleteConfirm: Story = {
    loaders: [async () => openStoryWorkspace(COPIES)],
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('button', {name: 'Menu of Claims triage'}));
        await userEvent.click(await within(document.body).findByRole('menuitem', {name: 'Delete'}));
        await expect(await within(document.body).findByText(/This cannot be undone/)).toBeTruthy();
    },
};
