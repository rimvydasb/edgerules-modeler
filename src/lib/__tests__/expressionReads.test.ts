import {describe, expect, it} from 'vitest';
import {readPaths} from '../expressionReads';

describe('readPaths', () => {
    it('reads the paths of an expression, without string literals, members or keys', () => {
        expect(readPaths('channelTotals(plan, "call")')).toEqual(['channelTotals', 'plan']);
        expect(readPaths('records[i].data.id + mix.status')).toEqual(['records', 'i', 'mix.status']);
        expect(readPaths('{ status: mix.status; total: sum(xs) }')).toEqual(['mix.status', 'sum', 'xs']);
        expect(readPaths('f(items: list, n: 0..count)')).toEqual(['f', 'list', 'count']);
    });
});
