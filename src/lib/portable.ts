import type {PortableError} from '@edgerules/portable';

export function isPortableError(value: unknown): value is PortableError {
    return typeof value === 'object' && value !== null && (value as {'@kind'?: unknown})['@kind'] === 'error';
}

/** The call that an `E115` argument type-mismatch link error names. */
export interface ArgumentMismatch {
    callee: string;
    argument: string;
    field?: string; // The path of the field that holds the call, when the engine names it.
}

const ARGUMENT_MISMATCH = /E115: function '([^']+)' argument '([^']+)' expects .+? found .+?(?: in field '([^']+)')?$/;

/** The callee and argument of an `E115` argument type-mismatch error, or undefined for any other error. */
export function argumentMismatchOf(error: PortableError): ArgumentMismatch | undefined {
    const match = ARGUMENT_MISMATCH.exec(error.message);
    if (!match) return undefined;
    const [, callee, argument, field] = match;
    return {callee, argument, ...(field !== undefined && {field})};
}
