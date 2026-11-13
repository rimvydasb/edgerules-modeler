import '@xyflow/react/dist/style.css';
import type {ReactElement} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {init, MutableDecisionService} from '@edgerules/web/mutable';
import {DecisionRequirementsDiagram} from '../../../src/components/drd-view';
import {DRD_MODEL} from '../../../src/components/drd-view/testing/drdModel';
import {LOAN_ORIGINATION_DSL} from '../../../models/loan-origination';

interface DiagramArgs {
    dsl: string;
}

// The linked `get('*')` of the model: the diagram reads the `requires` of each decision and service from it.
async function linkedModel(dsl: string): Promise<unknown> {
    await init();
    const service = MutableDecisionService.fromCode(dsl);
    service.link();
    return service.get('*');
}

function Diagram({model}: {model: unknown}): ReactElement {
    return (
        <div style={{height: '100vh'}}>
            <DecisionRequirementsDiagram model={model} onOpen={(target) => console.info('open', target)} />
        </div>
    );
}

const meta: Meta<DiagramArgs> = {
    title: 'Components/DRD View/Decision Requirements Diagram',
    parameters: {layout: 'fullscreen'},
    loaders: [async ({args}) => ({model: await linkedModel(args.dsl)})],
    render: (_args, {loaded}) => <Diagram model={loaded.model} />,
};
export default meta;

type Story = StoryObj<DiagramArgs>;

/**
 * The loan origination model: `Applicant` and `Application` with their facts at the bottom, the per-applicant and the
 * per-application decisions above them, and the `loanOriginationDecision` service on top. Click a node to highlight its
 * requirement chain; double-click it to open it.
 */
export const LoanOrigination: Story = {args: {dsl: LOAN_ORIGINATION_DSL}};

/** A small layered model: two input types joined by their owner link, three decisions and one service. */
export const Layered: Story = {args: {dsl: DRD_MODEL}};

/** A model without a decision or a service. */
export const Empty: Story = {args: {dsl: '{ func monthly(amount: number): amount / 12 }'}};
