import type {PortableError} from '@edgerules/portable';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {engineCodeOf, excerptOf, toModelDiagnostic, toToolError, toolErrorCodeOf} from '../../core/portableErrors';

function portable(type: PortableError['type'], message: string, extra: Partial<PortableError> = {}): PortableError {
    return {'@kind': 'error', type, message, ...extra};
}

describe('portableErrors — mapping', () => {
    it.each([
        ['EntryNotFound', 'execute', 'NotFound'],
        ['DuplicateName', 'execute', 'DuplicateName'],
        ['Parse', 'execute', 'ParseError'],
        ['Execution', 'execute', 'ExecutionError'],
        ['Execution', 'link', 'LinkError'],
        ['WrongFieldPath', 'execute', 'InvalidInput'],
        ['WrongFilter', 'execute', 'InternalError'],
    ] as const)('%s during %s maps to %s', (type, phase, code) => {
        expect(toolErrorCodeOf(portable(type, 'x'), phase)).toBe(code);
    });

    it('a linker message is a LinkError even when execute reports it', () => {
        const error = portable('Execution', "execution error: linker error: E102: unresolved reference 'zz'");
        expect(toolErrorCodeOf(error, 'execute')).toBe('LinkError');
    });

    it('reads the engine code of a linker and of a parser message', () => {
        expect(engineCodeOf("execution error: linker error: E102: unresolved reference 'zz'")).toBe('E102');
        expect(engineCodeOf('parse error: Parse errors: MissingExpression at 9, UnclosedDelimiter at 10')).toBe(
            'MissingExpression',
        );
        expect(engineCodeOf('entry not found: nope')).toBeUndefined();
    });

    it('excerptOf returns the trimmed line, clipped to 120 characters', () => {
        expect(excerptOf('a: 1\n   b: a +\nc: 2', 2)).toBe('b: a +');
        expect(excerptOf(`x: ${'1'.repeat(200)}`, 1)).toHaveLength(120);
        expect(excerptOf('a', 5)).toBeUndefined();
        expect(excerptOf(undefined, 1)).toBeUndefined();
    });

    it('toModelDiagnostic takes line, column and excerpt from the location', () => {
        const diagnostic = toModelDiagnostic(
            portable('Parse', 'parse error: Parse errors: MissingExpression at 9', {
                location: {line: 2, column: 4, expression: 'a: 1\nb: a +'},
            }),
            {path: 'b'},
        );
        expect(diagnostic).toEqual({
            source: 'parser',
            code: 'MissingExpression',
            message: 'parse error: Parse errors: MissingExpression at 9',
            path: 'b',
            line: 2,
            column: 4,
            excerpt: 'b: a +',
        });
    });
});

describe('portableErrors — real engine errors', () => {
    it('a parse error of setCode becomes a ParseError with one parser diagnostic', () => {
        const service = MutableDecisionService.fromCode('{ a: 1\n b: a + 1 }');
        const returned = service.setCode('b', 'a + ');
        const error = toToolError(returned, {phase: 'link', source: 'a + ', path: 'b'});
        expect(error.code).toBe('ParseError');
        expect(error.path).toBe('b');
        expect(error.diagnostics).toEqual([
            expect.objectContaining({source: 'parser', code: 'MissingExpression', path: 'b'}),
        ]);
    });

    it('a failed link becomes a LinkError with the engine code', () => {
        const service = MutableDecisionService.fromCode('{ a: 1\n b: a + 1 }');
        service.setCode('b', 'zz + 1');
        let thrown: unknown;
        try {
            service.link();
        } catch (error) {
            thrown = error;
        }
        const error = toToolError(thrown, {phase: 'link', path: 'b'});
        expect(error.code).toBe('LinkError');
        expect(error.diagnostics?.[0]).toEqual(expect.objectContaining({source: 'linker', code: 'E102', path: 'b'}));
    });

    it('a missing entry becomes NotFound, and a non-portable throw becomes InternalError', () => {
        const service = MutableDecisionService.fromCode('{ a: 1 }');
        expect(toToolError(service.get('nope')).code).toBe('NotFound');
        expect(toToolError(new Error('boom'))).toEqual({code: 'InternalError', message: 'boom'});
    });
});
