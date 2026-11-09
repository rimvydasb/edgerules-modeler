import type {PortableNode, PortablePlaceholderValue} from '@edgerules/portable';

export const METADATA_KEYS = new Set(['@kind', '@node', '@name', 'linked']);

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMetadataKey(key: string): boolean {
    return key.startsWith('@') || METADATA_KEYS.has(key);
}

/**
 * The `@kind`s whose user-named entries are in a `fields` map: a `context`, a root `workbook`, a `type` and a `facts`
 * declaration.
 */
const FIELDS_KINDS = new Set(['context', 'workbook', 'type', 'facts']);

/** True for a node whose user-named entries are in its `fields` map. */
export function hasFields(value: unknown): value is Record<string, unknown> & {fields: Record<string, unknown>} {
    return isRecord(value) && typeof value['@kind'] === 'string' && FIELDS_KINDS.has(value['@kind']);
}

/** A Portable object node: a record with an `@kind`. */
export type PortableRecord = Record<string, unknown> & {'@kind': string};

/** True for a `context` or a root `workbook` node. */
export function isContextNode(value: unknown): value is PortableRecord {
    return isRecord(value) && (value['@kind'] === 'context' || value['@kind'] === 'workbook');
}

/** The `fields` map of a node that has one, else undefined. */
export function fieldsOf(value: unknown): Record<string, unknown> | undefined {
    if (!hasFields(value)) return undefined;
    return isRecord(value.fields) ? value.fields : {};
}

/**
 * The user-named entries of `value`: the `fields` of a `context`, `workbook`, `type` or `facts` node, or the entries of
 * a plain name map (`parameters`, `variables`, `constraints`, `state`, `do`). Any other node has none.
 */
export function authoredEntries(value: unknown): Array<[string, PortableNode]> {
    if (!isRecord(value)) return [];
    const fields = fieldsOf(value);
    const map = fields ?? (value['@kind'] === undefined ? value : undefined);
    if (!map) return [];
    return Object.entries(map)
        .filter(([key, child]) => !key.startsWith('@') && child !== undefined)
        .map(([key, child]) => [key, child as PortableNode]);
}

/** A `@kind: 'context'` node with `entries` as its fields. */
export function contextNode(
    entries: Record<string, unknown> = {},
    kind: 'context' | 'workbook' = 'context',
): Record<string, unknown> & {'@kind': 'context' | 'workbook'; fields: Record<string, unknown>} {
    return {'@kind': kind, fields: entries};
}

export function childPath(parent: string, name: string): string {
    return parent === '*' ? name : `${parent}.${name}`;
}

// '*' + 'credit.balance' -> 'credit.balance'; 'creditDecision' + 'creditDecision.approved' -> 'approved'.
// Inverse of `test-cases-service`'s own `qualifyPath`: derives the subject-relative path from a
// row's fully qualified one — `undefined` when `path` doesn't fall under `subjectId` at all.
export function unqualifyPath(subjectId: string, path: string): string | undefined {
    if (subjectId === '*') return path;
    if (path === subjectId) return '';
    if (path.startsWith(`${subjectId}.`)) return path.slice(subjectId.length + 1);
    return undefined;
}

export function indexedPath(parent: string, index: number): string {
    return `${parent}[${index}]`;
}

export function pathDepth(path: string): number {
    if (path === '*') return 0;
    // Each `.` and each `[n]` index is one nesting level, so list/relation items sit one block
    // right of their owner.
    return (path.match(/\.|\[/g) ?? []).length;
}

export function parentPath(path: string): string | undefined {
    if (path === '*') return undefined;
    if (path.endsWith(']')) {
        const bracket = path.lastIndexOf('[');
        return bracket > -1 ? path.slice(0, bracket) : '*';
    }
    const dot = path.lastIndexOf('.');
    return dot === -1 ? '*' : path.slice(0, dot);
}

export function lastPathName(path: string): string | undefined {
    if (path === '*') return undefined;
    if (path.endsWith(']')) return undefined;
    const dot = path.lastIndexOf('.');
    return path.slice(dot + 1);
}

// The `@kind` of a callable whose body is a context or an expression: a `func` (`method`), a `decision` or a `service`.
const FUNCTION_DEFINITION_KINDS = new Set(['method', 'service', 'decision']);

// The `@kind` of a layer declaration (declaration or interface view): its one parameter, the decision context, is in
// `context`, not in `parameters`.
const LAYER_KINDS = new Set(['decision', 'decision-interface', 'facts']);

/** A `func`, `decision` or `service` declaration: a `parameters` (or `context`) / `body` callable. */
export function isFunctionDefinition(value: unknown): value is PortableRecord {
    return isRecord(value) && typeof value['@kind'] === 'string' && FUNCTION_DEFINITION_KINDS.has(value['@kind']);
}

/** True for a `decision` or `facts` declaration, in the declaration or the interface view. */
export function isLayerDeclaration(value: unknown): boolean {
    return isRecord(value) && typeof value['@kind'] === 'string' && LAYER_KINDS.has(value['@kind']);
}

/**
 * The parameters of a callable, declaration or interface: `context` for a `decision` / `facts` declaration (exactly
 * one entry, the decision context), `parameters` for any other callable.
 */
export function callableParameters(value: unknown): unknown {
    if (!isRecord(value)) return undefined;
    return isLayerDeclaration(value) ? value.context : value.parameters;
}

function tokenizePath(path: string): Array<string | number> {
    if (path === '*' || path === '') return [];
    const tokens: Array<string | number> = [];
    const matcher = /(?:^|\.)([^.[\]]+)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(path)) !== null) {
        tokens.push(match[1] ?? Number(match[2]));
    }
    return tokens;
}

function portableChild(value: unknown, token: string | number): unknown {
    if (typeof token === 'number') {
        return Array.isArray(value) ? value[token] : undefined;
    }
    if (!isRecord(value)) return undefined;

    if (token === '*') return value;
    if (isFunctionDefinition(value)) return portableChild(value.body, token);
    const fields = fieldsOf(value);
    if (fields) return fields[token];
    return value[token];
}

export function portableAtPath(root: PortableNode, path: string): PortableNode | undefined {
    let current: unknown = root;
    for (const token of tokenizePath(path)) {
        current = portableChild(current, token);
        if (current === undefined) return undefined;
    }
    return current as PortableNode;
}

function quoteKey(key: string): string {
    return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

export function typedValueText(value: PortablePlaceholderValue): string {
    const details: string[] = [];
    const item = value.items;
    const itemType = typeof item === 'string' ? item : item?.['@kind'] === 'placeholder' ? item.type : '';
    const type = value.type === 'array' ? `${itemType}[]` : value.type;
    details.push(type);
    for (const [key, child] of Object.entries(value)) {
        if (
            key.startsWith('@') ||
            key === 'linked' ||
            key === 'type' ||
            key === 'items' ||
            key === 'writeOnly' ||
            child === undefined
        ) {
            continue;
        }
        details.push(`${key}: ${formatPortableValue(child)}`);
    }
    return `<${details.join(', ')}>`;
}

export function formatPortableValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.map(formatPortableValue).join(', ')}]`;
    if (!isRecord(value)) return String(value);

    switch (value['@kind']) {
        case 'expression':
            return formatPortableValue(value.expression);
        case 'placeholder':
            return typedValueText(value as unknown as PortablePlaceholderValue);
        case 'invocation': {
            const args = value.arguments;
            const argumentText = Array.isArray(args)
                ? args.map(formatPortableValue).join(', ')
                : isRecord(args)
                  ? Object.entries(args)
                        .map(([name, argument]) => `${quoteKey(name)}: ${formatPortableValue(argument)}`)
                        .join(', ')
                  : '';
            return `${String(value.method ?? '')}(${argumentText})`;
        }
        default: {
            const entries = authoredEntries(value)
                .map(([name, child]) => `${quoteKey(name)}: ${formatPortableValue(child)}`)
                .join(', ');
            return `{ ${entries} }`;
        }
    }
}

export function typeText(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (!isRecord(value)) return undefined;
    if (value['@kind'] === 'type') return typeof value.alias === 'string' ? value.alias : 'object';
    if (typeof value.type !== 'string') return undefined;
    if (value.type !== 'array') return value.type;
    // An inline record element (`items` is a structure `type`) reads as `object[]`, as the engine's value types do.
    return `${typeText(value.items) ?? ''}[]`;
}

function withChild(node: unknown, tokens: ReadonlyArray<string | number>, value: unknown): unknown {
    if (tokens.length === 0) return value;
    const [token, ...rest] = tokens;
    if (typeof token === 'number') {
        if (!Array.isArray(node)) return node;
        const next = [...node];
        next[token] = withChild(node[token], rest, value);
        return next;
    }
    if (!isRecord(node)) return node;
    const record: Record<string, unknown> = node;
    if (isFunctionDefinition(node)) return {...record, body: withChild(record.body, tokens, value)};
    const fields = fieldsOf(record);
    if (fields) return {...record, fields: {...fields, [token]: withChild(fields[token], rest, value)}};
    return {...record, [token]: withChild(record[token], rest, value)};
}

/** A copy of `root` with `value` at the model path `path` (the inverse of `portableAtPath`). */
export function withPortableAt<T>(root: T, path: string, value: unknown): T {
    return withChild(root, tokenizePath(path), value) as T;
}

/**
 * The names of the entries directly under `node`, as model paths address them: the `fields` of a context, `type` or
 * `facts`, the `body` fields of a `func`, `decision` or `service`, or the keys of a plain name map.
 */
export function childNames(node: unknown): string[] {
    const owner = isFunctionDefinition(node) ? node.body : node;
    return authoredEntries(owner).map(([name]) => name);
}
