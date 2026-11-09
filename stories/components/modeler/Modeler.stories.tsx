import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';
import {ModelerApp, type ModelerRoute, type StoryWorkspace} from '../../support/ModelerApp';
import {COPIES, openStoryWorkspace} from '../../support/workspaceStory';

interface ModelerArgs {
    route: ModelerRoute;
    seeded?: boolean; // the workspace holds the sample copies
    workspaceKey?: string; // a stored workspace that a reload reopens; not seeded
}

const meta: Meta<ModelerArgs> = {
    title: 'Modeler',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The pages of the hosted Modeler composed as `edgerules-modeler` does, over the published ' +
                    '`rimvydasb/edgerules-examples` index and an in-memory route (`npm run dev` runs the same pages under a ' +
                    'URL router). The stories need network access.',
            },
        },
    },
    loaders: [
        async ({args}) => ({
            workspace: args.workspaceKey
                ? await openStoryWorkspace([], `edgerules-storybook-modeler-${args.workspaceKey}`)
                : await openStoryWorkspace(args.seeded ? COPIES : []),
        }),
    ],
    render: (args, {loaded}) => <ModelerApp {...(loaded.workspace as StoryWorkspace)} initialRoute={args.route} />,
};
export default meta;

type Story = StoryObj<ModelerArgs>;

/** Home page: hero search, Get started for an empty workspace, industries, featured and new examples. */
export const Home: Story = {args: {route: {page: 'home'}}};

/** Home page with projects: "Continue" replaces "Get started". */
export const HomeWithProjects: Story = {args: {route: {page: 'home'}, seeded: true}};

/** Examples page: industry tabs, search, facets and example panels. "Copy and open" shows the copy in the Shell. */
export const Examples: Story = {args: {route: {page: 'examples'}}};

/** Example details page: version selector, README, metadata and related examples. */
export const ExampleDetailsPage: Story = {
    name: 'Example details',
    args: {route: {page: 'details', example: {id: 'loan-repayment', version: '1.2.0'}}},
};

/** Workspace page: the project grid with the origin and the last save time of each copy. */
export const Workspace: Story = {args: {route: {page: 'workspace'}, seeded: true}};

/** Project page: the Shell of a copy, with the project menu; the top bar, not the Shell, leads back to the Workspace. */
export const Project: Story = {
    args: {route: {page: 'workspace'}, seeded: true},
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('link', {name: /Loan repayment/}));
        await expect(await canvas.findByRole('button', {name: 'Project menu: Loan repayment'})).toBeTruthy();
    },
};

/** A fixture of the e2e specs: the Examples page over a stored workspace that a reload keeps (`workspaceKey` arg). */
export const StoredWorkspace: Story = {
    tags: ['fixture'],
    args: {route: {page: 'examples'}, workspaceKey: 'default'},
};
