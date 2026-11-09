import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {isPortableError} from '#lib/portable';
import {createFlowEditorService} from '../service/createFlowEditorService';

// A workbook and a service with annotated and unannotated elements, a typed hole, and a namespace of functions.
const MODEL = `{
    type Applicant: { age: <number>; income: <number> }
    func monthly(amount: number): amount / 12
    service quote(applicant: Applicant): {
        plain: monthly(applicant.income)
        terms: { months: 12 }
        return: plain
    }
    @Name("Main Workbook")
    workbook main: {
        @InputNode(name: "Applicant")
        applicant: <Applicant>
        settings: { rate: 0.5 }
        @FunctionNode
        decision: quote(applicant)
        installment: monthly(settings.rate * 1200)
        payment: installment * 2
        library: { func helper(x: number): x }
    }
    record: { a: 1 }
    call: monthly(1200)
}`;

function build(root: string) {
    const mutable = MutableDecisionService.fromCode(MODEL);
    return {mutable, service: createFlowEditorService(mutable, {root})};
}

describe('FlowEditorService of a workbook', () => {
    it('shows every element: a typed hole, records and invocations with or without an annotation', () => {
        const {service} = build('main');
        expect(service.isService()).toBe(false);
        expect(service.listNodes()).toEqual([
            {field: 'main.applicant', kind: 'parameter'},
            {field: 'main.settings', kind: 'object-input'},
            {field: 'main.decision', kind: 'function'},
            {field: 'main.installment', kind: 'function'},
            {field: 'main.payment', kind: 'expression'},
        ]);
    });

    it('reads a typed hole as a parameter node of its record type', () => {
        const {service} = build('main');
        expect(service.getParameterNode('main.applicant')).toEqual({
            field: 'main.applicant',
            name: 'applicant',
            type: 'Applicant',
            typePath: 'Applicant',
            fields: [
                {name: 'age', type: 'number'},
                {name: 'income', type: 'number'},
            ],
            used: true,
            exists: true,
        });
    });

    it('changes the type of a typed hole, link-checked', () => {
        const {service, mutable} = build('main');
        expect(isPortableError(service.setParameterType('main.applicant', 'number'))).toBe(true);
        expect(mutable.getCode('main')).toContain('applicant: <Applicant>');
    });

    it('reads an unannotated record and invocation', () => {
        const {service} = build('main');
        expect(service.getObjectInputNode('main.settings').fields.map((field) => field.name)).toEqual(['rate']);
        expect(service.getFunctionNode('main.installment')).toMatchObject({
            callee: {path: 'monthly'},
            arguments: [{name: 'amount', binding: {kind: 'value', text: 'settings.rate * 1200'}}],
        });
    });

    it('binds a field of the workbook by its short name: nothing can reference a workbook', () => {
        const {service, mutable} = build('main');
        expect(service.bindArgument('main.installment', 'amount', 'main.settings.rate')).toBeUndefined();
        expect(service.getFunctionNode('main.installment').arguments[0]!.binding).toEqual({
            kind: 'path',
            text: 'settings.rate',
        });
        expect(() => mutable.link()).not.toThrow();
    });

    it('adds an expression to the workbook', () => {
        const {service, mutable} = build('main');
        expect(service.createExpressionNode()).toBe('main.expression');
        expect(mutable.getCode('main')).toContain('expression: 0');
    });

    it('reads an output of the workbook', async () => {
        const {service} = build('main');
        expect(await service.readOutput('main.installment')).toEqual({value: 50, type: 'number'});
    });
});

describe('FlowEditorService of a service: every element', () => {
    it('shows an unannotated invocation and record next to its parameters and return', () => {
        const {service} = build('quote');
        expect(service.isService()).toBe(true);
        expect(service.listNodes()).toEqual([
            {field: 'quote.applicant', kind: 'parameter'},
            {field: 'quote.plain', kind: 'function'},
            {field: 'quote.terms', kind: 'object-input'},
            {field: 'quote.return', kind: 'return'},
        ]);
    });
});
