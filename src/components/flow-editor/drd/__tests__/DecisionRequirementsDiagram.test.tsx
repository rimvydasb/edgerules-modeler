import {MutableDecisionService} from '@edgerules/node/mutable';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DRD_MODEL} from '../../testing/drdModel';
import {DecisionRequirementsDiagram} from '../DecisionRequirementsDiagram';

function renderDiagram(dsl: string, onOpen = vi.fn(), focus?: string) {
    const service = MutableDecisionService.fromCode(dsl);
    service.link();
    render(
        <div style={{width: 1000, height: 600}}>
            <DecisionRequirementsDiagram model={service.get('*')} focus={focus} onOpen={onOpen} />
        </div>,
    );
    return {onOpen};
}

describe('DecisionRequirementsDiagram', () => {
    it('draws the decisions, the input data with their facts and the decision services', async () => {
        renderDiagram(DRD_MODEL);
        await waitFor(() => expect(screen.getByTestId('drd-node-Approval')).toBeInTheDocument());
        expect(screen.getByTestId('drd-node-Approval')).toHaveAttribute('data-kind', 'decision');
        expect(screen.getByTestId('drd-node-Approval')).toHaveTextContent('application: Application');
        expect(screen.getByTestId('drd-node-type:Applicant')).toHaveAttribute('data-kind', 'input');
        expect(screen.getByTestId('drd-node-type:Applicant')).toHaveTextContent(/facts.*age/);
        expect(screen.getByTestId('drd-node-approve')).toHaveTextContent('Decision service');
        expect(screen.getByTestId('drd-legend')).toHaveTextContent('Decision · 3');
        expect(screen.queryByTestId('drd-node-type:Unused')).toBeNull();
    });

    it('dims the elements outside the requirement chain of a clicked node', async () => {
        renderDiagram(DRD_MODEL);
        const score = await screen.findByTestId('drd-node-ApplicantScore');
        fireEvent.click(score);
        await waitFor(() => expect(screen.getByTestId('drd-node-ApplicantScore').className).toMatch(/selected/));
        // The application input is not required by the score, nor does it require the score.
        expect(screen.getByTestId('drd-node-type:Application').className).toMatch(/dimmed/);
        expect(screen.getByTestId('drd-node-approve').className).not.toMatch(/dimmed/);
    });

    it('selects the focused element: a decision by its path, an input by its type name', async () => {
        renderDiagram(DRD_MODEL, vi.fn(), 'Application');
        await waitFor(() => expect(screen.getByTestId('drd-node-type:Application').className).toMatch(/selected/));
        expect(screen.getByTestId('drd-node-ApplicantScore').className).toMatch(/dimmed/);
    });

    it('opens a decision and an input type on a double click', async () => {
        const {onOpen} = renderDiagram(DRD_MODEL);
        fireEvent.doubleClick(await screen.findByTestId('drd-node-Eligibility'));
        expect(onOpen).toHaveBeenLastCalledWith({path: 'Eligibility', kind: 'decision'});
        fireEvent.doubleClick(screen.getByTestId('drd-node-type:Application'));
        expect(onOpen).toHaveBeenLastCalledWith({path: 'Application', kind: 'input'});
    });

    it('explains an empty diagram', () => {
        renderDiagram('{ func f(x: number): x }');
        expect(screen.getByTestId('drd-empty')).toHaveTextContent('No decisions to draw');
    });
});
