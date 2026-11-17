import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';

// The real engine, never mocked. Contract: a repeated field name is a parser error in a `type` as it is in an object
// (it was accepted silently up to `@edgerules/node` 0.2.8-alpha.202611121551).
const DUPLICATE_TYPE_FIELD = '{ type A: { x: <number>\n x: <string> } }';
const DUPLICATE_OBJECT_FIELD = '{ a: 1\n a: 2 }';

describe('duplicate field names (real engine)', () => {
    it('reports a `type` with two fields of the same name as a DuplicateEntryName parser diagnostic', () => {
        const diagnostics = MutableDecisionService.diagnostics(DUPLICATE_TYPE_FIELD);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
            severity: 'error',
            source: 'parser',
            code: 'DuplicateEntryName',
            message: 'duplicate entry name',
        });
        // The range starts at the repeated field, inside the type body.
        expect(diagnostics[0].from).toBe(DUPLICATE_TYPE_FIELD.indexOf('x: <string>'));
        expect(diagnostics[0].to).toBeLessThanOrEqual(DUPLICATE_TYPE_FIELD.length);
    });

    it('refuses to load a `type` with two fields of the same name', () => {
        expect(() => MutableDecisionService.fromCode(DUPLICATE_TYPE_FIELD)).toThrow(
            'parse error: Parse errors: DuplicateEntryName at 25',
        );
    });

    it('rejects a repeated name in an object the same way', () => {
        expect(MutableDecisionService.diagnostics(DUPLICATE_OBJECT_FIELD).map((d) => d.code)).toEqual([
            'DuplicateEntryName',
        ]);
        expect(() => MutableDecisionService.fromCode(DUPLICATE_OBJECT_FIELD)).toThrow(/DuplicateEntryName/);
    });

    it('accepts a `type` whose fields have distinct names', () => {
        expect(MutableDecisionService.diagnostics('{ type A: { x: <number>\n y: <string> } }')).toEqual([]);
    });
});
