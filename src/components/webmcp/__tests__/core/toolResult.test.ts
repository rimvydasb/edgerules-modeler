import {describe, expect, it} from 'vitest';
import {clipText, fail, isAbortError, messageOf, ok} from '../../core/toolResult';

describe('toolResult', () => {
    it('ok spreads the value next to ok: true', () => {
        expect(ok({passed: 2})).toEqual({ok: true, passed: 2});
    });

    it('fail clips the message to 300 characters and the diagnostics to 20', () => {
        const diagnostics = Array.from({length: 25}, (_, index) => ({source: 'parser' as const, message: `m${index}`}));
        const result = fail('ParseError', 'x'.repeat(400), {diagnostics, path: 'a'});
        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('ParseError');
        expect(result.error.message).toHaveLength(300);
        expect(result.error.message.endsWith('…')).toBe(true);
        expect(result.error.diagnostics).toHaveLength(20);
        expect(result.error.path).toBe('a');
    });

    it('clipText keeps short text as is', () => {
        expect(clipText('abc', 3)).toBe('abc');
        expect(clipText('abcd', 3)).toBe('ab…');
    });

    it('messageOf reads an Error, a message object and any other value', () => {
        expect(messageOf(new Error('boom'))).toBe('boom');
        expect(messageOf({message: 'portable'})).toBe('portable');
        expect(messageOf(42)).toBe('42');
    });

    it('isAbortError recognizes the AbortError of an aborted signal', () => {
        const controller = new AbortController();
        controller.abort();
        let thrown: unknown;
        try {
            controller.signal.throwIfAborted();
        } catch (error) {
            thrown = error;
        }
        expect(isAbortError(thrown)).toBe(true);
        expect(isAbortError(new Error('x'))).toBe(false);
    });
});
