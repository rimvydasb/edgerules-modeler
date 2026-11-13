import type {Meta, StoryObj} from '@storybook/react-vite';
import {LOAN_ORIGINATION_PROJECT} from '../../models/loan-origination';
import {renderShellHost, SHELL_HOST_ARG_TYPES, ShellHost} from '../support/ShellHost';
import {openStoryProject} from '../support/storyProject';

// The loan origination project of models/loan-origination in the Shell: applicant and application types with `facts`,
// a scorecard, policy rules, pricing and decision tables, `decision`s, a `service`, two workbooks with charts, and tests. Each story
// opens one entity of it; the controls open any other path or view.
const meta: Meta<typeof ShellHost> = {
    title: 'Models/Loan Origination',
    component: ShellHost,
    parameters: {layout: 'fullscreen'},
    argTypes: SHELL_HOST_ARG_TYPES,
    args: {defaultExplorerOpen: true},
    loaders: [async () => ({session: await openStoryProject(LOAN_ORIGINATION_PROJECT)})],
    render: renderShellHost,
};
export default meta;

type Story = StoryObj<typeof ShellHost>;

/** The whole project with the Project Explorer open. */
export const Overview: Story = {};

/** The `applicantScorecard` decision table: every characteristic of the applicant falls into one bin of points. */
export const Scorecard: Story = {args: {defaultPath: 'applicantScorecard'}};

/** The `LoanDecision` decision: the knockouts, the affordability stress test and the verdict of the application. */
export const LoanDecision: Story = {args: {defaultPath: 'LoanDecision'}};

/** The `decisionMatrix` decision table: knockouts, grade, LTV and DSTI decide APPROVE, REFER or DECLINE. */
export const DecisionMatrix: Story = {args: {defaultPath: 'decisionMatrix'}};

/** The `loanOriginationDecision` service in the Boxed view: the per-applicant and the application decisions, the pricing and the offer. */
export const Service: Story = {args: {defaultPath: 'loanOriginationDecision'}};

/**
 * The `originationBook` workbook: the loan terms and two applicants make the joint application; the scorecards of both
 * applicants as charts, and the decision, the offer, the affordability and the household grade as outputs.
 */
export const OriginationBook: Story = {args: {defaultPath: 'originationBook', defaultView: 'flow'}};

/** The `capacityBook` workbook: the largest affordable loan of a household for each term. */
export const CapacityBook: Story = {args: {defaultPath: 'capacityBook', defaultView: 'flow'}};

/**
 * The Decision Requirements Diagram of the whole model: the input data with their facts, the decisions and the
 * `loanOriginationDecision` service, joined by their information requirements.
 */
export const Drd: Story = {args: {defaultPath: '*', defaultView: 'drd'}};

/** The tests of the `loanOriginationDecision` service: joint and single applications, one per outcome. Run all to check every case. */
/** The tests of the whole model: its own rows, and the rows its workbooks add when a run reaches them. */
export const ModelTests: Story = {args: {defaultPath: '*', defaultView: 'tests'}};

export const ServiceTests: Story = {args: {defaultPath: 'loanOriginationDecision', defaultView: 'tests'}};
