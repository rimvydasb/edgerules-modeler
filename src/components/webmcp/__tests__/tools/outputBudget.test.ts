import {describe, expect, it} from 'vitest';
import {fitOutput, LIST_OUTPUT_BUDGET, outputSize} from '../../protocol/outputBudget';

describe('fitOutput', () => {
    it('shrinks a value until its JSON fits the budget', () => {
        const items = Array.from({length: 200}, (_, index) => `entry-${index}`);
        const {value, truncated} = fitOutput(items, (list) => (list.length > 0 ? list.slice(0, -1) : undefined));
        expect(truncated).toBe(true);
        expect(outputSize(value)).toBeLessThanOrEqual(LIST_OUTPUT_BUDGET);
        expect(outputSize([...value, 'entry-next'])).toBeGreaterThan(LIST_OUTPUT_BUDGET);
    });

    it('returns a value that fits as it is', () => {
        expect(fitOutput({a: 1}, () => undefined)).toEqual({value: {a: 1}, truncated: false});
    });

    it('stops when nothing more can be removed', () => {
        const big = 'x'.repeat(2000);
        expect(fitOutput(big, () => undefined, 10)).toEqual({value: big, truncated: false});
    });
});
