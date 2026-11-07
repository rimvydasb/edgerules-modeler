import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {isPortableError} from '../portable';
import {factsCode, factsPath, setFactsCode, splitFactsPath, withFactsPaths} from '../factsPaths';

const MODEL = `{
    type Applicant: { age: <number>; income: <number> }
    facts Applicant(applicant: Applicant): {
        adult: applicant.age >= 18
        label: "a {b}"
    }
    service check(applicant: Applicant): { return: applicant.adult }
}`;

function engine() {
    return MutableDecisionService.fromCode(MODEL);
}

describe('splitFactsPath', () => {
    it('splits the facts declaration and a field of its body', () => {
        expect(factsPath('Applicant')).toBe('Applicant.@facts');
        expect(splitFactsPath('Applicant.@facts')).toEqual({type: 'Applicant', rest: ''});
        expect(splitFactsPath('Applicant.@facts.adult')).toEqual({type: 'Applicant', rest: 'adult'});
        expect(splitFactsPath('Applicant')).toBeUndefined();
        expect(splitFactsPath('a.b')).toBeUndefined();
    });
});

describe('withFactsPaths', () => {
    it('reads the facts schema and the type of a body field', () => {
        const service = withFactsPaths(engine());
        expect(service.get('Applicant.@facts')).toHaveProperty('@kind', 'facts-schema');
        expect(service.get('Applicant.@facts.adult')).toEqual({'@kind': 'type', type: 'boolean'});
        expect(isPortableError(service.get('Applicant.@facts.missing'))).toBe(true);
        // Any other path goes to the engine.
        expect(service.get('check')).toHaveProperty('@kind', 'service-schema');
    });

    it('writes, renames and removes a field of the body', async () => {
        const raw = engine();
        const service = withFactsPaths(raw);
        expect(
            isPortableError(
                service.set('Applicant.@facts.rich', {'@kind': 'expression', expression: 'applicant.income > 1000'}),
            ),
        ).toBe(false);
        expect(isPortableError(service.rename('Applicant.@facts.rich', 'wealthy'))).toBe(false);
        expect(isPortableError(service.remove('Applicant.@facts.label'))).toBe(false);
        const facts = (raw.toPortable() as unknown as Record<string, Record<string, unknown>>).Applicant!['@facts'];
        expect(Object.keys((facts as {'@body': object})['@body'])).toEqual(['@kind', 'adult', 'wealthy']);
        expect(await raw.execute('check', {applicant: {age: 20, income: 10}})).toBe(true);
    });

    it('replaces and removes the whole declaration', () => {
        const raw = engine();
        const service = withFactsPaths(raw);
        const result = service.set('Applicant.@facts', {
            '@kind': 'facts',
            '@context': {applicant: 'Applicant'},
            '@body': {'@kind': 'context', adult: {'@kind': 'expression', expression: 'applicant.age >= 21'}},
        } as never);
        expect(result).toHaveProperty('@kind', 'facts-schema');
        expect(factsCode(raw, 'Applicant')).toContain('applicant.age >= 21');

        expect(service.remove('Applicant.@facts')).toBeUndefined();
        expect(raw.getCode('*')).not.toContain('facts Applicant');
    });
});

describe('factsCode', () => {
    it('cuts the facts declaration from the code of the model, braces in strings included', () => {
        expect(factsCode(engine(), 'Applicant')).toBe(
            'facts Applicant(applicant: Applicant): {\n    adult: applicant.age >= 18\n    label: "a {b}"\n}',
        );
        expect(isPortableError(factsCode(engine(), 'Missing'))).toBe(true);
    });

    it('writes the facts declaration from its code', () => {
        const raw = engine();
        const written = setFactsCode(
            raw,
            'Applicant',
            'facts Applicant(applicant: Applicant): { senior: applicant.age > 60 }',
        );
        expect(isPortableError(written)).toBe(false);
        expect(factsCode(raw, 'Applicant')).toContain('senior: applicant.age > 60');
    });
});
