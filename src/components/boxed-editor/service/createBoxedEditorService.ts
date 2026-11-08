import type {Kind, PortableContext, PortableError, PortableNode, PortableSetValue} from '@edgerules/portable';
import {setWithLinkCheck} from '#lib/linkCheck';
import {isPortableError} from '#lib/portable';
import type {BoxedEditorService, BoxedRowData} from '../boxed-editor-types';
import {denormalize, denormalizeTypeField} from './denormalize';
import {normalizeNode, normalizeRoot} from './normalize';
import {
    authoredEntries,
    callableParameters,
    childNames,
    childPath,
    fieldsOf,
    hasFields,
    isFunctionDefinition,
    isRecord,
    lastPathName,
    parentPath,
    portableAtPath,
    withPortableAt,
} from '#lib/portableUtils';
import {createRowCache, type CachedRows} from './rowCache';

interface MutableDecisionService {
    get(path: string, kinds?: readonly Kind[]): PortableNode | PortableError;
    set(path: string, node: PortableSetValue): PortableNode | PortableError;
    remove(path: string): void | PortableError;
    rename(path: string, newName: string): void | PortableError;
    toPortable(): PortableContext;
    link(): void;
}

/** The engine reads a `set` value from any node the model holds. */
function asSetValue(node: unknown): PortableSetValue {
    return node as PortableSetValue;
}

function readAuthored(mutable: MutableDecisionService, path: string): {node?: PortableNode; schema?: PortableNode} {
    const schema = mutable.get(path);
    if (isPortableError(schema)) return {};
    if (path.endsWith(']')) return {node: schema, schema};
    const root = mutable.toPortable();
    const authored = path === '*' ? root : portableAtPath(root, path);
    if (
        isRecord(schema) &&
        (schema as unknown as Record<string, unknown>).type === 'array' &&
        isAuthoredArray(authored)
    ) {
        const items: PortableNode[] = [];
        for (let index = 0; ; index += 1) {
            const item = mutable.get(`${path}[${index}]`);
            if (isPortableError(item)) break;
            items.push(item);
        }
        return {node: items as unknown as PortableNode, schema};
    }
    return {
        node: materializeArrays(mutable, authored, schema, path),
        schema,
    };
}

function isAuthoredArray(node: PortableNode | undefined): boolean {
    if (Array.isArray(node)) return true;
    if (!isRecord(node)) return false;
    const record = node as unknown as Record<string, unknown>;
    return (
        record['@kind'] === 'expression' &&
        typeof record.expression === 'string' &&
        record.expression.trimStart().startsWith('[')
    );
}

function materializeArrays(
    mutable: MutableDecisionService,
    node: PortableNode | undefined,
    schema: PortableNode,
    path: string,
): PortableNode | undefined {
    if (node === undefined) return undefined;
    if (isRecord(schema) && (schema as unknown as Record<string, unknown>).type === 'array' && isAuthoredArray(node)) {
        const items: PortableNode[] = [];
        for (let index = 0; ; index += 1) {
            const item = mutable.get(`${path}[${index}]`);
            if (isPortableError(item)) break;
            items.push(item);
        }
        return items as unknown as PortableNode;
    }
    if (!isRecord(node) || !isRecord(schema)) return node;
    const nodeRecord = node as unknown as Record<string, unknown>;
    const schemaRecord = schema as unknown as Record<string, unknown>;
    if (isFunctionDefinition(nodeRecord) && isRecord(nodeRecord.body) && isRecord(schemaRecord.body)) {
        return {
            ...nodeRecord,
            body: materializeArrays(
                mutable,
                nodeRecord.body as unknown as PortableNode,
                schemaRecord.body as unknown as PortableNode,
                path,
            ),
        } as unknown as PortableNode;
    }
    const fields = fieldsOf(nodeRecord);
    const schemaFields = fieldsOf(schemaRecord);
    if (!fields || !schemaFields) return node;
    const nextFields: Record<string, unknown> = {...fields};
    for (const [name, child] of authoredEntries(node)) {
        const childSchema = schemaFields[name];
        if (childSchema !== undefined) {
            nextFields[name] = materializeArrays(mutable, child, childSchema as PortableNode, childPath(path, name));
        }
    }
    return {...nodeRecord, fields: nextFields} as unknown as PortableNode;
}

function loadRows(mutable: MutableDecisionService, path: string, modelName?: string): CachedRows {
    const {node, schema} = readAuthored(mutable, path);
    if (path === '*') {
        if (node === undefined) return {rows: []};
        const row = normalizeRoot(node as PortableContext, schema, modelName);
        return {row: {...row, children: undefined}, rows: row.children ?? []};
    }

    const rulesMatch = /^(.*)\.rules\[\d+\]$/.exec(path);
    const containingPath = rulesMatch?.[1] ?? parentPath(path);
    if (containingPath !== undefined) {
        const containing = loadRows(mutable, containingPath, modelName);
        const match = findNormalizedRow(containing.rows, path);
        if (match) {
            return {
                row: {...match, children: undefined},
                rows: match.children ?? [],
            };
        }
    }

    if (node === undefined) return {rows: []};
    const itemIndex = path.match(/\[(\d+)\]$/)?.[1];
    const name = lastPathName(path) ?? `Item ${itemIndex === undefined ? '' : Number(itemIndex) + 1}`;
    const row = normalizeNode(name, path, node, schema);
    return {
        row: {...row, children: undefined},
        rows: row.children ?? [],
    };
}

function findNormalizedRow(rows: BoxedRowData[], path: string): BoxedRowData | undefined {
    for (const row of rows) {
        if (row.path === path) return row;
        const nested = findNormalizedRow(row.children ?? [], path);
        if (nested) return nested;
    }
    return undefined;
}

function notifyAll(listeners: Set<() => void>): void {
    for (const listener of [...listeners]) listener();
}

// Inserts the entry `name` at `index` of the `fields` of a context-like node, or of a plain name map.
function insertIntoObject(
    destination: Record<string, unknown>,
    name: string,
    node: PortableNode,
    index: number,
): Record<string, unknown> {
    const entries = authoredEntries(destination).filter(([key]) => key !== name);
    entries.splice(Math.max(0, Math.min(index, entries.length)), 0, [name, node]);
    if (hasFields(destination)) return {...destination, fields: Object.fromEntries(entries)};
    const metadata = Object.entries(destination).filter(([key]) => key.startsWith('@'));
    return Object.fromEntries([...metadata, ...entries]);
}

function insertChild(
    destination: PortableNode,
    source: PortableNode,
    sourceName: string | undefined,
    index: number,
    removeIndex?: number,
): PortableNode {
    if (Array.isArray(destination)) {
        const result: PortableNode[] = [...destination];
        if (removeIndex !== undefined) result.splice(removeIndex, 1);
        result.splice(Math.max(0, Math.min(index, result.length)), 0, source);
        return result as unknown as PortableNode;
    }
    if (!isRecord(destination)) return destination;
    const record = destination as unknown as Record<string, unknown>;

    if (record['@kind'] === 'ruleset') {
        const rules: unknown[] = Array.isArray(record.rules) ? [...record.rules] : [];
        if (removeIndex !== undefined) rules.splice(removeIndex, 1);
        rules.splice(Math.max(0, Math.min(index, rules.length)), 0, source);
        return {...record, rules} as unknown as PortableNode;
    }
    if (isFunctionDefinition(record)) {
        const body = hasFields(record.body) ? record.body : {'@kind': 'context', fields: {}};
        return {
            ...record,
            body: insertIntoObject(body, sourceName ?? 'result', source, index),
        } as unknown as PortableNode;
    }
    return insertIntoObject(record, sourceName ?? `item${index + 1}`, source, index) as unknown as PortableNode;
}

function trailingIndex(path: string): number | undefined {
    const match = /\[(\d+)\]$/.exec(path);
    return match ? Number(match[1]) : undefined;
}

interface OptimisationOwner {
    path: string;
    node: PortableNode;
}

function optimisationOwner(root: PortableContext, path: string): OptimisationOwner | undefined {
    if (path === '*') return undefined;
    const name = /^[^.[\]]+/.exec(path)?.[0];
    if (!name) return undefined;
    const node = root.fields[name];
    if (!isRecord(node) || (node as unknown as Record<string, unknown>)['@kind'] !== 'optimise') {
        return undefined;
    }
    return {path: name, node: node as PortableNode};
}

function optimisationPathKeys(ownerPath: string, path: string): string[] {
    return path.slice(ownerPath.length + 1).split('.');
}

function updateNestedRecord(
    value: PortableNode,
    keys: string[],
    update: (record: Record<string, unknown>, key: string) => void,
): PortableNode {
    const visit = (record: Record<string, unknown>, index: number): Record<string, unknown> => {
        const result = {...record};
        const key = keys[index];
        if (index === keys.length - 1) {
            update(result, key);
            return result;
        }
        const child = result[key];
        if (!isRecord(child)) return result;
        result[key] = visit(child, index + 1);
        return result;
    };
    return visit(value as unknown as Record<string, unknown>, 0) as unknown as PortableNode;
}

function setOptimisationChild(owner: OptimisationOwner, path: string, node: PortableNode): PortableNode {
    const keys = optimisationPathKeys(owner.path, path);
    let value: unknown = node;
    if (keys.length === 1 && (keys[0] === 'variables' || keys[0] === 'constraints') && isRecord(node)) {
        value = Object.fromEntries(authoredEntries(node));
    }
    return updateNestedRecord(owner.node, keys, (record, key) => {
        record[key] = value;
    });
}

function getOptimisationChild(owner: OptimisationOwner, path: string): PortableNode | undefined {
    let current: unknown = owner.node;
    for (const key of optimisationPathKeys(owner.path, path)) {
        if (!isRecord(current)) return undefined;
        current = (current as unknown as Record<string, unknown>)[key];
    }
    return current as PortableNode | undefined;
}

function removeOptimisationChild(owner: OptimisationOwner, path: string): PortableNode {
    return updateNestedRecord(owner.node, optimisationPathKeys(owner.path, path), (record, key) => {
        delete record[key];
    });
}

function renameOptimisationChild(owner: OptimisationOwner, path: string, newName: string): PortableNode {
    return updateNestedRecord(owner.node, optimisationPathKeys(owner.path, path), (record, key) => {
        const renamed = Object.entries(record).map(([name, value]) =>
            name === key ? [newName, value] : [name, value],
        );
        for (const name of Object.keys(record)) delete record[name];
        Object.assign(record, Object.fromEntries(renamed));
    });
}

interface ComplexTypeOwner {
    path: string;
    node: PortableNode;
}

/**
 * The top-level named `type X: {...}` a nested member path belongs to, if any. The engine only
 * exposes a `type` as one atomic whole (`set_user_type` replaces its whole `TypeBody`);
 * no member path inside it — however deeply nested through inline anonymous object types — is
 * itself addressable by `set`/`remove`/`rename` (each rejects with `WrongFieldPath`). So every
 * member edit is coalesced into a whole-parent rewrite of this owner, the same shape
 * `optimisationOwner` already gives `@optimise` settings.
 */
function complexTypeOwner(root: PortableContext, path: string): ComplexTypeOwner | undefined {
    if (path === '*') return undefined;
    const name = /^[^.[\]]+/.exec(path)?.[0];
    if (!name) return undefined;
    const node = root.fields[name];
    if (!isRecord(node) || (node as unknown as Record<string, unknown>)['@kind'] !== 'type') {
        return undefined;
    }
    return {path: name, node: node as PortableNode};
}

// The keys of a member path inside a `type` node: each member is an entry of the `fields` of its structure type.
function complexTypePathKeys(ownerPath: string, path: string): string[] {
    return path
        .slice(ownerPath.length + 1)
        .split('.')
        .flatMap((name) => ['fields', name]);
}

function setComplexTypeChild(owner: ComplexTypeOwner, path: string, node: unknown): PortableNode {
    return updateNestedRecord(owner.node, complexTypePathKeys(owner.path, path), (record, key) => {
        record[key] = node;
    });
}

function removeComplexTypeChild(owner: ComplexTypeOwner, path: string): PortableNode {
    return updateNestedRecord(owner.node, complexTypePathKeys(owner.path, path), (record, key) => {
        delete record[key];
    });
}

function renameComplexTypeChild(owner: ComplexTypeOwner, path: string, newName: string): PortableNode {
    return updateNestedRecord(owner.node, complexTypePathKeys(owner.path, path), (record, key) => {
        const renamed = Object.entries(record).map(([name, value]) =>
            name === key ? [newName, value] : [name, value],
        );
        for (const name of Object.keys(record)) delete record[name];
        Object.assign(record, Object.fromEntries(renamed));
    });
}

/** The record that directly contains the member being renamed/removed — its own key set is what
 * a rename must not collide with. Unlike `mutable.rename` on an ordinary path, nothing here asks
 * the engine to validate the new name (the whole rewrite is a single opaque `set`), so
 * `rename()` below checks for a collision itself before ever calling `renameComplexTypeChild`. */
function complexTypeSiblingRecord(owner: ComplexTypeOwner, path: string): Record<string, unknown> | undefined {
    const keys = complexTypePathKeys(owner.path, path);
    let current: unknown = owner.node;
    for (let index = 0; index < keys.length - 1; index += 1) {
        if (!isRecord(current)) return undefined;
        current = (current as unknown as Record<string, unknown>)[keys[index]];
    }
    return isRecord(current) ? (current as unknown as Record<string, unknown>) : undefined;
}

function setChangedTopLevelWithLinkCheck(
    mutable: MutableDecisionService,
    previousRoot: PortableContext,
    nextRoot: PortableContext,
): PortableNode | PortableError {
    const previous = previousRoot.fields;
    const next = nextRoot.fields;
    const changed = new Set([...Object.keys(previous), ...Object.keys(next)]);
    const paths = [...changed].filter((path) => JSON.stringify(previous[path]) !== JSON.stringify(next[path]));

    const rollback = (): void => {
        for (const path of paths) {
            if (previous[path] === undefined) mutable.remove(path);
            else mutable.set(path, asSetValue(previous[path]));
        }
    };

    for (const path of paths) {
        const result = next[path] === undefined ? mutable.remove(path) : mutable.set(path, asSetValue(next[path]));
        if (isPortableError(result)) {
            rollback();
            return result;
        }
    }
    try {
        mutable.link();
        return nextRoot;
    } catch (error) {
        rollback();
        return error as PortableError;
    }
}

function duplicateNameError(path: string, name: string): PortableError {
    return {
        '@kind': 'error',
        type: 'DuplicateName',
        message: `A field named "${name}" already exists.`,
        path,
    } as PortableError;
}

function referencedParameterError(path: string, name: string): PortableError {
    return {
        '@kind': 'error',
        type: 'WrongFieldPath',
        message: `Cannot delete argument "${name}" because the callable body still references it.`,
        path,
    } as PortableError;
}

function identifierPattern(name: string): RegExp {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=[^\\p{L}\\p{N}_]|$)`, 'gu');
}

function containsIdentifier(node: PortableNode, name: string): boolean {
    if (Array.isArray(node)) return node.some((child) => containsIdentifier(child, name));
    if (!isRecord(node)) return false;
    const expression = node['expression'];
    if (typeof expression === 'string' && identifierPattern(name).test(expression)) {
        return true;
    }
    return Object.entries(node).some(
        ([key, child]) => key !== 'parameters' && key !== 'context' && containsIdentifier(child as PortableNode, name),
    );
}

// The keys of a Portable node whose entries are user-named: renaming an entry renames its key there.
const NAME_MAP_KEYS = new Set([
    'fields',
    'parameters',
    'context',
    'state',
    'do',
    'variables',
    'constraints',
    'when',
    'arguments',
]);

// The keys of a Portable node whose string value is never DSL text, nor a name of the model.
const NON_DSL_KEYS = new Set(['@kind', '@node', '@name', 'hitPolicy', 'using']);

function rewriteIdentifier(node: PortableNode, from: string, to: string, parentKey?: string): PortableNode {
    if (Array.isArray(node)) {
        return node.map((child) => rewriteIdentifier(child, from, to, parentKey)) as unknown as PortableNode;
    }
    if (typeof node === 'string') {
        if (parentKey !== undefined && NON_DSL_KEYS.has(parentKey)) return node;
        return (node as string).replace(identifierPattern(from), `$1${to}`) as unknown as PortableNode;
    }
    if (!isRecord(node)) return node;
    const renamesKeys = parentKey !== undefined && NAME_MAP_KEYS.has(parentKey);
    return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [
            renamesKeys && key === from ? to : key,
            rewriteIdentifier(child as PortableNode, from, to, key),
        ]),
    ) as unknown as PortableNode;
}

function renameWithLinkCheck(mutable: MutableDecisionService, path: string, newName: string): void | PortableError {
    const previousRoot = mutable.toPortable();
    const oldName = lastPathName(path);
    let previousLinkError: PortableError | undefined;
    try {
        mutable.link();
    } catch (error) {
        previousLinkError = error as PortableError;
    }
    const result = mutable.rename(path, newName);
    if (isPortableError(result)) return result;
    if (oldName && oldName !== newName) {
        const renamedRoot = mutable.toPortable();
        const migrated = rewriteIdentifier(
            renamedRoot as unknown as PortableNode,
            oldName,
            newName,
        ) as unknown as PortableContext;
        if (JSON.stringify(migrated) !== JSON.stringify(renamedRoot)) {
            const setResult = mutable.set('*', migrated);
            if (isPortableError(setResult)) {
                mutable.set('*', previousRoot);
                return setResult;
            }
        }
    }
    try {
        mutable.link();
        return undefined;
    } catch (error) {
        const nextLinkError = error as PortableError;
        if (
            previousLinkError &&
            previousLinkError.type === nextLinkError.type &&
            previousLinkError.path === nextLinkError.path &&
            previousLinkError.message === nextLinkError.message
        ) {
            return undefined;
        }
        mutable.set('*', previousRoot);
        return nextLinkError;
    }
}

type CallableParameterChange =
    | {kind: 'rename'; from: string; to: string}
    | {kind: 'add'; name: string; value: unknown}
    | {kind: 'remove'; name: string};

function parameterSeed(type: unknown): unknown {
    const name = typeof type === 'string' ? type : isRecord(type) ? type.type : undefined;
    if (name === 'number') return 0;
    if (name === 'boolean') return false;
    if (name === 'date') return '@"1970-01-01"';
    if (name === 'datetime') return '@"1970-01-01T00:00:00Z"';
    return '""';
}

function callableParameterChange(
    previous: PortableNode | undefined,
    row: BoxedRowData,
): CallableParameterChange | undefined {
    if ((row.kind !== 'function' && row.kind !== 'ruleset' && row.kind !== 'optimisation') || !isRecord(previous))
        return undefined;
    const oldParameters = callableParameters(previous);
    if (!isRecord(oldParameters)) return undefined;
    const oldNames = Object.keys(oldParameters);
    const newNames =
        (row as BoxedRowData & {parameters?: {name: string}[]}).parameters?.map((parameter) => parameter.name) ?? [];
    if (newNames.length === oldNames.length + 1) {
        const name = newNames.find((candidate) => !oldNames.includes(candidate));
        const next = denormalize(row);
        const parameters = callableParameters(next);
        if (name && isRecord(parameters)) {
            return {kind: 'add', name, value: parameterSeed(parameters[name])};
        }
    }
    if (oldNames.length === newNames.length + 1) {
        const name = oldNames.find((candidate) => !newNames.includes(candidate));
        if (name) return {kind: 'remove', name};
    }
    if (oldNames.length !== newNames.length) return undefined;
    const changed = oldNames.map((from, index) => ({from, to: newNames[index]})).filter(({from, to}) => from !== to);
    return changed.length === 1 ? {kind: 'rename', ...changed[0]} : undefined;
}

function rewriteInvocationArguments(
    node: PortableNode,
    functionPath: string,
    change: CallableParameterChange,
): PortableNode {
    if (Array.isArray(node)) {
        return node.map((child) => rewriteInvocationArguments(child, functionPath, change)) as unknown as PortableNode;
    }
    if (!isRecord(node)) return node;
    const result = Object.fromEntries(
        Object.entries(node).map(([name, child]) => [
            name,
            rewriteInvocationArguments(child as PortableNode, functionPath, change),
        ]),
    ) as Record<string, unknown>;
    if (result['@kind'] === 'invocation' && result.method === functionPath && isRecord(result.arguments)) {
        const args = {...result.arguments} as Record<string, unknown>;
        if (change.kind === 'rename' && Object.prototype.hasOwnProperty.call(args, change.from)) {
            result.arguments = Object.fromEntries(
                Object.entries(args).map(([name, value]) => [name === change.from ? change.to : name, value]),
            );
        } else if (change.kind === 'add') {
            args[change.name] = change.value;
            result.arguments = args;
        } else if (change.kind === 'remove') {
            delete args[change.name];
            result.arguments = args;
        }
    }
    return result as unknown as PortableNode;
}

function containsInvocation(node: PortableNode, functionPath: string): boolean {
    if (Array.isArray(node)) return node.some((child) => containsInvocation(child, functionPath));
    if (!isRecord(node)) return false;
    const record = node as unknown as Record<string, unknown>;
    if (record['@kind'] === 'invocation' && record.method === functionPath) return true;
    return Object.values(record).some((child) => containsInvocation(child as PortableNode, functionPath));
}

export interface BoxedEditorServiceOptions {
    /** The heading of the model row (`'*'`); 'Model' when it gives none. The model itself has no name. */
    modelName?: () => string | undefined;
}

export function createBoxedEditorService(
    mutable: MutableDecisionService,
    {modelName}: BoxedEditorServiceOptions = {},
): BoxedEditorService {
    const listeners = new Set<() => void>();
    const cache = createRowCache((path) => loadRows(mutable, path, modelName?.()));

    const commit = (
        path: string,
        operation: () => PortableNode | void | PortableError,
    ): PortableNode | void | PortableError => {
        const result = operation();
        if (!isPortableError(result)) {
            cache.invalidate(path);
            notifyAll(listeners);
        }
        return result;
    };

    return {
        getBoxedRowsData(path) {
            return cache.get(path).rows;
        },
        getBoxedRowData(path) {
            return cache.get(path).row;
        },
        setBoxedRowData(path, row) {
            return commit(path, () => {
                const root = mutable.toPortable();
                const previous = portableAtPath(root, path);
                const parameterChange = callableParameterChange(previous, row);
                if (
                    parameterChange?.kind === 'remove' &&
                    previous !== undefined &&
                    containsIdentifier(previous, parameterChange.name)
                ) {
                    return referencedParameterError(path, parameterChange.name);
                }
                if (parameterChange && containsInvocation(root as unknown as PortableNode, path)) {
                    const withFunction = withPortableAt(root, path, denormalize(row));
                    const migrated = rewriteInvocationArguments(
                        withFunction as unknown as PortableNode,
                        path,
                        parameterChange,
                    ) as unknown as PortableContext;
                    return setChangedTopLevelWithLinkCheck(mutable, root, migrated);
                }
                const owner = optimisationOwner(root, path);
                if (owner && owner.path !== path) {
                    let updated = owner.node;
                    if (row.kind === 'optimisation-objective') {
                        updated = removeOptimisationChild({...owner, node: updated}, `${owner.path}.maximise`);
                        updated = removeOptimisationChild({...owner, node: updated}, `${owner.path}.minimise`);
                        return setWithLinkCheck(
                            mutable,
                            owner.path,
                            asSetValue(
                                setOptimisationChild(
                                    {...owner, node: updated},
                                    `${owner.path}.${row.name}`,
                                    denormalize(row) as unknown as PortableNode,
                                ),
                            ),
                            asSetValue(owner.node),
                        );
                    }
                    return setWithLinkCheck(
                        mutable,
                        owner.path,
                        asSetValue(setOptimisationChild(owner, path, denormalize(row) as unknown as PortableNode)),
                        asSetValue(owner.node),
                    );
                }

                const typeOwner = complexTypeOwner(root, path);
                if (typeOwner && typeOwner.path !== path) {
                    return setWithLinkCheck(
                        mutable,
                        typeOwner.path,
                        asSetValue(setComplexTypeChild(typeOwner, path, denormalizeTypeField(row))),
                        asSetValue(typeOwner.node),
                    );
                }
                const previousNode = portableAtPath(root, path);
                return setWithLinkCheck(
                    mutable,
                    path,
                    denormalize(row),
                    previousNode === undefined ? undefined : asSetValue(previousNode),
                );
            }) as PortableNode | PortableError;
        },
        remove(path) {
            return commit(path, () => {
                const root = mutable.toPortable();
                const owner = optimisationOwner(root, path);
                if (owner && owner.path !== path) {
                    const result = mutable.set(owner.path, asSetValue(removeOptimisationChild(owner, path)));
                    return isPortableError(result) ? result : undefined;
                }
                const typeOwner = complexTypeOwner(root, path);
                if (typeOwner && typeOwner.path !== path) {
                    const result = mutable.set(typeOwner.path, asSetValue(removeComplexTypeChild(typeOwner, path)));
                    return isPortableError(result) ? result : undefined;
                }
                return mutable.remove(path);
            }) as void | PortableError;
        },
        rename(path, newName) {
            return commit(path, () => {
                const root = mutable.toPortable();
                const currentName = lastPathName(path);
                const ownerPath = parentPath(path);
                const siblings = ownerPath === '*' ? root : ownerPath ? portableAtPath(root, ownerPath) : undefined;
                if (newName !== currentName && childNames(siblings).includes(newName)) {
                    return duplicateNameError(path, newName);
                }

                const owner = optimisationOwner(root, path);
                if (owner && owner.path !== path) {
                    const renamed = renameOptimisationChild(owner, path, newName);
                    const updated =
                        currentName === undefined ? renamed : rewriteIdentifier(renamed, currentName, newName);
                    const result = setWithLinkCheck(mutable, owner.path, asSetValue(updated), asSetValue(owner.node));
                    return isPortableError(result) ? result : undefined;
                }
                const typeOwner = complexTypeOwner(root, path);
                if (typeOwner && typeOwner.path !== path) {
                    const siblings = complexTypeSiblingRecord(typeOwner, path);
                    if (
                        newName !== currentName &&
                        siblings &&
                        Object.prototype.hasOwnProperty.call(siblings, newName)
                    ) {
                        return duplicateNameError(path, newName);
                    }
                    const result = setWithLinkCheck(
                        mutable,
                        typeOwner.path,
                        asSetValue(renameComplexTypeChild(typeOwner, path, newName)),
                        asSetValue(typeOwner.node),
                    );
                    return isPortableError(result) ? result : undefined;
                }
                return renameWithLinkCheck(mutable, path, newName);
            }) as void | PortableError;
        },
        move(fromPath, toParentPath, index) {
            const root = mutable.toPortable();
            const sourceOwner = optimisationOwner(root, fromPath);
            const destinationOwner = optimisationOwner(root, toParentPath);
            const movesOptimisationChild =
                (sourceOwner && sourceOwner.path !== fromPath) ||
                (destinationOwner && destinationOwner.path !== toParentPath);
            if (movesOptimisationChild) {
                if (!sourceOwner || !destinationOwner || sourceOwner.path !== destinationOwner.path) {
                    const attempted = mutable.get(fromPath);
                    return isPortableError(attempted)
                        ? attempted
                        : {
                              '@kind': 'error',
                              type: 'WrongFieldPath',
                              message: 'Optimise declarations are root-only whole nodes',
                              path: fromPath,
                          };
                }
                const source = getOptimisationChild(sourceOwner, fromPath);
                const destination = getOptimisationChild(destinationOwner, toParentPath);
                if (source === undefined || (!Array.isArray(destination) && !isRecord(destination))) {
                    return {
                        '@kind': 'error',
                        type: 'EntryNotFound',
                        message: 'Path not found',
                        path: source === undefined ? fromPath : toParentPath,
                    };
                }
                const sameParent = parentPath(fromPath) === toParentPath;
                const destinationNode = insertChild(
                    destination,
                    source,
                    lastPathName(fromPath),
                    index,
                    sameParent ? trailingIndex(fromPath) : undefined,
                );
                let updated = setOptimisationChild(sourceOwner, toParentPath, destinationNode);
                if (!sameParent) {
                    updated = removeOptimisationChild({...sourceOwner, node: updated}, fromPath);
                }
                const result = mutable.set(sourceOwner.path, asSetValue(updated));
                if (isPortableError(result)) return result;
                cache.invalidate(fromPath);
                cache.invalidate(toParentPath);
                notifyAll(listeners);
                return undefined;
            }
            const source = portableAtPath(root, fromPath) ?? readAuthored(mutable, fromPath).node;
            const destination = readAuthored(mutable, toParentPath).node ?? portableAtPath(root, toParentPath);
            if (source === undefined || destination === undefined) {
                const read = mutable.get(source === undefined ? fromPath : toParentPath);
                return isPortableError(read)
                    ? read
                    : {
                          '@kind': 'error',
                          type: 'EntryNotFound',
                          message: `Path not found`,
                          path: source === undefined ? fromPath : toParentPath,
                      };
            }
            if (!Array.isArray(destination) && !isRecord(destination)) {
                const attemptedPath = childPath(toParentPath, lastPathName(fromPath) ?? `item${index + 1}`);
                const attempted = mutable.set(attemptedPath, asSetValue(source));
                if (isPortableError(attempted)) return attempted;
                const removed = mutable.remove(fromPath);
                if (isPortableError(removed)) return removed;
                cache.invalidate(fromPath);
                cache.invalidate(toParentPath);
                notifyAll(listeners);
                return undefined;
            }

            const fromParentPath = parentPath(fromPath);
            const destinationRecord = isRecord(destination)
                ? (destination as unknown as Record<string, unknown>)
                : undefined;
            const sameParent =
                fromParentPath === toParentPath ||
                (destinationRecord?.['@kind'] === 'ruleset' && fromParentPath === childPath(toParentPath, 'rules'));
            const destinationNode = insertChild(
                destination,
                source,
                lastPathName(fromPath),
                index,
                sameParent ? trailingIndex(fromPath) : undefined,
            );
            const rulesOwnerPath = toParentPath.endsWith('.rules') ? parentPath(toParentPath) : undefined;
            const rulesOwner = rulesOwnerPath === undefined ? undefined : portableAtPath(root, rulesOwnerPath);
            const writePath = rulesOwnerPath !== undefined && isRecord(rulesOwner) ? rulesOwnerPath : toParentPath;
            const writeNode =
                rulesOwnerPath !== undefined && isRecord(rulesOwner)
                    ? ({
                          ...(rulesOwner as unknown as Record<string, unknown>),
                          rules: destinationNode,
                      } as unknown as PortableNode)
                    : destinationNode;
            const inserted = mutable.set(writePath, asSetValue(writeNode));
            if (isPortableError(inserted)) return inserted;

            if (!sameParent) {
                const removed = mutable.remove(fromPath);
                if (isPortableError(removed)) return removed;
            }
            cache.invalidate(fromPath);
            cache.invalidate(toParentPath);
            notifyAll(listeners);
            return undefined;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        invalidate(path) {
            cache.invalidate(path);
            notifyAll(listeners);
        },
        toPortable() {
            return mutable.toPortable();
        },
        link() {
            try {
                mutable.link();
                return undefined;
            } catch (error) {
                return error as PortableError;
            }
        },
    };
}
