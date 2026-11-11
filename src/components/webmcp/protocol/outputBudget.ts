import {LIST_OUTPUT_BUDGET} from '../core/limits';

export {LIST_OUTPUT_BUDGET};

/** The size of `value` as the browser sends it to the agent: its JSON text. */
export function outputSize(value: unknown): number {
    return JSON.stringify(value)?.length ?? 0;
}

/**
 * Shrinks `value` until its JSON fits `budget` characters. `shrink` returns a smaller value, or `undefined` when
 * nothing more can be removed; the last value is then returned as is. `truncated` is true when `shrink` ran.
 */
export function fitOutput<T>(
    value: T,
    shrink: (value: T) => T | undefined,
    budget: number = LIST_OUTPUT_BUDGET,
): {value: T; truncated: boolean} {
    let current = value;
    let truncated = false;
    while (outputSize(current) > budget) {
        const next = shrink(current);
        if (next === undefined) break;
        current = next;
        truncated = true;
    }
    return {value: current, truncated};
}
