import {LIMITS} from '../../core/limits';
import {validateInputMembers} from '../../core/paths';
import {fail, type ToolError} from '../../core/toolResult';

function invalid(message: string, operation?: number): ToolError {
    return fail('InvalidInput', message, operation === undefined ? {} : {operation}).error;
}

/** `undefined` when `value` is absent or a non-negative integer. */
export function validateBaseVersion(value: unknown): ToolError | undefined {
    if (value === undefined || (Number.isInteger(value) && (value as number) >= 0)) return undefined;
    return invalid(`'baseVersion' must be a non-negative integer; got ${JSON.stringify(value)}.`);
}

/** `undefined` when `value` is an array of 1 to 50 objects. */
export function validateBatch(value: unknown, member: string): ToolError | undefined {
    if (!Array.isArray(value) || value.length < LIMITS.batchMin || value.length > LIMITS.batchMax) {
        return invalid(`'${member}' must be an array of ${LIMITS.batchMin} to ${LIMITS.batchMax} entries.`);
    }
    const index = value.findIndex((entry) => typeof entry !== 'object' || entry === null || Array.isArray(entry));
    return index === -1 ? undefined : invalid(`'${member}[${index}]' must be an object.`, index);
}

/** As `validateInputMembers`, for entry `index` of a batch: the error names the operation. */
export function validateEntryMembers(entry: object, allowed: readonly string[], index: number): ToolError | undefined {
    const error = validateInputMembers(entry, allowed);
    return error && {...error, operation: index};
}

/** `undefined` when `value` is a string of at most `max` characters (and not empty with `nonEmpty`). */
export function validateText(
    value: unknown,
    member: string,
    max: number,
    index?: number,
    nonEmpty = false,
): ToolError | undefined {
    if (typeof value !== 'string') return invalid(`'${member}' must be a string.`, index);
    if (value.length > max) return invalid(`'${member}' has ${value.length} characters; at most ${max}.`, index);
    if (nonEmpty && value.trim() === '') return invalid(`'${member}' must not be empty.`, index);
    return undefined;
}

/** Attaches the operation index to a path validation error. */
export function atOperation(error: ToolError | undefined, index: number): ToolError | undefined {
    return error && {...error, operation: index};
}
