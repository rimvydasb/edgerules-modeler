import type {Kind, PortableContext, PortableError, PortableNode, PortableSetValue} from '@edgerules/portable';
import {listCallables, type CallableSource} from '#lib/callables';
import {readPaths} from '#lib/expressionReads';
import {setWithLinkCheck, type LinkCheckService} from '#lib/linkCheck';
import {argumentMismatchOf, isPortableError} from '#lib/portable';
import {
    addArgument as addFunctionArgument,
    addConditionColumn,
    buildExpressionEmbedContext,
    createBoxedEditorService,
    denormalize,
    moveArgument as moveFunctionArgument,
    moveConditionColumn,
    removeArgument as removeFunctionArgument,
    removeConditionColumn,
    renameArgument as renameFunctionArgument,
    renameConditionColumn,
    renameActionColumn,
    uniqueName,
} from '../../boxed-editor/internal';
import type {BoxedTableRowData, SignatureParameter} from '../../boxed-editor';
import {
    callableParameters,
    childPath,
    fieldsOf,
    formatPortableValue,
    hasFields,
    isFunctionDefinition,
    isRecord,
    parentPath,
    portableAtPath,
    typeText,
    type PortableRecord,
} from '#lib/portableUtils';
import type {FlowEditorService, FlowNodeRef} from '../flow-editor-types';
import type {ExpressionNodeModel} from '../expression-node/types';
import type {CalleeRef, FunctionNodeModel, NodeArgument, NodeResult} from '../function-node/types';
import type {ListInputNodeModel} from '../list-input-node/types';
import type {InputDeclarationKind, ObjectInputField, ObjectInputNodeModel} from '../object-input-node/types';
import type {ParameterField, ParameterNodeModel} from '../parameter-node/types';
import type {ReturnNodeModel} from '../return-node/types';
import type {ValueInputNodeModel} from '../value-input-node/types';

type InputKind = 'object-input' | 'list-input' | 'value-input';

// `@node` of the `return` record that is the result of a service.
const RETURN_ANNOTATION = 'ReturnNode';
// The body field whose value a function returns.
const RETURN_FIELD = 'return';

/** Structural subset of `MutableDecisionService` that the flow editor service uses. */
export interface FlowEditorEngine extends CallableSource, LinkCheckService {
    get(path: string, kinds?: readonly Kind[]): PortableNode | PortableError;
    toPortable(): PortableContext;
    execute(method: string, input?: Record<string, unknown>): Promise<unknown>;
}

// The invocation as the node edits it. Arguments are expression texts, as in the Portable format.
interface InvocationState {
    method?: string;
    label?: string;
    args: Record<string, string>;
}

interface CalleeSchema {
    ref: CalleeRef;
    results: NodeResult[];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\[\d+\]|\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function parametersOf(schema: unknown): SignatureParameter[] {
    const parameters = callableParameters(schema);
    if (!isRecord(parameters)) return [];
    return Object.entries(parameters).map(([name, type]) => ({
        name,
        type: typeText(type) ?? 'any',
    }));
}

// The fields of a structure `type` node (an inferred result type), or undefined for any other type.
function structureFields(type: unknown): Record<string, unknown> | undefined {
    return isRecord(type) && type['@kind'] === 'type' && isRecord(type.fields) ? type.fields : undefined;
}

function resultsOf(schema: unknown, kind: CalleeRef['kind']): NodeResult[] {
    const ret = isRecord(schema) ? schema.return : undefined;
    const fields = structureFields(ret);
    if (fields) {
        return Object.entries(fields).map(([name, type]) => ({name, type: typeText(type) ?? 'any', renamable: true}));
    }
    return [{name: 'result', type: typeText(ret) ?? 'any', renamable: kind === 'ruleset', whole: true}];
}

function returnLabelOf(results: NodeResult[], schema: unknown): string {
    const ret = isRecord(schema) ? schema.return : undefined;
    if (structureFields(ret)) {
        return `{ ${results.map((result) => result.name).join(', ')} }`;
    }
    return results[0]?.type ?? 'any';
}

// The `@kind` of a callable that is not a function definition: a ruleset, a loop, an optimisation or an external one.
const CALLABLE_KINDS = new Set(['ruleset', 'loop', 'optimise', 'external-method']);

// A typed hole of a workbook (`applicant: <Applicant>`): an input the host binds on `execute`.
function isTypedHole(node: unknown): node is PortableRecord {
    return isRecord(node) && node['@kind'] === 'placeholder';
}

// The named entries of a context-like node.
function entriesOf(node: unknown): [string, unknown][] {
    return Object.entries(fieldsOf(node) ?? {});
}

// A context that holds only declarations (a namespace of functions, rulesets or types): it has no value to draw.
function isNamespace(node: Record<string, unknown>): boolean {
    const children = entriesOf(node);
    return (
        children.length > 0 &&
        children.every(
            ([, child]) =>
                declarationKind(child) !== undefined || isFunctionDefinition(child) || isNamespaceChild(child),
        )
    );
}

function isNamespaceChild(node: unknown): boolean {
    return isRecord(node) && node['@kind'] === 'context' && isNamespace(node);
}

function isInvocation(node: unknown): node is PortableRecord {
    return isRecord(node) && node['@kind'] === 'invocation';
}

// A computed or literal value: an expression node, or a literal the Portable format writes bare.
function isExpression(node: unknown): boolean {
    if (isRecord(node)) return node['@kind'] === 'expression';
    return typeof node === 'number' || typeof node === 'boolean' || typeof node === 'string' || Array.isArray(node);
}

function countInvocations(node: unknown, method: string): number {
    if (Array.isArray(node)) return node.reduce((sum, item) => sum + countInvocations(item, method), 0);
    if (!isRecord(node)) return 0;
    let count = isInvocation(node) && node.method === method ? 1 : 0;
    for (const child of Object.values(node)) count += countInvocations(child, method);
    return count;
}

function bindingOf(text: string | undefined): NodeArgument['binding'] {
    if (text === undefined) return undefined;
    return {kind: PATH_PATTERN.test(text.trim()) ? 'path' : 'value', text};
}

// A positional call `f(a, b)` stores its arguments as a list; `parameters` names them by position.
function argumentTexts(node: Record<string, unknown>, parameters: string[]): Record<string, string> {
    const raw = node.arguments;
    const args: Record<string, string> = {};
    const entries: [string | undefined, unknown][] = Array.isArray(raw)
        ? raw.map((value, index) => [parameters[index], value])
        : isRecord(raw)
          ? Object.entries(raw)
          : [];
    for (const [name, value] of entries) {
        if (name === undefined) continue;
        if (typeof value === 'string') args[name] = value;
        else if (isRecord(value) && typeof value.expression === 'string') args[name] = value.expression;
        else if (value !== undefined) args[name] = JSON.stringify(value);
    }
    return args;
}

export interface FlowEditorServiceOptions {
    // The context whose direct fields are the nodes: '*' (the default), a context path or a function path, whose
    // body is the context. New nodes are fields of it.
    root?: string;
}

export function createFlowEditorService(
    engine: FlowEditorEngine,
    {root = '*'}: FlowEditorServiceOptions = {},
): FlowEditorService {
    const boxed = createBoxedEditorService(engine as never);
    const drafts = new Map<string, InvocationState>();
    const errors = new Map<string, {parameter: string; message: string}>();
    const listeners = new Set<() => void>();

    const notify = () => {
        for (const listener of [...listeners]) listener();
    };

    // The type of a list path from the linked model, and the field names of its items when they are records.
    // The linked node at `path`, `undefined` when the engine has none.
    const linkedAt = (path: string): Record<string, unknown> | undefined => {
        try {
            const node = engine.get(path);
            return isRecord(node) && node['@kind'] !== 'error' ? node : undefined;
        } catch {
            return undefined;
        }
    };

    // The structure fields of a type: an inline structure `type`, or a `type` declaration by name.
    const fieldsOfType = (type: unknown): Record<string, unknown> | undefined =>
        structureFields(type) ?? (typeof type === 'string' ? structureFields(linkedAt(type)) : undefined);

    // The type of a list path from the linked model, and the field names of its items when they are records.
    const declaredListType = (path: string): {type: string; columns?: string[]} => {
        const schema = linkedAt(path);
        if (!isRecord(schema)) return {type: 'any[]'};
        const columns = Object.keys(fieldsOfType(schema.items) ?? {});
        return {type: typeText(schema) ?? 'any[]', ...(columns.length > 0 && {columns})};
    };

    // Schemas exist only for a linked model; a model that fails to link has no callees to offer.
    const ensureLinked = () => {
        try {
            engine.link();
        } catch {
            // The reads below return errors and are skipped.
        }
    };

    const readSchema = (ref: {path: string; kind: CalleeRef['kind']}): CalleeSchema | undefined => {
        const schema = engine.get(ref.path);
        if (isPortableError(schema)) return undefined;
        const results = resultsOf(schema, ref.kind);
        return {
            ref: {
                path: ref.path,
                kind: ref.kind,
                parameters: parametersOf(schema),
                returnLabel: returnLabelOf(results, schema),
            },
            results,
        };
    };

    const calleeSchemas = (): CalleeSchema[] => {
        ensureLinked();
        const schemas: CalleeSchema[] = [];
        for (const callable of listCallables(engine)) {
            // A loop and an optimisation are called like a function: named arguments, a typed result.
            const schema = readSchema({
                path: callable.path,
                kind: callable.kind === 'ruleset' ? 'ruleset' : 'function',
            });
            if (schema) schemas.push(schema);
        }
        return schemas;
    };

    const committedAt = (field: string): Record<string, unknown> | undefined => {
        const node = portableAtPath(engine.toPortable() as PortableNode, field);
        return isInvocation(node) ? node : undefined;
    };

    // The input node kind of an `@InputNode` field: a record, an expression whose value is a list, or another expression.
    const inputKindOf = (field: string, node: unknown): InputKind | undefined => {
        if (!isRecord(node)) return undefined;
        if (node['@kind'] === 'context') return 'object-input';
        if (node['@kind'] !== 'expression') return undefined;
        ensureLinked();
        const type = typeText(engine.get(field));
        return type?.endsWith('[]') ? 'list-input' : 'value-input';
    };

    // True when `field` is a direct field of the flow context.
    const isFlowField = (field: string): boolean => (parentPath(field) ?? '*') === root;

    // A list literal of the flow is a list input node, annotated or not, unless it reads other nodes.
    const isListLiteral = (node: Record<string, unknown>): boolean =>
        node['@kind'] === 'expression' && String(node.expression).trim().startsWith('[');

    // The nodes a value of the flow context can read: the other value fields of the context (not its functions, types
    // or namespaces) and the parameters of its function or service.
    const flowNames = (field: string): string[] => {
        const own = field.split('.').at(-1);
        const owner: unknown =
            root === '*' ? undefined : portableAtPath(engine.toPortable() as unknown as PortableNode, root);
        const parameters = callableParameters(owner);
        const values = Object.entries(contextAt(root) ?? {})
            .filter(
                ([, child]) =>
                    declarationKind(child) === undefined &&
                    !isFunctionDefinition(child) &&
                    !isNamespaceChild(child) &&
                    !(isRecord(child) && CALLABLE_KINDS.has(String(child['@kind']))),
            )
            .map(([name]) => name);
        return [...values, ...(isRecord(parameters) ? Object.keys(parameters) : [])].filter((name) => name !== own);
    };

    // The paths of the flow that a record or a list literal reads, such as `mix.status`: a value computed from other
    // nodes. The keys of a record are names, not reads; only its values are read.
    const flowReads = (field: string, node: unknown): string[] => {
        // A field of the record itself shadows a node of the same name.
        const own = new Set(isRecord(node) && node['@kind'] === 'context' ? Object.keys(fieldsOf(node) ?? {}) : []);
        const names = new Set(flowNames(field).filter((name) => !own.has(name)));
        const reads = new Set<string>();
        for (const text of valueTexts(node)) {
            for (const path of readPaths(text)) if (names.has(path.split('.')[0]!)) reads.add(path);
        }
        return [...reads];
    };

    // A record or a list literal that reads other nodes of the flow, without an `@InputNode` annotation: a computed
    // value, drawn as an expression node.
    const isComputedValue = (field: string, node: Record<string, unknown>): boolean =>
        isFlowField(field) &&
        node['@node'] !== 'InputNode' &&
        (node['@kind'] === 'context' || isListLiteral(node)) &&
        flowReads(field, node).length > 0;

    // A record of the flow is an object input node, annotated or not, unless it is a namespace of declarations or it
    // computes its fields from other nodes.
    const isInputRecord = (field: string, node: Record<string, unknown>): boolean =>
        isFlowField(field) && !isNamespace(node) && !isComputedValue(field, node);

    // The input node kind of a direct field of the flow: a record, a list literal, or an `@InputNode` expression.
    const inputNodeKind = (field: string, node: Record<string, unknown>): InputKind | undefined => {
        if (!isFlowField(field)) return undefined;
        if (node['@kind'] === 'context') return isInputRecord(field, node) ? 'object-input' : undefined;
        if (node['@node'] === 'InputNode') return inputKindOf(field, node);
        if (!isListLiteral(node) || isComputedValue(field, node)) return undefined;
        return inputKindOf(field, node) === 'list-input' ? 'list-input' : undefined;
    };

    // The record, the list or the value at `field` when it is an input node.
    const inputAt = (field: string): Record<string, unknown> | undefined => {
        const node = portableAtPath(engine.toPortable() as PortableNode, field);
        return isRecord(node) && inputNodeKind(field, node) ? node : undefined;
    };

    // The record at `field` when it is an input node.
    const objectInputAt = (field: string): Record<string, unknown> | undefined => {
        const node = portableAtPath(engine.toPortable() as PortableNode, field);
        return isRecord(node) && node['@kind'] === 'context' && isInputRecord(field, node) ? node : undefined;
    };

    // Rewrites the fields of an input record in one link-checked write; the annotations stay.
    const editInput = (
        field: string,
        edit: (entries: [string, unknown][]) => [string, unknown][] | undefined,
    ): PortableError | void => {
        const input = objectInputAt(field);
        if (!input) return failure(`node '${field}' does not exist`);
        const next = edit(entriesOf(input));
        if (!next) return;
        const record = {...input, fields: Object.fromEntries(next)} as unknown as PortableSetValue;
        const result = setWithLinkCheck(engine, field, record, input as unknown as PortableSetValue);
        if (isPortableError(result)) return result;
        notify();
    };

    // The context node at `path`: the model for '*', a context or a workbook, the body of a function or a service.
    const contextNodeAt = (path: string): Record<string, unknown> | undefined => {
        const model = engine.toPortable() as unknown as PortableNode;
        const node: unknown = path === '*' ? model : portableAtPath(model, path);
        const context = isFunctionDefinition(node) ? node.body : node;
        return isRecord(context) ? context : undefined;
    };

    // The named entries (the `fields`) of the context at `path`.
    const contextAt = (path: string): Record<string, unknown> | undefined => fieldsOf(contextNodeAt(path));

    // The field names next to `field`, drafts included.
    const siblingNames = (field: string): Set<string> => {
        const parent = parentPath(field) ?? '*';
        const draftNames = [...drafts.keys()].filter((draft) => (parentPath(draft) ?? '*') === parent);
        return new Set([
            ...Object.keys(contextAt(parent) ?? {}),
            ...draftNames.map((draft) => draft.split('.').at(-1)!),
        ]);
    };

    // `path` as the argument of a node at `field`. A function body cannot read a path through its own function, and
    // nothing can reference a workbook, so a field of that body or workbook is read by its short name; elsewhere the
    // path from the model root stays.
    const bindingPath = (field: string, path: string): string => {
        const scope = parentPath(field) ?? '*';
        if (scope === '*' || !path.startsWith(`${scope}.`)) return path;
        const owner: unknown = portableAtPath(engine.toPortable() as unknown as PortableNode, scope);
        return isFunctionDefinition(owner) || (isRecord(owner) && owner['@kind'] === 'workbook')
            ? path.slice(scope.length + 1)
            : path;
    };

    // True when an expression reads `<field>.<name>`: by its path anywhere in the model, or by its short name in the
    // scope of `field`.
    const isRead = (field: string, name: string): boolean => {
        if (readsPath(engine.toPortable(), `${field}.${name}`)) return true;
        const scope = parentPath(field) ?? '*';
        return scope !== '*' && readsPath(contextAt(scope), `${field.slice(scope.length + 1)}.${name}`);
    };

    // A new field of the root context, named `base`, `base2`…
    const newRootField = (base: string): string =>
        childPath(root, uniqueName(base, siblingNames(childPath(root, base))));

    // The root when it is a `service` declaration.
    const serviceAt = (): Record<string, unknown> | undefined => {
        if (root === '*') return undefined;
        const node: unknown = portableAtPath(engine.toPortable() as unknown as PortableNode, root);
        return isRecord(node) && node['@kind'] === 'service' ? node : undefined;
    };

    // The typed hole at `field` when it is a direct field of the flow context: `applicant: <Applicant>`.
    const holeAt = (field: string): Record<string, unknown> | undefined => {
        if (!isFlowField(field)) return undefined;
        const node = contextAt(root)?.[field.slice(root === '*' ? 0 : root.length + 1)];
        return isTypedHole(node) ? node : undefined;
    };

    const parametersOfService = (service: Record<string, unknown> | undefined): Record<string, unknown> =>
        isRecord(service?.parameters) ? service.parameters : {};

    // The parameter name of a parameter node id '<service>.<parameter>', when the service has that parameter.
    const parameterName = (field: string): string | undefined => {
        if (!field.startsWith(`${root}.`)) return undefined;
        const name = field.slice(root.length + 1);
        return name in parametersOfService(serviceAt()) ? name : undefined;
    };

    // The authored `return` field of the service, annotated or not: a record or an expression.
    const returnValueAt = (field: string = childPath(root, RETURN_FIELD)): unknown => {
        if (!serviceAt() || field !== childPath(root, RETURN_FIELD)) return undefined;
        return contextAt(root)?.[RETURN_FIELD];
    };

    // The `return` field of the service when it is a record.
    const returnAt = (field?: string): Record<string, unknown> | undefined => {
        const node = returnValueAt(field);
        return isRecord(node) && node['@kind'] === 'context' ? node : undefined;
    };

    // The `return` field of the service when it is an expression, a literal as an expression record.
    const returnExpressionAt = (field?: string): Record<string, unknown> | undefined => {
        const node = returnValueAt(field);
        if (node === undefined || !isExpression(node)) return undefined;
        return isRecord(node) ? node : {'@kind': 'expression', expression: valueText(node) ?? ''};
    };

    // Writes the whole model with the parameters of the service rewritten, then links; restored on a failure.
    const editParameters = (
        edit: (parameters: [string, unknown][]) => [string, unknown][],
        migrate: (model: unknown) => unknown = (model) => model,
    ): PortableError | void => {
        const service = serviceAt();
        if (!service) return failure(`'${root}' is not a service`);
        const previous = engine.toPortable();
        const parameters = Object.fromEntries(edit(Object.entries(parametersOfService(service))));
        const next = migrate(replaceAt(previous, root, {...service, parameters}));
        const written = writeChangedEntries(engine, next as PortableContext, previous);
        if (isPortableError(written)) return written;
        boxed.invalidate();
        notify();
    };

    // Rewrites the fields of the result record in one link-checked write; the annotations stay.
    const editReturn = (
        field: string,
        edit: (entries: [string, unknown][]) => [string, unknown][] | undefined,
    ): PortableError | void => {
        const result = returnAt(field);
        if (!result) return failure(`node '${field}' does not exist`);
        const next = edit(entriesOf(result));
        if (!next) return;
        const record = {...result, fields: Object.fromEntries(next)} as unknown as PortableSetValue;
        const written = setWithLinkCheck(engine, field, record, result as unknown as PortableSetValue);
        if (isPortableError(written)) return written;
        notify();
    };

    // The node kind of a direct field of the flow context, annotated or not: the `return` of a service, a typed hole,
    // an invocation, or an input (a record, a list literal or an `@InputNode` value). Every other expression is an
    // expression node (see `expressionAt`).
    const nodeKindOf = (field: string, key: string, child: unknown): FlowNodeRef['kind'] | undefined => {
        if (key === RETURN_FIELD && (returnAt(field) || returnExpressionAt(field))) return 'return';
        if (!isRecord(child)) return undefined;
        if (isTypedHole(child)) return 'parameter';
        if (isInvocation(child)) return isUserCall(child) ? 'function' : undefined;
        return inputNodeKind(field, child);
    };

    // An invocation of a callable of the model: a function node. A built-in call (`count(people)`) is an expression.
    const isUserCall = (node: Record<string, unknown>): boolean => {
        const method = node.method;
        if (typeof method !== 'string') return false;
        const callee = portableAtPath(engine.toPortable() as unknown as PortableNode, method);
        return isFunctionDefinition(callee) || (isRecord(callee) && CALLABLE_KINDS.has(String(callee['@kind'])));
    };

    // The authored value of a direct field of the flow context when it is an expression node.
    const expressionAt = (field: string): unknown => {
        const scope = parentPath(field) ?? '*';
        if (scope !== root) return undefined;
        const node = contextAt(root)?.[field.slice(root === '*' ? 0 : root.length + 1)];
        if (isRecord(node) && node['@kind'] === 'context') return isComputedValue(field, node) ? node : undefined;
        if (!isExpression(node) && !isInvocation(node)) return undefined;
        return nodeKindOf(field, field.split('.').at(-1)!, node) ? undefined : node;
    };

    const stateOf = (field: string): InvocationState | undefined => {
        const draft = drafts.get(field);
        if (draft) return draft;
        const committed = committedAt(field);
        if (!committed) return undefined;
        const method = typeof committed.method === 'string' ? committed.method : undefined;
        return {
            method,
            label: typeof committed['@name'] === 'string' ? committed['@name'] : undefined,
            args: argumentTexts(
                committed,
                (calleeOf(method)?.parameters ?? []).map((parameter) => parameter.name),
            ),
        };
    };

    const usedBy = (calleePath: string, parameter: string): boolean => {
        const definition = portableAtPath(engine.toPortable() as unknown as PortableNode, calleePath);
        if (!isRecord(definition)) return false;
        // The parameters (or the decision context) declare the names; only the rest of the declaration reads them.
        const {parameters: _parameters, context: _context, '@kind': _kind, ...rest} = definition;
        return new RegExp(`\\b${parameter}\\b`).test(JSON.stringify(rest));
    };

    const isRequired = (parameter: SignatureParameter) => parameter.required !== false;

    const isComplete = (callee: CalleeRef, args: Record<string, string>) =>
        callee.parameters.every((parameter) => !isRequired(parameter) || args[parameter.name] !== undefined);

    const toInvocation = (state: InvocationState, callee: CalleeRef): PortableSetValue => {
        const args: Record<string, string> = {};
        for (const parameter of callee.parameters) {
            const text = state.args[parameter.name];
            if (text !== undefined) args[parameter.name] = text;
        }
        return {
            '@kind': 'invocation',
            method: callee.path,
            arguments: args,
            '@node': 'FunctionNode',
            // An absent `@name` keeps the label of the node: `null` removes it.
            '@name': state.label ?? null,
        };
    };

    const calleeOf = (method: string | undefined): CalleeRef | undefined =>
        method === undefined ? undefined : calleeSchemas().find((schema) => schema.ref.path === method)?.ref;

    // Stores an incomplete invocation as a draft; writes a complete one with a link check.
    const commit = (field: string, state: InvocationState): PortableError | void => {
        const callee = calleeOf(state.method);
        if (!callee || !isComplete(callee, state.args)) {
            drafts.set(field, state);
            return;
        }
        const previous = committedAt(field) as PortableSetValue | undefined;
        const result = setWithLinkCheck(engine, field, toInvocation(state, callee), previous);
        if (isPortableError(result)) return result;
        drafts.delete(field);
    };

    // The cached row has no children; a ruleset needs its rules to be written back whole.
    const fullRow = (path: string): BoxedTableRowData | undefined => {
        const row = boxed.getBoxedRowData(path) as BoxedTableRowData | undefined;
        return row && {...row, children: boxed.getBoxedRowsData(path)};
    };

    // Edits the callee definition through the Boxed Editor service, which migrates every call site.
    const editCallee = (
        field: string,
        edit: (row: BoxedTableRowData, callee: CalleeRef) => BoxedTableRowData | undefined,
    ): PortableError | void => {
        const callee = calleeOf(stateOf(field)?.method);
        if (!callee) return noCallee(field);
        boxed.invalidate(callee.path);
        const row = fullRow(callee.path);
        if (!row) return failure(`'${callee.path}' does not exist`);
        const next = edit(row, callee);
        if (!next) return;
        const result = boxed.setBoxedRowData(callee.path, next);
        if (isPortableError(result)) return result;
        notify();
    };

    // Renames a field of the flow context; the caller moves the description.
    const renameField = (field: string, newName: string): PortableError | void => {
        if (!IDENTIFIER.test(newName)) return failure(`'${newName}' is not a valid field name`);
        if (newName === field.split('.').at(-1)) return;
        if (siblingNames(field).has(newName)) return failure(`'${newName}' already exists`, 'DuplicateName');
        const renamed = childPath(parentPath(field) ?? '*', newName);
        const draft = drafts.get(field);
        if (draft && !committedAt(field)) {
            drafts.delete(field);
            drafts.set(renamed, draft);
        } else {
            boxed.invalidate(field);
            const error = boxed.rename(field, newName);
            if (error) return error;
            const moved = drafts.get(field);
            if (moved) {
                drafts.delete(field);
                drafts.set(renamed, moved);
            }
            if (errors.has(field)) {
                errors.set(renamed, errors.get(field)!);
                errors.delete(field);
            }
        }
        notify();
    };

    // True when an expression of the flow context reads the typed hole at `field`, by its short name or its path.
    const isHoleRead = (field: string): boolean => {
        const name = field.split('.').at(-1)!;
        const {[name]: _hole, ...rest} = contextAt(root) ?? {};
        return readsPath(rest, name) || readsPath(engine.toPortable(), field);
    };

    return {
        listNodes(): FlowNodeRef[] {
            const service = serviceAt();
            // A service reads its parameters first: they are the inputs of its flow.
            const nodes: FlowNodeRef[] = Object.keys(parametersOfService(service)).map((name) => ({
                field: childPath(root, name),
                kind: 'parameter',
            }));
            // Direct fields only: a node of a child context belongs to the flow of that context. Every expression that
            // no other node shows is an expression node, so a wire never skips a value the flow computes.
            for (const [key, child] of Object.entries(contextAt(root) ?? {})) {
                const field = childPath(root, key);
                const kind = nodeKindOf(field, key, child);
                if (kind) nodes.push({field, kind});
                else if (isExpression(child) || isInvocation(child) || expressionAt(field) !== undefined)
                    nodes.push({field, kind: 'expression'});
            }
            const listed = new Set(nodes.map((node) => node.field));
            for (const field of drafts.keys()) {
                if (!listed.has(field)) nodes.push({field, kind: 'function'});
            }
            return nodes;
        },

        isService: () => serviceAt() !== undefined,

        listCallees: () => calleeSchemas().map((schema) => schema.ref),

        getFunctionNode(field): FunctionNodeModel {
            const state = stateOf(field);
            const schemas = calleeSchemas();
            const schema = schemas.find((candidate) => candidate.ref.path === state?.method);
            const callee = schema?.ref;
            const args = state?.args ?? {};
            const callers = callee ? countInvocations(engine.toPortable(), callee.path) : 0;
            return {
                field,
                label: state?.label,
                callee,
                arguments: (callee?.parameters ?? []).map((parameter) => ({
                    name: parameter.name,
                    type: parameter.type ?? 'any',
                    binding: bindingOf(args[parameter.name]),
                    used: usedBy(callee!.path, parameter.name),
                })),
                results: schema?.results ?? [],
                draft: drafts.has(field) || !callee,
                callers,
                error: errors.get(field),
            };
        },

        createDraftNode() {
            const field = newRootField('node');
            drafts.set(field, {args: {}});
            notify();
            return field;
        },

        setCallee(field, method) {
            const callee = calleeOf(method);
            if (!callee) return unknownCallee(method);
            const previous = stateOf(field);
            const previousCallee = calleeOf(previous?.method);
            const kept: Record<string, string> = {};
            for (const parameter of callee.parameters) {
                const old = previousCallee?.parameters.find((candidate) => candidate.name === parameter.name);
                const text = previous?.args[parameter.name];
                if (old && old.type === parameter.type && text !== undefined) kept[parameter.name] = text;
            }
            errors.delete(field);
            const error = commit(field, {method, label: previous?.label, args: kept});
            if (error) return error;
            notify();
        },

        bindArgument(field, parameter, sourcePath) {
            const state = stateOf(field);
            const callee = calleeOf(state?.method);
            if (!state || !callee) return noCallee(field);
            errors.delete(field);
            const args = {...state.args, [parameter]: bindingPath(field, sourcePath)};
            const error = commit(field, {...state, args});
            if (error) {
                // An `E115` error names the mistyped argument; another error is put on the argument just bound.
                const mismatch = argumentMismatchOf(error);
                const named = mismatch && (mismatch.field === undefined || mismatch.field === field);
                errors.set(field, {parameter: named ? mismatch.argument : parameter, message: error.message});
                notify();
                return error;
            }
            notify();
        },

        unbindArgument(field, parameter) {
            const state = stateOf(field);
            if (!state) return;
            const {[parameter]: _removed, ...args} = state.args;
            errors.delete(field);
            // A required argument leaves the node a draft; the committed field stays in the model.
            commit(field, {...state, args});
            notify();
        },

        setNodeName(field, name) {
            const returned = returnAt(field) ?? returnExpressionAt(field);
            if (returned) {
                // The name of the return is its `@ReturnNode` annotation; without a name it needs none. An annotation
                // never changes whether the model links.
                const label = name.trim();
                if (label === '' && returned['@node'] === undefined) return;
                const result =
                    label === ''
                        ? engine.remove(`${field}.@${RETURN_ANNOTATION}`)
                        : engine.set(field, {
                              '@kind': returned['@kind'],
                              '@node': RETURN_ANNOTATION,
                              '@name': label,
                          } as PortableSetValue);
                if (isPortableError(result)) return result;
                notify();
                return;
            }
            const input = inputAt(field);
            if (input) {
                const label = name.trim();
                if (label === '' && input['@name'] === undefined) return;
                // An annotation-only write updates the label and keeps the node kind; `null` removes the label. An
                // annotation never changes whether the model links.
                const result = engine.set(field, {
                    '@kind': input['@kind'],
                    '@name': label === '' ? null : label,
                } as PortableSetValue);
                if (isPortableError(result)) return result;
                notify();
                return;
            }
            const state = stateOf(field);
            if (!state) return failure(`node '${field}' does not exist`);
            const label = name.trim() === '' ? undefined : name.trim();
            const error = commit(field, {...state, label});
            if (error) return error;
            notify();
        },

        renameField,

        duplicate(field) {
            const base = field.split('.').at(-1)!;
            const copy = childPath(parentPath(field) ?? '*', uniqueName(base, siblingNames(field)));
            const input = inputAt(field) ?? holeAt(field) ?? expressionAt(field);
            if (input !== undefined) {
                const result = setWithLinkCheck(
                    engine,
                    copy,
                    structuredClone(input) as unknown as PortableSetValue,
                    undefined,
                );
                if (isPortableError(result)) return result;
                notify();
                return copy;
            }
            const state = stateOf(field);
            if (!state) return failure(`node '${field}' does not exist`);
            const error = commit(copy, {...state, args: {...state.args}});
            if (error) return error;
            notify();
            return copy;
        },

        deleteField(field) {
            const parameter = parameterName(field);
            if (parameter) {
                if (usedBy(root, parameter)) return failure(`'${parameter}' is read by '${root}'`);
                return editParameters(
                    (parameters) => parameters.filter(([name]) => name !== parameter),
                    (model) => removeCallArgument(model, root, parameter),
                );
            }
            const draftOnly = drafts.has(field) && !committedAt(field);
            drafts.delete(field);
            errors.delete(field);
            if (draftOnly) {
                notify();
                return;
            }
            const previous = (committedAt(field) ??
                inputAt(field) ??
                holeAt(field) ??
                returnValueAt(field) ??
                expressionAt(field)) as PortableSetValue | undefined;
            const result = engine.remove(field);
            if (isPortableError(result)) return result;
            try {
                engine.link();
            } catch (linkError) {
                if (previous !== undefined) engine.set(field, previous);
                return linkError as PortableError;
            }
            notify();
        },

        addArgument(field, after) {
            return editCallee(field, (row, callee) => {
                const names = new Set(callee.parameters.map((parameter) => parameter.name));
                const name = uniqueName('arg', names);
                const last = callee.parameters.length;
                const target = after === undefined ? last : callee.parameters.findIndex((p) => p.name === after) + 1;
                if (callee.kind === 'ruleset') {
                    const added = addConditionColumn(row, name);
                    return target === last ? added : moveConditionColumn(added, last, target);
                }
                const added = addFunctionArgument(row, 'number');
                return target === last ? added : moveFunctionArgument(added, last, target);
            });
        },

        moveArgument(field, parameter, direction) {
            return editCallee(field, (row, callee) => {
                const from = callee.parameters.findIndex((candidate) => candidate.name === parameter);
                const to = direction === 'up' ? from - 1 : from + 1;
                if (from < 0 || to < 0 || to >= callee.parameters.length) return undefined;
                return callee.kind === 'ruleset'
                    ? moveConditionColumn(row, from, to)
                    : moveFunctionArgument(row, from, to);
            });
        },

        renameArgument(field, from, to) {
            if (from === to) return;
            if (!IDENTIFIER.test(to)) return failure(`'${to}' is not a valid argument name`);
            const existing = calleeOf(stateOf(field)?.method)?.parameters ?? [];
            if (existing.some((parameter) => parameter.name === to)) {
                return failure(`'${to}' already exists`, 'DuplicateName');
            }
            return editCallee(field, (row, callee) =>
                callee.kind === 'ruleset'
                    ? renameConditionColumn(row, from, to)
                    : renameFunctionArgument(row, from, to),
            );
        },

        removeArgument(field, parameter) {
            return editCallee(field, (row, callee) =>
                callee.kind === 'ruleset'
                    ? removeConditionColumn(row, parameter)
                    : removeFunctionArgument(row, parameter),
            );
        },

        renameResult(field, from, to) {
            const state = stateOf(field);
            const callee = calleeOf(state?.method);
            if (!callee) return noCallee(field);
            const results = calleeSchemas().find((schema) => schema.ref.path === callee.path)?.results ?? [];
            const result = results.find((candidate) => candidate.name === from);
            if (!result?.renamable) return failure(`'${from}' cannot be renamed`);
            if (from === to) return;
            if (!IDENTIFIER.test(to)) return failure(`'${to}' is not a valid result name`);
            if (results.some((candidate) => candidate.name === to))
                return failure(`'${to}' already exists`, 'DuplicateName');
            if (callee.kind === 'function') {
                // The Boxed Editor rename rewrites the references of every caller and reverts on a failed link.
                boxed.invalidate(callee.path);
                const error = boxed.rename(`${callee.path}.${from}`, to);
                if (error) return error;
                notify();
                return;
            }
            const previous = engine.toPortable();
            const callers = invocationFields(previous, callee.path);
            boxed.invalidate(callee.path);
            const row = fullRow(callee.path);
            if (!row) return failure(`'${callee.path}' does not exist`);
            const renamed = replaceAt(previous, callee.path, denormalize(renameActionColumn(row, from, to)));
            const migrated = rewriteMemberReads(renamed, callers, from, to) as PortableContext;
            const written = writeChangedEntries(engine, migrated, previous);
            if (isPortableError(written)) return written;
            boxed.invalidate();
            notify();
        },

        getObjectInputNode(field): ObjectInputNodeModel {
            const input = objectInputAt(field);
            if (!input) return {field, fields: []};
            ensureLinked();
            const schema = engine.get(field);
            const values = fieldsOf(input) ?? {};
            const fields: ObjectInputField[] = entriesOf(isPortableError(schema) ? undefined : schema).map(
                ([name, type]) => ({
                    name,
                    type: typeText(type) ?? 'object',
                    value: valueText(values[name]),
                    declaration: declarationKind(values[name]),
                    used: isRead(field, name),
                }),
            );
            const label = input['@name'];
            return {field, label: typeof label === 'string' ? label : undefined, fields};
        },

        getValueInputNode(field): ValueInputNodeModel {
            const input = inputAt(field);
            if (!input || input['@kind'] !== 'expression') return {field, type: 'any'};
            ensureLinked();
            const label = input['@name'];
            return {
                field,
                label: typeof label === 'string' ? label : undefined,
                type: typeText(engine.get(field)) ?? 'any',
                value: typeof input.expression === 'string' ? input.expression : undefined,
            };
        },

        getExpressionNode(field): ExpressionNodeModel {
            const authored = expressionAt(field);
            if (authored === undefined) return {field, type: 'any', variables: []};
            ensureLinked();
            let schema: unknown;
            try {
                schema = engine.get(field);
            } catch {
                schema = undefined;
            }
            // A computed record has no expression of its own: it reads what its fields read.
            const computedRecord = isRecord(authored) && authored['@kind'] === 'context';
            const variables = computedRecord
                ? flowReads(field, authored)
                : isRecord(schema) && Array.isArray(schema.variables)
                  ? schema.variables
                  : [];
            return {
                field,
                // A built-in call is an invocation: its linked view names the type in `type` too.
                type: computedRecord
                    ? 'object'
                    : (isRecord(schema) &&
                          (schema['@kind'] === 'expression'
                              ? typeText(schema)
                              : typeof schema.type === 'string'
                                ? schema.type
                                : undefined)) ||
                      'any',
                expression:
                    !computedRecord && isRecord(schema) && typeof schema.expression === 'string'
                        ? schema.expression
                        : formatPortableValue(authored),
                variables: variables.filter((variable): variable is string => typeof variable === 'string'),
            };
        },

        getListInputNode(field): ListInputNodeModel {
            const input = inputAt(field);
            if (!input || input['@kind'] !== 'expression') return {field, type: 'any[]', itemFields: []};
            ensureLinked();
            const schema = engine.get(field);
            const items = isRecord(schema) ? schema.items : undefined;
            const itemFields = Object.entries(structureFields(items) ?? {}).map(([name, type]) => ({
                name,
                type: typeText(type) ?? 'object',
            }));
            const label = input['@name'];
            return {
                field,
                label: typeof label === 'string' ? label : undefined,
                type: typeText(schema) ?? 'any[]',
                itemFields,
            };
        },

        createInputNode(kind = 'object-input') {
            const field = newRootField(NEW_INPUT[kind].base);
            const result = setWithLinkCheck(engine, field, NEW_INPUT[kind].node, undefined);
            if (isPortableError(result)) return result;
            notify();
            return field;
        },

        createExpressionNode() {
            const kind = contextNodeAt(root)?.['@kind'];
            if (kind !== 'context' && kind !== 'workbook') return failure(`'${root}' is not a context`);
            const field = newRootField('expression');
            const result = setWithLinkCheck(engine, field, NEW_EXPRESSION, undefined);
            if (isPortableError(result)) return result;
            notify();
            return field;
        },

        addInputField(field, after) {
            return editInput(field, (entries) => {
                const name = uniqueName('field', new Set(entries.map(([key]) => key)));
                const at = after === undefined ? entries.length : entries.findIndex(([key]) => key === after) + 1;
                return [...entries.slice(0, at), [name, 0], ...entries.slice(at)];
            });
        },

        moveInputField(field, name, direction) {
            return editInput(field, (entries) => {
                const from = entries.findIndex(([key]) => key === name);
                const to = direction === 'up' ? from - 1 : from + 1;
                if (from < 0 || to < 0 || to >= entries.length) return undefined;
                const next = [...entries];
                [next[from], next[to]] = [next[to], next[from]];
                return next;
            });
        },

        removeInputField(field, name) {
            return editInput(field, (entries) => entries.filter(([key]) => key !== name));
        },

        renameInputField(field, from, to) {
            if (from === to) return;
            const input = objectInputAt(field);
            if (!input) return failure(`node '${field}' does not exist`);
            if (!IDENTIFIER.test(to)) return failure(`'${to}' is not a valid field name`);
            const record = portableAtPath(engine.toPortable() as unknown as PortableNode, field);
            const recordFields = fieldsOf(record);
            if (!recordFields || !(from in recordFields)) return failure(`'${from}' does not exist`);
            if (to in recordFields) return failure(`'${to}' already exists`, 'DuplicateName');
            // Path-based: only `<field>.<from>` references change. The Boxed Editor rename rewrites every identifier
            // named `from` in the model, which would also rename same-named callee parameters and call-site arguments.
            const previous = engine.toPortable();
            const renamed = {
                ...(record as unknown as Record<string, unknown>),
                fields: Object.fromEntries(
                    Object.entries(recordFields).map(([key, value]) => [key === from ? to : key, value]),
                ),
            };
            const next = rewriteMemberReads(replaceAt(previous, field, renamed), [field], from, to) as PortableContext;
            const written = writeChangedEntries(engine, next, previous);
            if (isPortableError(written)) return written;
            boxed.invalidate();
            notify();
        },

        setInputFieldValue(field, name, text) {
            const input = objectInputAt(field);
            if (!input) return failure(`node '${field}' does not exist`);
            const values = fieldsOf(input) ?? {};
            if (!(name in values)) return failure(`'${name}' does not exist`);
            if (valueText(values[name]) === undefined) return failure(`'${field}.${name}' is a record`);
            if (text.trim() === '') return failure('A value is required.');
            const result = setWithLinkCheck(engine, `${field}.${name}`, text, values[name] as PortableSetValue);
            if (isPortableError(result)) return result;
            notify();
        },

        setInputValue(field, text) {
            const input = inputAt(field);
            if (!input || input['@kind'] !== 'expression') return failure(`node '${field}' does not exist`);
            if (text.trim() === '') return failure('A value is required.');
            const result = setWithLinkCheck(
                engine,
                field,
                {...input, expression: text} as unknown as PortableSetValue,
                input as unknown as PortableSetValue,
            );
            if (isPortableError(result)) return result;
            notify();
        },

        inputValueContext(field, name) {
            return buildExpressionEmbedContext(engine.toPortable(), name === undefined ? field : `${field}.${name}`);
        },

        getParameterNode(field): ParameterNodeModel {
            const hole = holeAt(field);
            const name = parameterName(field) ?? (hole && field.split('.').at(-1)!);
            if (!name)
                return {field, name: field.split('.').at(-1)!, type: 'any', fields: [], used: false, exists: false};
            // A typed hole declares its type as the `type` of its node; a parameter in the `parameters` of the service.
            const declared = hole ? typeText(hole) : parametersOfService(serviceAt())[name];
            const type = typeText(declared) ?? 'any';
            // A record type: inline, or a type definition of the model by name.
            let definition: unknown = declared;
            let typePath: string | undefined;
            if (typeof declared === 'string' && !PRIMITIVE_TYPES.has(declared)) {
                const named = engine.get(declared);
                if (isRecord(named) && named['@kind'] === 'type') {
                    definition = named;
                    typePath = declared;
                }
            }
            const fields: ParameterField[] = Object.entries(structureFields(definition) ?? {}).map(([key, child]) => ({
                name: key,
                type: typeText(child) ?? 'object',
            }));
            const used = hole ? isHoleRead(field) : usedBy(root, name);
            return {field, name, type, ...(typePath && {typePath}), fields, used, exists: true};
        },

        createParameter() {
            const service = serviceAt();
            if (!service) return failure(`'${root}' is not a service`);
            const taken = new Set([
                ...Object.keys(parametersOfService(service)),
                ...Object.keys(contextAt(root) ?? {}),
            ]);
            const name = uniqueName('param', taken);
            const error = editParameters((parameters) => [...parameters, [name, 'number']]);
            return error ?? childPath(root, name);
        },

        renameParameter(field, to) {
            if (holeAt(field)) return renameField(field, to);
            const from = parameterName(field);
            if (!from) return failure(`node '${field}' does not exist`);
            if (from === to) return;
            if (!IDENTIFIER.test(to)) return failure(`'${to}' is not a valid parameter name`);
            if (to in parametersOfService(serviceAt()) || to in (contextAt(root) ?? {})) {
                return failure(`'${to}' already exists`, 'DuplicateName');
            }
            return editParameters(
                (parameters) => parameters.map(([name, type]) => [name === from ? to : name, type]),
                (model) => {
                    const keys = contextKeys(model, root);
                    const body = keys && renameIdentifier(valueAt(model, keys), from, to);
                    return renameCallArgument(keys ? setAt(model, keys, body) : model, root, from, to);
                },
            );
        },

        setParameterType(field, type) {
            const text = type.trim();
            const hole = holeAt(field);
            if (hole) {
                if (text === '') return failure('A type is required.');
                const result = setWithLinkCheck(
                    engine,
                    field,
                    {...hole, type: text} as unknown as PortableSetValue,
                    hole as unknown as PortableSetValue,
                );
                if (isPortableError(result)) return result;
                notify();
                return;
            }
            const name = parameterName(field);
            if (!name) return failure(`node '${field}' does not exist`);
            if (text === '') return failure('A type is required.');
            return editParameters((parameters) =>
                parameters.map(([key, declared]) => [key, key === name ? text : declared]),
            );
        },

        getReturnNode(field): ReturnNodeModel {
            const result = returnAt(field);
            const expression = result ? undefined : returnExpressionAt(field);
            const returned = result ?? expression;
            if (!returned) return {field, fields: [], variables: [], exists: false};
            ensureLinked();
            const schema = engine.get(root);
            const returnType = isRecord(schema) ? schema.return : undefined;
            const label = returned['@name'];
            const base = {field, label: typeof label === 'string' ? label : undefined, exists: true};
            if (expression) {
                let read: unknown;
                try {
                    read = engine.get(field);
                } catch {
                    read = undefined;
                }
                const variables = isRecord(read) && Array.isArray(read.variables) ? read.variables : [];
                return {
                    ...base,
                    fields: [],
                    type: typeText(returnType) ?? 'any',
                    expression:
                        isRecord(read) && typeof read.expression === 'string'
                            ? read.expression
                            : String(expression.expression ?? ''),
                    variables: variables.filter((variable): variable is string => typeof variable === 'string'),
                };
            }
            const fieldTypes = structureFields(returnType) ?? {};
            return {
                ...base,
                fields: entriesOf(result).map(([name, value]) => ({
                    name,
                    type: typeText(fieldTypes[name]) ?? 'any',
                    value: valueText(value),
                })),
                variables: [],
            };
        },

        createReturnNode() {
            if (!serviceAt()) return failure(`'${root}' is not a service`);
            const body = contextNodeAt(root);
            if (body?.['@kind'] !== 'context') return failure(`The body of '${root}' is not a context`);
            const field = childPath(root, RETURN_FIELD);
            const bodyFields = fieldsOf(body) ?? {};
            if (bodyFields[RETURN_FIELD] !== undefined) return failure(`'${field}' already exists`, 'DuplicateName');
            // Without a `return` field the service returns every field of its body: the return starts as that
            // context, so the callers keep reading what they read.
            const node: PortableSetValue = {
                '@kind': 'context',
                fields: Object.fromEntries(
                    Object.entries(bodyFields)
                        .filter(([, value]) => !declarationKind(value))
                        .map(([key]) => [key, {'@kind': 'expression', expression: key}]),
                ),
            };
            const written = setWithLinkCheck(engine, field, node, undefined);
            if (isPortableError(written)) return written;
            notify();
            return field;
        },

        setReturnExpression(field, text) {
            const expression = returnExpressionAt(field);
            if (!expression) return failure(`node '${field}' does not exist`);
            if (text.trim() === '') return failure('A value is required.');
            const written = setWithLinkCheck(
                engine,
                field,
                {...expression, expression: text} as unknown as PortableSetValue,
                returnValueAt(field) as PortableSetValue,
            );
            if (isPortableError(written)) return written;
            notify();
        },

        bindReturnField(field, name, sourcePath) {
            const result = returnAt(field);
            if (!result) return failure(`node '${field}' does not exist`);
            const text = bindingPath(field, sourcePath);
            const resultFields = fieldsOf(result) ?? {};
            if (name !== undefined && !(name in resultFields)) return failure(`'${name}' does not exist`);
            const taken = new Set(Object.keys(resultFields));
            const base = text.split('.').at(-1)!.replace(/\[.*$/, '');
            const target = name ?? uniqueName(IDENTIFIER.test(base) ? base : 'value', taken);
            const written = setWithLinkCheck(
                engine,
                `${field}.${target}`,
                text,
                resultFields[target] as PortableSetValue | undefined,
            );
            if (isPortableError(written)) return written;
            notify();
        },

        renameReturnField(field, from, to) {
            if (from === to) return;
            if (!IDENTIFIER.test(to)) return failure(`'${to}' is not a valid field name`);
            const result = returnAt(field);
            if (result && to in (fieldsOf(result) ?? {})) return failure(`'${to}' already exists`, 'DuplicateName');
            return editReturn(field, (entries) =>
                entries.some(([key]) => key === from)
                    ? entries.map(([key, value]) => [key === from ? to : key, value])
                    : undefined,
            );
        },

        moveReturnField(field, name, direction) {
            return editReturn(field, (entries) => {
                const from = entries.findIndex(([key]) => key === name);
                const to = direction === 'up' ? from - 1 : from + 1;
                if (from < 0 || to < 0 || to >= entries.length) return undefined;
                const next = [...entries];
                [next[from], next[to]] = [next[to], next[from]];
                return next;
            });
        },

        removeReturnField(field, name) {
            return editReturn(field, (entries) => entries.filter(([key]) => key !== name));
        },

        setReturnFieldValue(field, name, text) {
            const result = returnAt(field);
            if (!result) return failure(`node '${field}' does not exist`);
            const resultFields = fieldsOf(result) ?? {};
            if (!(name in resultFields)) return failure(`'${name}' does not exist`);
            if (text.trim() === '') return failure('A value is required.');
            const written = setWithLinkCheck(engine, `${field}.${name}`, text, resultFields[name] as PortableSetValue);
            if (isPortableError(written)) return written;
            notify();
        },

        async readOutput(source) {
            const keys = source.split('.');
            let firstError: string | undefined;
            // The engine executes a field, not a path into its result: take the longest executable prefix, then walk.
            for (let length = keys.length; length > 0; length -= 1) {
                let value: unknown;
                try {
                    value = await engine.execute(keys.slice(0, length).join('.'));
                } catch (error) {
                    firstError ??=
                        error instanceof Error
                            ? error.message
                            : String((error as {message?: string})?.message ?? error);
                    continue;
                }
                for (const key of keys.slice(length)) {
                    value = isRecord(value) ? value[key] : undefined;
                }
                if (value === undefined) return {error: `no ${source}`};
                // An empty list has no item to show its fields: the declared type of the path names them.
                if (Array.isArray(value) && value.length === 0) return {value, ...declaredListType(source)};
                return {value, type: valueType(value)};
            }
            return {error: firstError ?? `no ${source}`};
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        invalidate() {
            notify();
        },
    };
}

// What a new input node of each kind holds: a record with one number field, a list of numbers, or one number.
// A new expression node starts as the number 0; the user writes its expression in the boxed or code editor.
const NEW_EXPRESSION: PortableSetValue = {'@kind': 'expression', expression: '0'};

const NEW_INPUT: Record<InputKind, {base: string; node: PortableSetValue}> = {
    'object-input': {
        base: 'input',
        node: {'@kind': 'context', '@node': 'InputNode', fields: {value: 0}},
    },
    'list-input': {
        base: 'list',
        node: {'@kind': 'expression', expression: '[1, 2, 3]', '@node': 'InputNode'},
    },
    'value-input': {
        base: 'value',
        node: {'@kind': 'expression', expression: '0', '@node': 'InputNode'},
    },
};

// Built-in types: a parameter of any other named type reads the fields of its type definition.
const PRIMITIVE_TYPES = new Set([
    'number',
    'string',
    'boolean',
    'date',
    'time',
    'datetime',
    'duration',
    'period',
    'any',
]);

const DECLARATION_KINDS: Record<string, InputDeclarationKind> = {
    method: 'function',
    ruleset: 'ruleset',
    optimise: 'optimisation',
    type: 'type',
};

// The declaration kind of a record field value; undefined for an ordinary value or nested record.
function declarationKind(value: unknown): InputDeclarationKind | undefined {
    return isRecord(value) && typeof value['@kind'] === 'string' ? DECLARATION_KINDS[value['@kind']] : undefined;
}

// The expression text of a record field value; undefined for a nested record, which has no single expression.
function valueText(value: unknown): string | undefined {
    if (declarationKind(value)) return undefined;
    return isRecord(value) && value['@kind'] === 'context' ? undefined : formatPortableValue(value);
}

function valueType(value: unknown): string {
    if (Array.isArray(value)) return `${value.length ? valueType(value[0]) : 'any'}[]`;
    if (value === null) return 'any';
    return typeof value === 'object' ? 'object' : typeof value;
}

// The expression texts of a value: of each field of a record, at any depth, or of the value itself.
function valueTexts(node: unknown): string[] {
    if (isRecord(node) && node['@kind'] === 'context') return entriesOf(node).flatMap(([, child]) => valueTexts(child));
    return [formatPortableValue(node)];
}

// True when an expression anywhere in `node` reads `path`.
function readsPath(node: unknown, path: string): boolean {
    const pattern = new RegExp(`(?<![\\w.])${escapeRegExp(path)}\\b`);
    return pattern.test(JSON.stringify(node));
}

function unknownCallee(method: string): PortableError {
    return {
        '@kind': 'error',
        type: 'Execution',
        message: `'${method}' is not a function or ruleset`,
    } as PortableError;
}

function noCallee(field: string): PortableError {
    return {'@kind': 'error', type: 'Execution', message: `node '${field}' has no callee`} as PortableError;
}

function failure(message: string, type = 'Execution'): PortableError {
    return {'@kind': 'error', type, message} as PortableError;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites the reads of member `from` of each field in `targets` to `to`: `<target>.<from>` in every expression text
 * of the model, and `<name>.<from>` (the short name of the target) in the context that holds the target.
 */
function rewriteMemberReads(root: unknown, targets: string[], from: string, to: string): unknown {
    let next = rewriteReads(root, targets, from, to, false);
    for (const target of targets) {
        const scope = parentPath(target) ?? '*';
        if (scope === '*') continue;
        const keys = contextKeys(next, scope);
        if (!keys) continue;
        const context = valueAt(next, keys);
        next = setAt(next, keys, rewriteReads(context, [target.slice(scope.length + 1)], from, to, true));
    }
    return next;
}

/**
 * Rewrites `<name>.<from>` to `<name>.<to>` in every expression text of `node` for each name. With `scoped`, `node` is
 * the context that defines the names: a nested context that defines one of them again shadows it, and a nested
 * function cannot read them, so neither is rewritten.
 */
function rewriteReads(node: unknown, names: string[], from: string, to: string, scoped: boolean, top = true): unknown {
    if (typeof node === 'string') {
        let text = node;
        for (const name of names) {
            text = text.replace(
                new RegExp(`(?<![\\w.])${escapeRegExp(name)}\\.${escapeRegExp(from)}\\b`, 'g'),
                `${name}.${to}`,
            );
        }
        return text;
    }
    if (Array.isArray(node)) return node.map((child) => rewriteReads(child, names, from, to, scoped, false));
    if (!isRecord(node)) return node;
    if (scoped && !top) {
        if (isFunctionDefinition(node)) return node;
        const defined = fieldsOf(node);
        const visible = node['@kind'] === 'context' && defined ? names.filter((name) => !(name in defined)) : names;
        if (visible.length === 0) return node;
        names = visible;
    }
    return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, rewriteReads(child, names, from, to, scoped, false)]),
    );
}

// The keys of a Portable node that hold no expression: annotations, the callee name, and type declarations.
const NO_EXPRESSION_KEYS = new Set([
    'method',
    'hitPolicy',
    'parameters',
    'context',
    'return',
    'type',
    'items',
    'alias',
]);

// Rewrites every read of the identifier `from` to `to` in the expression texts of `node`. A named argument label or a
// record key (`from:`) is not a read.
function renameIdentifier(node: unknown, from: string, to: string): unknown {
    if (typeof node === 'string') {
        return node.replace(new RegExp(`(?<![\\w.])${escapeRegExp(from)}\\b(?!\\s*:)`, 'g'), to);
    }
    if (Array.isArray(node)) return node.map((child) => renameIdentifier(child, from, to));
    if (!isRecord(node)) return node;
    // A key of a node (it has `@kind`) may hold no expression; a key of a name map (`fields`, `arguments`) is a name.
    const isNode = typeof node['@kind'] === 'string';
    return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [
            key,
            isNode && (key.startsWith('@') || NO_EXPRESSION_KEYS.has(key)) ? child : renameIdentifier(child, from, to),
        ]),
    );
}

// Applies `edit` to the named arguments of every call of `method` in the model: an invocation, and a call in an
// expression text through `editText`.
function editCallArguments(
    node: unknown,
    method: string,
    edit: (args: [string, unknown][]) => [string, unknown][],
    editText: (text: string) => string,
): unknown {
    if (typeof node === 'string') return editText(node);
    if (Array.isArray(node)) return node.map((child) => editCallArguments(child, method, edit, editText));
    if (!isRecord(node)) return node;
    const next = Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, editCallArguments(child, method, edit, editText)]),
    );
    if (isInvocation(node) && node.method === method && isRecord(next.arguments)) {
        next.arguments = Object.fromEntries(edit(Object.entries(next.arguments)));
    }
    return next;
}

// `method(from: x)` becomes `method(to: x)` in every call of the model.
function renameCallArgument(model: unknown, method: string, from: string, to: string): unknown {
    return editCallArguments(
        model,
        method,
        (args) => args.map(([name, value]) => [name === from ? to : name, value]),
        (text) => renameNamedArgument(text, method, from, to),
    );
}

// The named argument `name` leaves every invocation of `method`; a call in an expression text keeps it, and the
// link check refuses the change.
function removeCallArgument(model: unknown, method: string, name: string): unknown {
    return editCallArguments(
        model,
        method,
        (args) => args.filter(([key]) => key !== name),
        (text) => text,
    );
}

// Renames the label `from:` of the top-level named arguments of each call of `method` in an expression text.
function renameNamedArgument(text: string, method: string, from: string, to: string): string {
    const call = new RegExp(`(?<![\\w.])${escapeRegExp(method)}\\s*\\(`, 'g');
    const label = new RegExp(`^(\\s*)${escapeRegExp(from)}(\\s*:)`);
    let out = '';
    let index = 0;
    for (let match = call.exec(text); match; match = call.exec(text)) {
        let at = match.index + match[0].length;
        out += text.slice(index, at);
        let depth = 0;
        let argumentStart = true;
        while (at < text.length) {
            const named = argumentStart && depth === 0 ? label.exec(text.slice(at)) : null;
            if (named) {
                out += `${named[1]}${to}${named[2]}`;
                at += named[0].length;
                argumentStart = false;
                continue;
            }
            const char = text[at];
            argumentStart = false;
            if ('([{'.includes(char)) depth += 1;
            else if (')]}'.includes(char)) {
                if (depth === 0) break;
                depth -= 1;
            } else if (char === ',' && depth === 0) argumentStart = true;
            out += char;
            at += 1;
        }
        index = at;
        call.lastIndex = at;
    }
    return out + text.slice(index);
}

// The fields that invoke `method`, by path; the fields of a function body are addressed through the function.
function invocationFields(node: unknown, method: string, path = ''): string[] {
    if (!isRecord(node)) return [];
    if (isInvocation(node)) return node.method === method && path ? [path] : [];
    if (isFunctionDefinition(node)) return invocationFields(node.body, method, path);
    return entriesOf(node).flatMap(([key, child]) => invocationFields(child, method, path ? `${path}.${key}` : key));
}

// The keys that lead to the field at `path` in the Portable tree: the fields of a context are in its `fields`, and
// the fields of a function are in its `body`.
function portableKeys(root: unknown, path: string): string[] {
    const keys: string[] = [];
    let node = root;
    for (const name of path.split('.')) {
        if (isFunctionDefinition(node)) {
            keys.push('body');
            node = node.body;
        }
        if (hasFields(node)) {
            keys.push('fields');
            node = node.fields;
        }
        keys.push(name);
        node = isRecord(node) ? node[name] : undefined;
    }
    return keys;
}

// The keys of the context at `path`: the body of a function.
function contextKeys(root: unknown, path: string): string[] | undefined {
    const keys = portableKeys(root, path);
    const node = valueAt(root, keys);
    if (!isRecord(node)) return undefined;
    return isFunctionDefinition(node) ? [...keys, 'body'] : keys;
}

function valueAt(root: unknown, keys: string[]): unknown {
    let node = root;
    for (const key of keys) node = isRecord(node) ? node[key] : undefined;
    return node;
}

function setAt<T>(root: T, keys: string[], value: unknown): T {
    const next = structuredClone(root) as Record<string, unknown>;
    let current = next;
    for (const key of keys.slice(0, -1)) current = current[key] as Record<string, unknown>;
    current[keys.at(-1)!] = value;
    return next as T;
}

// Writes only the root entries that differ, then links; a failed link restores them. A root entry missing from `next`
// is removed.
function writeChangedEntries(
    engine: FlowEditorEngine,
    next: PortableContext,
    previous: PortableContext,
): PortableError | void {
    const before = previous.fields;
    const after = next.fields;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
    );
    const write = (fields: Record<string, unknown>, key: string): PortableNode | PortableError | void =>
        fields[key] === undefined ? engine.remove(key) : engine.set(key, fields[key] as PortableSetValue);
    const restore = () => {
        for (const key of changed) write(before, key);
    };
    for (const key of changed) {
        const result = write(after, key);
        if (isPortableError(result)) {
            restore();
            return result;
        }
    }
    try {
        engine.link();
    } catch (linkError) {
        restore();
        return linkError as PortableError;
    }
}

function replaceAt(root: PortableContext, path: string, value: unknown): PortableContext {
    return setAt(root, portableKeys(root, path), value);
}
