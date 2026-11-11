import {fail, type ToolError} from './toolResult';

/** '*' for the whole model, or a dotted model path, for example 'applicant.age' or 'library.eligibility'. */
export type ModelPath = string;

/** '*' for the tests of the whole model, otherwise the path of a callable. */
export type TestSubject = string;

/** The Project Explorer sections that hold model entries. */
export type ModelSection = 'types' | 'factsLibrary' | 'methods' | 'decisions' | 'services' | 'variables' | 'workbooks';

export const README_PATH = 'doc:README.md';

const SEGMENT = '[A-Za-z_][A-Za-z0-9_]*';
const DOTTED_PATH = new RegExp(`^${SEGMENT}(\\.${SEGMENT})*$`);

function invalid(member: string, value: unknown, expected: string): ToolError {
    return fail('InvalidInput', `'${member}' must be ${expected}; got ${JSON.stringify(value)}.`).error;
}

/** `undefined` when `value` is '*' or a dotted model path; otherwise the `InvalidInput` error naming `member`. */
export function validateModelPath(value: unknown, member = 'path'): ToolError | undefined {
    if (value === '*' || (typeof value === 'string' && DOTTED_PATH.test(value))) return undefined;
    return invalid(member, value, "'*' or a dotted model path such as 'applicant.age'");
}

/** As `validateModelPath`, and also accepts 'doc:README.md'. */
export function validateSourcePath(value: unknown, member = 'path'): ToolError | undefined {
    if (value === README_PATH) return undefined;
    if (validateModelPath(value, member) === undefined) return undefined;
    return invalid(member, value, `'*', a dotted model path or '${README_PATH}'`);
}

/** '*' or the dotted path of a callable. Whether the callable exists is checked by the caller. */
export function validateTestSubject(value: unknown, member = 'subject'): ToolError | undefined {
    if (validateModelPath(value, member) === undefined) return undefined;
    return invalid(member, value, "'*' or the dotted path of a function");
}

/** `undefined` when `input` is an object whose members are all in `allowed`; otherwise the `InvalidInput` error. */
export function validateInputMembers(input: unknown, allowed: readonly string[]): ToolError | undefined {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return fail('InvalidInput', 'The input must be a JSON object.').error;
    }
    const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
    if (unknown.length === 0) return undefined;
    const accepted = allowed.length > 0 ? `; accepted: ${allowed.join(', ')}` : '; the tool takes no members';
    return fail('InvalidInput', `Unknown input member '${unknown[0]}'${accepted}.`).error;
}
