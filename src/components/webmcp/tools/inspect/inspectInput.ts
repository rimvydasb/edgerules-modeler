import {LIMITS} from '../../core/limits';
import {fail, type ToolError} from '../../core/toolResult';

/** `undefined` when `value` is absent or an integer from `min` to `max`. */
export function validateInteger(
    value: unknown,
    member: string,
    min: number,
    max = Number.MAX_SAFE_INTEGER,
): ToolError | undefined {
    if (value === undefined || (Number.isInteger(value) && (value as number) >= min && (value as number) <= max)) {
        return undefined;
    }
    const range = max === Number.MAX_SAFE_INTEGER ? `at least ${min}` : `from ${min} to ${max}`;
    return fail('InvalidInput', `'${member}' must be an integer ${range}; got ${JSON.stringify(value)}.`).error;
}

export const validateOffset = (value: unknown) => validateInteger(value, 'offset', 0);

export const validateLimit = (value: unknown) =>
    validateInteger(value, 'limit', LIMITS.listLimitMin, LIMITS.listLimitMax);
