import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';
import {renderShellHost, SHELL_HOST_ARG_TYPES, ShellHost} from '../../support/ShellHost';
import {openStoredStoryProject, openStoryProject} from '../../support/storyProject';

// The sample model of docs/model-decomposition.md. `risk` is an invocation, so the Flow view shows it as a
// FunctionNode; `applicant.calculateAge` shows a function root path.
const SAMPLE_MODEL = `{
  type Customer: { name: <string>; income: <number, 0> }
  func riskScore(income: number): { score: income / 100 }
  @InputNode
  applicant: {
    age: 21
    address: {
      city: "Vilnius"
      zip: "01100"
    }
    func calculateAge(year: number): { result: 2026 - year }
  }
  @FunctionNode
  risk: riskScore(applicant.age)
  limit: riskScore(applicant.age).score
}`;

// A project with an entity of every Project Explorer section: a service method, a workbook with its nodes, and tests.
const PROJECT_MODEL = `{
  type Customer: { name: <string>; income: <number, 0> }
  func riskScore(income: number): { score: income / 100 }
  service processApplication(income: number): { result: riskScore(income).score }
  ruleset band(age: number): {
    hitPolicy: "first-match"
    rules: [{ when: { age: < 30 }, then: { level: "young" } }]
    default: { level: "none" }
  }
  limit: 1000
  workbook loanBook: {
    @InputNode(name: "Applicant")
    applicant: { income: 5000 }
    @FunctionNode
    decision: riskScore(income: applicant.income)
  }
}`;

const meta: Meta<typeof ShellHost> = {
    title: 'Components/Shell',
    component: ShellHost,
    parameters: {layout: 'fullscreen'},
    argTypes: SHELL_HOST_ARG_TYPES,
    loaders: [async () => ({session: await openStoryProject({name: 'Shell story', model: {dsl: SAMPLE_MODEL}})})],
    render: renderShellHost,
};
export default meta;

type Story = StoryObj<typeof ShellHost>;

/**
 * The sample model. Use the controls to open another path or view: `applicant` in the Code view (an edit commits
 * after 500 ms without typing), the function path `applicant.calculateAge` (the breadcrumb ends with
 * `calculateAge(...)`), the Flow view, a collapsed Project Explorer, or read-only editors.
 */
export const Default: Story = {args: {defaultPath: '*', defaultView: 'boxed', defaultExplorerOpen: true}};

/** The host holds the path and the view; drill-downs the Shell does not open go to the host. */
export const Controlled: Story = {
    args: {controlled: true, defaultPath: 'applicant.address'},
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByRole('button', {name: 'applicant'}));
        await expect(canvas.getByTestId('host-state')).toHaveTextContent('path applicant');
        await userEvent.click(canvas.getByText('Code'));
        await expect(canvas.getByTestId('host-state')).toHaveTextContent('view code');
    },
};

/**
 * The Project Explorer of a whole project, in the Flow view. The workbook opens as the Flow root, a click on its
 * `decision` node centers that node, and the tests of `riskScore` open in the Tests view.
 */
export const Project: Story = {
    args: {defaultExplorerOpen: true, defaultView: 'flow'},
    loaders: [
        async () => {
            const session = await openStoryProject({name: 'Shell project story', model: {dsl: PROJECT_MODEL}});
            session.tests.forSubject('riskScore').addTestCase();
            return {session};
        },
    ],
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        const explorer = await canvas.findByRole('navigation', {name: 'Project explorer'});
        await userEvent.click(within(explorer).getByText('loanBook'));
        await expect(canvas.getByRole('radio', {name: 'Flow'})).toHaveAttribute('aria-checked', 'true');
        await userEvent.click(await within(explorer).findByText('decision'));
        await expect(canvas.getByRole('radio', {name: 'Flow'})).toHaveAttribute('aria-checked', 'true');
        // The second `riskScore()` is the entry of the Tests section.
        await userEvent.click(within(explorer).getAllByText('riskScore()')[1]!);
        await expect(await canvas.findByRole('radio', {name: 'Tests'})).toHaveAttribute('aria-checked', 'true');
    },
};

/**
 * The split view of the Flow view, on by default. The toggle right of Tests closes it. It shows the selected node beside
 * the canvas: the `decision` node as the body of `riskScore` in a Boxed Editor, the output node as the data wired into
 * it. A click on the empty canvas closes the panel. The `Expand` button of the Boxed Editor opens it in the Boxed view.
 */
export const SplitScreen: Story = {
    args: {defaultPath: 'loanBook', defaultView: 'flow', defaultExplorerOpen: false},
    loaders: [
        async () => ({
            session: await openStoryProject({
                name: 'Shell split screen story',
                model: {dsl: PROJECT_MODEL},
                flow: {
                    schemaVersion: 2,
                    layouts: {
                        loanBook: {
                            positions: {},
                            outputs: [
                                {id: 'output', label: 'Decision', source: {node: 'loanBook.decision', handle: 'out:*'}},
                            ],
                        },
                    },
                },
            }),
        }),
    ],
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await userEvent.click(await canvas.findByTestId('function-node-loanBook.decision'));
        const panel = await canvas.findByTestId('shell-split-panel');
        await expect(within(panel).getByTestId('row-riskScore.score')).toBeInTheDocument();
    },
};

// The README of the sample project: a `model:` link opens that model path.
const SAMPLE_README = `# Shell story

The sample model of the Shell stories. [riskScore](model:riskScore) scores an income; the
[applicant](model:applicant) is the input.

| Field     | Meaning                 |
| --------- | ----------------------- |
| \`limit\` | The credit limit        |
| \`risk\`  | The risk of the applicant |
`;

/**
 * The `README.md` of the project: the Documents section of the Project Explorer opens it in the Preview view; the Code
 * view edits its Markdown source. Only Preview and Code are in the view switch.
 */
export const ReadmeDocument: Story = {
    args: {defaultPath: 'doc:README.md', defaultView: 'preview', defaultExplorerOpen: true},
    loaders: [
        async () => ({
            session: await openStoryProject({
                name: 'Shell README story',
                model: {dsl: SAMPLE_MODEL},
                readme: SAMPLE_README,
            }),
        }),
    ],
    play: async ({canvasElement}) => {
        const canvas = within(canvasElement);
        await expect(await canvas.findByRole('heading', {name: 'Shell story'})).toBeInTheDocument();
        await expect(canvas.getAllByRole('radio').map((cell) => cell.textContent)).toEqual(['Preview', 'Code']);
    },
};

/**
 * A stored project with a Save button: a save writes the README with the other slices in one revision, and a reload of
 * the story reopens what the last save stored. The `projectKey` arg picks the stored project.
 */
export const SavedProject: Story = {
    args: {saveable: true, defaultExplorerOpen: true, defaultView: 'flow', projectKey: 'default'},
    loaders: [
        async ({args}) => ({
            session: await openStoredStoryProject(String(args.projectKey ?? 'default'), {
                name: 'Shell saved story',
                model: {dsl: PROJECT_MODEL},
                readme: SAMPLE_README,
            }),
        }),
    ],
};
