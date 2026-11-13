import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {rootPathSegments, rootViews} from '#lib/rootViews';
import {layoutDrd} from '../drdLayout';
import {buildRequirementsGraph} from '../requirementsGraph';
import {DRD_MODEL} from '../testing/drdModel';

const linked = (dsl: string) => {
    const service = MutableDecisionService.fromCode(dsl);
    service.link();
    return service.get('*');
};

describe('buildRequirementsGraph', () => {
    const graph = buildRequirementsGraph(linked(DRD_MODEL));
    const element = (id: string) => graph.elements.find((candidate) => candidate.id === id);
    const information = graph.requirements
        .filter((requirement) => requirement.kind === 'information')
        .map((requirement) => `${requirement.source} -> ${requirement.target}`);

    it('draws each decision and service, and only the types they read as input data', () => {
        expect(graph.elements.map((candidate) => `${candidate.kind}:${candidate.id}`).sort()).toEqual([
            'decision:ApplicantScore',
            'decision:Approval',
            'decision:Eligibility',
            'input:type:Applicant',
            'input:type:Application',
            'service:approve',
        ]);
        // `Unused` is a type that nothing reads.
        expect(element('type:Unused')).toBeUndefined();
    });

    it('describes each element: the decision context, the results, the fields and the facts of an input', () => {
        expect(element('Approval')).toMatchObject({
            context: {name: 'application', type: 'Application'},
            results: expect.arrayContaining(['approved', 'outcome']),
        });
        expect(element('approve')).toMatchObject({parameters: [{name: 'application', type: 'Application'}]});
        expect(element('type:Applicant')).toMatchObject({name: 'Applicant', fields: 2, facts: ['age']});
    });

    it('links each requirement from the required element to the requiring one', () => {
        expect(information).toEqual(
            expect.arrayContaining([
                'type:Applicant -> ApplicantScore',
                'ApplicantScore -> Eligibility',
                'Eligibility -> Approval',
                'type:Application -> Approval',
                'Approval -> approve',
            ]),
        );
    });

    it('joins a child input type to its owner type', () => {
        expect(graph.requirements.filter((requirement) => requirement.kind === 'owner')).toEqual([
            expect.objectContaining({source: 'type:Applicant', target: 'type:Application', label: 'application'}),
        ]);
    });

    it('has no requirement edges for a model that does not link', () => {
        const unlinked = MutableDecisionService.fromCode(DRD_MODEL).toPortable();
        const graph = buildRequirementsGraph(unlinked);
        expect(graph.elements.some((candidate) => candidate.kind === 'decision')).toBe(true);
        expect(graph.requirements).toEqual([]);
    });
});

describe('layoutDrd', () => {
    it('places the input data at the bottom, each decision above what it requires and the services on top', () => {
        const {positions} = layoutDrd(buildRequirementsGraph(linked(DRD_MODEL)));
        const y = (id: string) => positions[id]!.y;
        expect(y('approve')).toBeLessThan(y('Approval'));
        expect(y('Approval')).toBeLessThan(y('Eligibility'));
        expect(y('Eligibility')).toBeLessThan(y('ApplicantScore'));
        expect(y('ApplicantScore')).toBeLessThan(y('type:Applicant'));
        expect(y('type:Applicant')).toBe(y('type:Application'));
    });

    it('routes a requirement that spans layers through a lane beside the nodes of each layer it passes', () => {
        const graph = buildRequirementsGraph(linked(DRD_MODEL));
        const {positions, waypoints} = layoutDrd(graph);
        // Application is on the bottom layer, Approval three layers above it.
        const lane = waypoints['type:Application->Approval']!;
        expect(lane).toHaveLength(4);
        for (const point of lane) {
            for (const id of ['ApplicantScore', 'Eligibility']) {
                const box = positions[id]!;
                const inside = point.x > box.x && point.x < box.x + 220 && point.y > box.y && point.y < box.y + 76;
                expect(inside).toBe(false);
            }
        }
        // Adjacent layers need no lane.
        expect(waypoints['ApplicantScore->Eligibility']).toBeUndefined();
    });
});

describe('the DRD view', () => {
    it('is offered on every model path, with or without decisions', () => {
        const withDecisions = MutableDecisionService.fromCode(DRD_MODEL).toPortable();
        const plain = MutableDecisionService.fromCode('{ func f(x: number): x }').toPortable();
        expect(rootViews([], withDecisions)).toContain('drd');
        expect(rootViews([], plain)).toContain('drd');
        expect(rootViews(rootPathSegments(plain, 'f'), plain)).toContain('drd');
        expect(rootViews(rootPathSegments(withDecisions, 'Applicant'), withDecisions)).toContain('drd');
    });
});
