import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {createFlowEditorService} from '../../service/createFlowEditorService';
import {SAMPLE_MODEL} from '../../testing/sampleModel';
import {SERVICE_MODEL} from '../../testing/serviceModel';
import {filterItems, paletteItems} from '../paletteItems';

function items() {
    const service = createFlowEditorService(MutableDecisionService.fromCode(SAMPLE_MODEL));
    return {service, items: paletteItems(service)};
}

describe('paletteItems', () => {
    it('offers a new input of each kind, then one Invocation, Expression, Output and Chart', () => {
        const ids = items().items.map((item) => item.id);
        expect(ids).toEqual([
            'new-input',
            'new-list-input',
            'new-value-input',
            'function',
            'expression',
            'output',
            'chart',
        ]);
    });

    it('offers a service flow a Parameter, one Invocation, an Expression and the Return while it has none', () => {
        const ids = (model: string) =>
            paletteItems(createFlowEditorService(MutableDecisionService.fromCode(model), {root: 'f'})).map((item) => [
                item.id,
                item.group,
                item.action,
            ]);
        expect(ids('{ service f(a: number): { b: a } }')).toEqual([
            ['parameter', 'input', {kind: 'parameter'}],
            ['function', 'function', {kind: 'function'}],
            ['expression', 'expression', {kind: 'expression'}],
            ['return', 'output', {kind: 'return'}],
        ]);
        const service = createFlowEditorService(MutableDecisionService.fromCode(SERVICE_MODEL), {root: 'quote'});
        expect(paletteItems(service).map((item) => item.id)).toEqual(['parameter', 'function', 'expression']);
        // A `return` expression, annotated or not, is the return of the service.
        expect(ids('{ service f(a: number): { b: a; return: b } }').map(([id]) => id)).toEqual([
            'parameter',
            'function',
            'expression',
        ]);
    });

    it('offers one Invocation item that picks the callee on the node', () => {
        const invocations = items().items.filter((item) => item.group === 'function');
        expect(invocations).toEqual([
            expect.objectContaining({title: 'Invocation', label: 'Add invocation', action: {kind: 'function'}}),
        ]);
    });

    it('creates each input kind from its own item', () => {
        const actions = items()
            .items.filter((item) => item.id.startsWith('new-'))
            .map((item) => [item.title, item.action]);
        expect(actions).toEqual([
            ['Object input', {kind: 'new-input', input: 'object-input'}],
            ['List input', {kind: 'new-input', input: 'list-input'}],
            ['Value input', {kind: 'new-input', input: 'value-input'}],
        ]);
    });
});

describe('filterItems', () => {
    it('matches every word against title, detail and group, ignoring case', () => {
        const all = items().items;
        expect(filterItems(all, 'RECORD').map((item) => item.id)).toEqual(['new-input']);
        expect(filterItems(all, 'outputs').map((item) => item.id)).toEqual(['output']);
        expect(filterItems(all, 'charts').map((item) => item.id)).toEqual(['chart']);
        expect(filterItems(all, 'invocation').map((item) => item.id)).toEqual(['function']);
        expect(filterItems(all, 'list input').map((item) => item.id)).toEqual(['new-list-input']);
        expect(filterItems(all, '  ')).toBe(all);
    });
});
