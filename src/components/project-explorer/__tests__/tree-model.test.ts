import {describe, expect, it} from 'vitest';
import type {PortableContext} from '@edgerules/portable';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {buildSections, isIdentifier, methodKind} from '../tree-model';
import {uniqueName} from '../create-templates';
import {MODEL_DSL} from '../testing/model.dsl';

function sections(code: string, testSubjects: string[] = [], documents?: string[]) {
    const service = MutableDecisionService.fromCode(code);
    return buildSections(service.get('*') as PortableContext, testSubjects, documents);
}

describe('buildSections', () => {
    it('splits the model into Types, Methods, Service Methods, Variables, Workbooks and Tests, each by name', () => {
        const result = sections(MODEL_DSL, ['riskScore', '*']);

        expect(result.types.map((entry) => entry.path)).toEqual(['PeopleList', 'Person']);
        expect(result.methods.map((entry) => [entry.kind, entry.label])).toEqual([
            ['function', 'nested.deep()'],
            ['ruleset', 'risk(...)'],
            ['function', 'riskScore(...)'],
        ]);
        expect(result.services.map((entry) => [entry.kind, entry.label])).toEqual([
            ['service', 'processApplication(...)'],
        ]);
        expect(result.variables.map((entry) => [entry.kind, entry.path])).toEqual([
            ['variable', 'globalConst'],
            ['variable', 'list'],
            ['context', 'nested'],
        ]);
        expect(result.tests.map((entry) => [entry.path, entry.label])).toEqual([
            ['*', 'Model'],
            ['riskScore', 'riskScore(...)'],
        ]);
    });

    it('lists a loop and an optimise as methods, not variables', () => {
        const result = sections(
            [
                '{',
                '    loop total(items: number[]): { over: items; state: { sum: 0 }; do: { sum: state.sum + item }; return: state.sum }',
                '    optimise best(limit: number): { variables: { x: <number, min: 0, max: 10> }; maximise: x; constraints: { cap: x <= limit } }',
                '    value: 1',
                '}',
            ].join('\n'),
        );

        expect(result.methods.map((entry) => [entry.kind, entry.label])).toEqual([
            ['optimise', 'best(...)'],
            ['loop', 'total(...)'],
        ]);
        expect(result.variables.map((entry) => entry.path)).toEqual(['value']);
    });

    it('lists the parameters and the body fields of a service as its children, like the nodes of a workbook', () => {
        const [service] = sections(
            '{ func f(x: number): { r: x }\n service plan(values: number[], limit: number): { a: f(limit); b: a.r * 2; return: { out: b } } }',
        ).services;

        expect(service).toMatchObject({kind: 'service', path: 'plan', label: 'plan(...)'});
        expect(service!.children!.map((entry) => [entry.kind, entry.path])).toEqual([
            ['input-node', 'plan.values'],
            ['input-node', 'plan.limit'],
            ['function-node', 'plan.a'],
            ['node', 'plan.b'],
            ['output-node', 'plan.return'],
        ]);
    });

    it('lists every field of a workbook as its children, annotated or not, in model order', () => {
        const [workbook] = sections(MODEL_DSL).workbooks;

        expect(workbook).toMatchObject({kind: 'workbook', path: 'loanBook'});
        expect(workbook!.children!.map((entry) => [entry.kind, entry.path])).toEqual([
            ['input-node', 'loanBook.applicant'],
            ['function-node', 'loanBook.decision'],
            ['output-node', 'loanBook.result'],
            ['node', 'loanBook.helper'],
        ]);
    });

    it('picks the kind of an unannotated workbook field from its value', () => {
        const [workbook] = sections(
            '{ func f(x: number): x\n workbook book: { hole: <number>; rec: { a: 1 }; call: f(1); v: 2 } }',
        ).workbooks;
        expect(workbook!.children!.map((entry) => [entry.kind, entry.label])).toEqual([
            ['input-node', 'hole'],
            ['input-node', 'rec'],
            ['function-node', 'call'],
            ['node', 'v'],
        ]);
    });

    it('lists a service inside a context as a service method by its qualified path', () => {
        const result = sections('{ nested: { service deep(): { return: 1 } } }');
        expect(result.services.map((entry) => entry.label)).toEqual(['nested.deep()']);
        expect(result.methods).toEqual([]);
    });

    it('does not list a callable of a workbook as a method', () => {
        const result = sections('{ workbook book: { func local(): 1 } }');
        expect(result.methods).toEqual([]);
        expect(result.workbooks.map((entry) => entry.path)).toEqual(['book']);
    });

    it('lists no workbook when the model declares none, and keeps its annotated nodes as variables', () => {
        const result = sections(
            '{ @InputNode applicant: { age: 21 }\n @FunctionNode risk: applicant.age * 2\n limit: 10 }',
        );

        expect(result.workbooks).toEqual([]);
        expect(result.variables.map((entry) => entry.path)).toEqual(['applicant', 'limit', 'risk']);
    });

    it('lists every workbook declaration, labelled with its @Name', () => {
        const result = sections(
            '{ @InputNode applicant: { age: 21 }\n @Name("Main book")\n workbook book: { @InputNode x: { a: 1 } }\n workbook other: { y: 1 } }',
        );
        expect(result.workbooks.map((entry) => [entry.path, entry.label])).toEqual([
            ['book', 'Main book'],
            ['other', 'other'],
        ]);
        expect(result.variables.map((entry) => entry.path)).toEqual(['applicant']);
    });
});

describe('buildSections documents', () => {
    it('lists the documents as doc: paths, and none without them', () => {
        expect(sections(MODEL_DSL, [], ['README.md']).documents).toEqual([
            {kind: 'document', path: 'doc:README.md', label: 'README.md'},
        ]);
        expect(sections(MODEL_DSL, []).documents).toEqual([]);
    });
});

describe('methodKind', () => {
    it('tells functions, decisions, services and rulesets apart, and is undefined for anything else', () => {
        expect(methodKind({'@kind': 'method-interface'})).toBe('function');
        expect(methodKind({'@kind': 'service'})).toBe('service');
        expect(methodKind({'@kind': 'service-interface'})).toBe('service');
        expect(methodKind({'@kind': 'decision-interface'})).toBe('decision');
        expect(methodKind({'@kind': 'decision'})).toBe('decision');
        expect(methodKind({'@kind': 'ruleset-interface'})).toBe('ruleset');
        expect(methodKind({'@kind': 'context'})).toBeUndefined();
        expect(methodKind(5)).toBeUndefined();
    });
});

describe('isIdentifier and uniqueName', () => {
    it('accepts EdgeRules identifiers only', () => {
        expect(isIdentifier('newFunction_2')).toBe(true);
        expect(isIdentifier('2fast')).toBe(false);
        expect(isIdentifier('a.b')).toBe(false);
        expect(isIdentifier('')).toBe(false);
    });

    it('adds the first free number to a taken name', () => {
        expect(uniqueName('newType', new Set())).toBe('newType');
        expect(uniqueName('newType', new Set(['newType', 'newType2']))).toBe('newType3');
    });
});
