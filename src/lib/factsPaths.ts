import type {PortableError, PortableNode, PortableRootContext} from '@edgerules/portable';
import {isPortableError} from './portable';
import {isRecord} from './portableUtils';

/**
 * A `facts` declaration has the name of its type, so the engine has no path for it: it keeps it under the `@facts` key of
 * the type definition. This package addresses it as `<Type>.@facts`, and a field of its body as `<Type>.@facts.<field>`.
 * `withFactsPaths` maps these paths onto the type, so an editor can read and write a facts declaration like any other
 * callable.
 */
export const FACTS_KEY = '@facts';

/** The path of the facts declaration of the root type `type`: `Applicant.@facts`. */
export function factsPath(type: string): string {
    return `${type}.${FACTS_KEY}`;
}

/** `{type: 'Applicant', rest: 'age'}` for `Applicant.@facts.age`; undefined for a path outside a facts declaration. */
export function splitFactsPath(path: string): {type: string; rest: string} | undefined {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\.@facts(?:\.(.+))?$/.exec(path);
    return match ? {type: match[1]!, rest: match[2] ?? ''} : undefined;
}

/** True for the path of a facts declaration or of a field of its body. */
export function isFactsPath(path: string): boolean {
    return splitFactsPath(path) !== undefined;
}

type GetFilter = 'FIELDS' | 'TYPE_DEFINITIONS' | 'FUNCTION_DEFINITIONS' | 'EXTERNAL_DEFINITIONS' | 'ALL';

/** The part of `MutableDecisionService` that `withFactsPaths` maps. */
export interface FactsPathService {
    get(path: string, filter?: GetFilter): PortableNode | PortableError;
    set(path: string, node: PortableNode): PortableNode | PortableError;
    remove(path: string): void | PortableError;
    rename(path: string, newName: string): void | PortableError;
    toPortable(): PortableRootContext;
}

/** The parts of `MutableDecisionService` that `factsCode` and `setFactsCode` use. */
export interface FactsCodeService {
    getCode(path: string): string | PortableError;
    setCode(path: string, code: string): PortableNode | PortableError;
}

function notFound(path: string): PortableError {
    return {'@kind': 'error', type: 'EntryNotFound', message: `entry not found: ${path}`} as PortableError;
}

// The node at the dotted `rest` of a context, through nested contexts only.
function childAt(node: unknown, rest: string): unknown {
    let current = node;
    for (const key of rest.split('.')) current = isRecord(current) ? current[key] : undefined;
    return current;
}

// A copy of the context `node` with `update` applied to the field at the dotted `rest`.
function updateAt(
    node: Record<string, unknown>,
    rest: string,
    update: (parent: Record<string, unknown>, key: string) => Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    const [key, ...tail] = rest.split('.');
    if (tail.length === 0) return update(node, key!);
    const child = node[key!];
    if (!isRecord(child)) return undefined;
    const next = updateAt(child, tail.join('.'), update);
    return next && {...node, [key!]: next};
}

/**
 * `service` with `<Type>.@facts` paths for `get`, `set`, `remove` and `rename`. Any other path goes to `service`
 * unchanged. A write rewrites the whole type definition with its new `@facts`.
 */
export function withFactsPaths<S extends FactsPathService>(service: S): S {
    const typeDefinition = (type: string): Record<string, unknown> | undefined => {
        const node = (service.toPortable() as unknown as Record<string, unknown>)[type];
        return isRecord(node) && node['@kind'] === 'type-definition' ? node : undefined;
    };
    // Writes the new facts declaration of `type` (none: removes it) through the whole model: `set(type, …)` ignores a
    // changed `@facts` (docs/engine-bug-reports.md).
    const writeFacts = (type: string, facts: unknown): PortableNode | PortableError => {
        const definition = typeDefinition(type);
        if (!definition) return notFound(type);
        const {[FACTS_KEY]: _previous, ...rest} = definition;
        const root = service.toPortable() as unknown as Record<string, unknown>;
        const next = facts === undefined ? rest : {...rest, [FACTS_KEY]: facts};
        return service.set('*', {...root, [type]: next} as unknown as PortableNode);
    };
    // A copy of the facts declaration of `type` with `update` applied to the body field at `rest`.
    const updateBody = (
        type: string,
        rest: string,
        update: (parent: Record<string, unknown>, key: string) => Record<string, unknown> | undefined,
    ): PortableNode | PortableError => {
        const facts = typeDefinition(type)?.[FACTS_KEY];
        if (!isRecord(facts) || !isRecord(facts['@body'])) return notFound(factsPath(type));
        const body = updateAt(facts['@body'], rest, update);
        if (!body) return notFound(`${factsPath(type)}.${rest}`);
        return writeFacts(type, {...facts, '@body': body});
    };

    const overrides: Partial<FactsPathService> = {
        get(path, filter) {
            const facts = splitFactsPath(path);
            if (!facts) return service.get(path, filter);
            const definition = service.get(facts.type, 'ALL');
            if (isPortableError(definition)) return definition;
            const schema = isRecord(definition) ? definition[FACTS_KEY] : undefined;
            if (facts.rest === '') return isRecord(schema) ? (schema as unknown as PortableNode) : notFound(path);
            const field = isRecord(schema) ? childAt(schema['@return'], facts.rest) : undefined;
            return field === undefined ? notFound(path) : (field as PortableNode);
        },
        set(path, node) {
            const facts = splitFactsPath(path);
            if (!facts) return service.set(path, node);
            const result =
                facts.rest === ''
                    ? writeFacts(facts.type, node)
                    : updateBody(facts.type, facts.rest, (parent, key) => ({...parent, [key]: node}));
            return isPortableError(result) ? result : overrides.get!(path, 'ALL');
        },
        remove(path) {
            const facts = splitFactsPath(path);
            if (!facts) return service.remove(path);
            const result =
                facts.rest === ''
                    ? writeFacts(facts.type, undefined)
                    : updateBody(facts.type, facts.rest, (parent, key) => {
                          if (!(key in parent)) return undefined;
                          const {[key]: _removed, ...rest} = parent;
                          return rest;
                      });
            return isPortableError(result) ? result : undefined;
        },
        rename(path, newName) {
            const facts = splitFactsPath(path);
            if (!facts) return service.rename(path, newName);
            // The facts declaration has the name of its type: only a field of its body can be renamed.
            if (facts.rest === '') return service.rename(facts.type, newName);
            const result = updateBody(facts.type, facts.rest, (parent, key) => {
                if (!(key in parent)) return undefined;
                // Keeps the field in its place.
                return Object.fromEntries(
                    Object.entries(parent).map(([name, value]) => [name === key ? newName : name, value]),
                );
            });
            return isPortableError(result) ? result : undefined;
        },
    };

    return new Proxy(service, {
        get(target, property, receiver) {
            if (typeof property === 'string' && property in overrides) {
                return overrides[property as keyof FactsPathService];
            }
            const value = Reflect.get(target, property, receiver) as unknown;
            return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
        },
    });
}

/**
 * The DSL of the facts declaration of `type`, cut from the code of the whole model: the engine returns a type
 * definition without its facts.
 */
export function factsCode(service: FactsCodeService, type: string): string | PortableError {
    const code = service.getCode('*');
    if (isPortableError(code)) return code;
    const start = new RegExp(`^([ \\t]*)facts ${type}\\s*\\(`, 'm').exec(code);
    if (!start) return notFound(factsPath(type));
    const indent = start[1]!;
    const open = code.indexOf('{', start.index + start[0].length);
    if (open === -1) return notFound(factsPath(type));
    let depth = 0;
    let quote: string | undefined;
    for (let index = open; index < code.length; index++) {
        const char = code[index]!;
        if (quote) {
            if (char === '\\') index++;
            else if (char === quote) quote = undefined;
            continue;
        }
        if (char === '"' || char === "'") quote = char;
        else if (char === '{') depth++;
        else if (char === '}' && --depth === 0) {
            return code
                .slice(start.index, index + 1)
                .split('\n')
                .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
                .join('\n');
        }
    }
    return notFound(factsPath(type));
}

/** Replaces the facts declaration of `type` with `code` (`facts <type>(...): { ... }`). */
export function setFactsCode(service: FactsCodeService, type: string, code: string): PortableNode | PortableError {
    return service.setCode(type, code);
}
