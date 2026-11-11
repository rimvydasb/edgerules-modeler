import {describe, expect, it} from 'vitest';
import {validateInputMembers, validateModelPath, validateSourcePath, validateTestSubject} from '../../core/paths';

describe('paths', () => {
    it.each(['*', 'applicant', 'applicant.age', 'library.eligibility', '_x.y_1'])(
        'accepts the model path %s',
        (path) => {
            expect(validateModelPath(path)).toBeUndefined();
        },
    );

    it.each(['', 'a..b', '1a', 'a.', 'doc:README.md', 'a b', 'a.*', 42, undefined])(
        'rejects the model path %s with InvalidInput',
        (path) => {
            const error = validateModelPath(path, 'target');
            expect(error?.code).toBe('InvalidInput');
            expect(error?.message).toContain("'target'");
        },
    );

    it('accepts the README as a source path, but not as a model path or a test subject', () => {
        expect(validateSourcePath('doc:README.md')).toBeUndefined();
        expect(validateSourcePath('applicant.age')).toBeUndefined();
        expect(validateSourcePath('doc:other.md')?.code).toBe('InvalidInput');
        expect(validateTestSubject('doc:README.md')?.code).toBe('InvalidInput');
        expect(validateTestSubject('risk')).toBeUndefined();
    });

    it('validateInputMembers rejects a non-object and names the first unknown member', () => {
        expect(validateInputMembers({subject: '*'}, ['subject'])).toBeUndefined();
        expect(validateInputMembers(null, ['subject'])?.code).toBe('InvalidInput');
        expect(validateInputMembers([], [])?.code).toBe('InvalidInput');
        expect(validateInputMembers({subjct: '*'}, ['subject'])?.message).toContain("'subjct'");
    });
});
