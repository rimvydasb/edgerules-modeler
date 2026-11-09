/**
 * Test helpers that read a Portable model in a compact form, so an assertion names the model entries and their DSL
 * text instead of the full node structure:
 *
 * - an `expression` node becomes its expression text, a number or boolean literal its JSON value:
 *   `{'@kind': 'expression', expression: 'a + 1'}` -> `'a + 1'`, `{'@kind': 'expression', expression: '10'}` -> `10`;
 * - a `context` node becomes the object of its compact fields; its annotations (`@node`, `@name`) stay;
 * - a `workbook` or `type` node keeps `@kind`, and has its compact fields as its own keys;
 * - any other node keeps its keys, with each value compact.
 *
 * `compactModel(service)` is the compact root: `{amount: 10, monthly: {'@kind': 'method', ...}}`.
 */
export function compact(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(compact);
    if (typeof node !== 'object' || node === null) return node;
    const record = node as Record<string, unknown>;
    if (record['@kind'] === 'expression' && Object.keys(record).every((key) => KEYS_OF_EXPRESSION.has(key))) {
        return literal(record.expression);
    }
    if (record['@kind'] === 'context' || record['@kind'] === 'workbook' || record['@kind'] === 'type') {
        const {fields = {}, ...rest} = record;
        const own = record['@kind'] === 'context' ? withoutKind(rest) : rest;
        return {
            ...compactEntries(own),
            ...compactEntries(fields as Record<string, unknown>),
        };
    }
    return compactEntries(record);
}

function compactEntries(record: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, compact(child)]));
}

function withoutKind(record: Record<string, unknown>): Record<string, unknown> {
    const {'@kind': _kind, linked: _linked, ...rest} = record;
    return rest;
}

// A number or boolean literal as its JSON value; any other expression text stays text.
function literal(expression: unknown): unknown {
    if (typeof expression !== 'string') return expression;
    if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);
    if (expression === 'true' || expression === 'false') return expression === 'true';
    return expression;
}

// The keys an `expression` node may have and still read as its text alone. An annotated expression keeps its node.
const KEYS_OF_EXPRESSION = new Set(['@kind', 'expression', 'variables', 'type', 'items', 'linked']);

/** The compact root of the model of `service` (see `compact`). */
export function compactModel(service: {toPortable(): unknown}): Record<string, unknown> {
    return compact(service.toPortable()) as Record<string, unknown>;
}
