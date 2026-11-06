import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {hasModelFlow, isDocumentPath, isRootPath, resolveRootPath, rootPathSegments, rootViews} from '../shell-path';

const model = MutableDecisionService.fromCode(
    `{
    type Customer: { name: <string> }
    func riskScore(income: number): { score: income / 100 }
    service quote(income: number): { score: riskScore(income).score }
    ruleset band(age: number): {
        hitPolicy: "first-match"
        rules: [{ when: { age: < 30 }, then: { level: "young" } }]
        default: { level: "none" }
    }
    applicant: {
        age: 21
        address: { city: "Vilnius" }
        func calculateAge(year: number): { result: 2026 - year }
    }
    loans: [1, 2]
    workbook book: {
        @FunctionNode
        score: riskScore(applicant.age)
    }
}`,
).toPortable();

describe('rootPathSegments', () => {
    it('lists a context segment per field and a function segment last', () => {
        expect(rootPathSegments(model, 'applicant.calculateAge')).toEqual([
            {name: 'applicant', path: 'applicant', kind: 'context'},
            {name: 'calculateAge', path: 'applicant.calculateAge', kind: 'function'},
        ]);
        expect(rootPathSegments(model, '*')).toEqual([]);
    });

    it('names a `service` declaration a service', () => {
        expect(rootPathSegments(model, 'quote')).toEqual([{name: 'quote', path: 'quote', kind: 'service'}]);
    });

    it('names the kind of every entity, a workbook and a plain field included', () => {
        expect(rootPathSegments(model, 'book.score')).toEqual([
            {name: 'book', path: 'book', kind: 'workbook'},
            {name: 'score', path: 'book.score', kind: 'field'},
        ]);
        expect(rootPathSegments(model, 'band').at(-1)?.kind).toBe('ruleset');
        expect(rootPathSegments(model, 'Customer').at(-1)?.kind).toBe('type');
        expect(rootPathSegments(model, 'loans').at(-1)?.kind).toBe('field');
    });
});

describe('rootViews', () => {
    it.each([
        ['*', ['code', 'boxed', 'flow', 'tests']],
        // A context has no Flow view: only a workbook and a service have.
        ['applicant', ['code', 'boxed']],
        ['book', ['code', 'boxed', 'flow']],
        // A function has no nodes, so no Flow view; a service has its parameters, its body and its result.
        ['riskScore', ['code', 'boxed', 'tests']],
        ['quote', ['code', 'boxed', 'flow', 'tests']],
        ['band', ['code', 'boxed', 'tests']],
        ['Customer', ['code', 'boxed']],
        ['applicant.age', ['code', 'boxed']],
    ])('%s: %o', (path, views) => {
        expect(rootViews(rootPathSegments(model, path), model)).toEqual(views);
    });

    it('has no Flow view of the model without a workbook, a service or a README', () => {
        const plain = MutableDecisionService.fromCode('{ applicant: { age: 21 } }').toPortable();
        expect(rootViews([], plain)).toEqual(['code', 'boxed', 'tests']);
        expect(rootViews([], plain, true)).toEqual(['code', 'boxed', 'flow', 'tests']);
    });
});

describe('hasModelFlow', () => {
    it.each([
        ['a workbook', '{ workbook book: { x: 1 } }', false, true],
        ['a service', '{ service quote(income: number): { score: income } }', false, true],
        ['a nested service', '{ api: { service quote(income: number): { score: income } } }', false, true],
        ['a README', '{ applicant: { age: 21 } }', true, true],
        ['nothing of these', '{ func f(x: number): x }', false, false],
    ])('%s: %s', (_label, code, readme, flow) => {
        expect(hasModelFlow(MutableDecisionService.fromCode(code).toPortable(), readme)).toBe(flow);
    });
});

describe('isDocumentPath', () => {
    it('is true for a doc: path only', () => {
        expect(isDocumentPath('doc:README.md')).toBe(true);
        expect(isDocumentPath('*')).toBe(false);
        expect(isDocumentPath('applicant.address')).toBe(false);
    });
});

describe('resolveRootPath', () => {
    it.each([
        ['*', '*'],
        ['applicant', 'applicant'],
        ['applicant.address', 'applicant.address'],
        ['applicant.calculateAge', 'applicant.calculateAge'],
        ['riskScore', 'riskScore'],
        // Every entity: a plain value, a ruleset, a type, a workbook and its nodes.
        ['loans', 'loans'],
        ['applicant.age', 'applicant.age'],
        ['band', 'band'],
        ['Customer', 'Customer'],
        ['book', 'book'],
        ['book.score', 'book.score'],
        // Nothing below a function or another entity that is not a context.
        ['applicant.calculateAge.result', 'applicant.calculateAge'],
        ['riskScore.score', 'riskScore'],
        ['Customer.name', 'Customer'],
        // No index.
        ['loans[0]', '*'],
        // A missing field.
        ['applicant.missing.city', 'applicant'],
        ['nothing', '*'],
    ])('%s opens %s', (path, expected) => {
        expect(resolveRootPath(model, path)).toBe(expected);
        expect(isRootPath(model, path)).toBe(path === expected);
    });
});
