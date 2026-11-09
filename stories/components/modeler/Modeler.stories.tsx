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

/** Home page: the search box and the featured examples; the Workspace section appears once projects exist. */
export const Home: Story = {args: {route: {page: 'home'}}};

/** Home page with projects: the Workspace section lists the 3 newest. */
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

/** Project page: the Shell of a copy, with the project menu; its tab in the top bar stays as a shortcut until closed. */
export const Project: Story = {
    args: {route: {page: 'workspace'}, seeded: true},
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('link', {name: /Loan repayment/}));
        await expect(await canvas.findByRole('button', {name: 'Project menu: Loan repayment'})).toBeTruthy();

        // The project tab sits right of Workspace, stays when the user leaves the project and closes back to Workspace.
        const nav = canvas.getByRole('navigation', {name: 'Modeler'});
        const tab = within(nav).getByRole('button', {name: 'Loan repayment'});
        await expect(tab.getAttribute('aria-current')).toBe('page');
        await userEvent.click(within(nav).getByRole('button', {name: 'Examples'}));
        await expect(within(nav).getByRole('button', {name: 'Loan repayment'}).getAttribute('aria-current')).toBeNull();
        await userEvent.click(within(nav).getByRole('button', {name: 'Loan repayment'}));
        await userEvent.click(await within(nav).findByRole('button', {name: 'Close Loan repayment'}));
        await expect(within(nav).queryByRole('button', {name: 'Loan repayment'})).toBeNull();
        await expect(within(nav).getByRole('button', {name: 'Workspace'}).getAttribute('aria-current')).toBe('page');
    },
};

/** A fixture of the e2e specs: the Examples page over a stored workspace that a reload keeps (`workspaceKey` arg). */
export const StoredWorkspace: Story = {
    tags: ['fixture'],
    args: {route: {page: 'examples'}, workspaceKey: 'default'},
};
