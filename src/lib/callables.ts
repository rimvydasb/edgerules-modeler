import type {Kind, PortableError, PortableNode} from '@edgerules/portable';
import {isPortableError} from './portable';
import {authoredEntries, callableParameters, isRecord} from './portableUtils';

export type CallableKind = 'function' | 'ruleset' | 'optimise' | 'loop';

export interface Callable {
    path: string; // Dotted path, for example 'risk' or 'library.eligibility'.
    kind: CallableKind;
}

/** Structural subset of `MutableDecisionService` that `listCallables` reads. */
export interface CallableSource {
    get(path: string, kinds?: readonly Kind[]): PortableNode | PortableError;
}

// A callable parameter without a type is `null` in the `parameters` (or `context`) map.
function untypedNames(parameters: unknown): string[] {
    if (!isRecord(parameters)) return [];
    return Object.entries(parameters)
        .filter(([, param]) => param === null || param === 'any')
        .map(([name]) => name);
}

/**
 * The untyped arguments of a callable (`func total(plan, tier: string)` -> `['plan']`). Such a function is generic:
 * the engine types it at each call site and refuses to execute it directly, so it cannot be tested.
 */
export function untypedParameters(schema: unknown): string[] {
    return untypedNames(callableParameters(schema));
}

function hasOnlyTypedParameters(parameters: unknown): boolean {
    return untypedNames(parameters).length === 0;
}

const INTERFACE_KINDS: Record<string, CallableKind> = {
    'method-interface': 'function',
    'decision-interface': 'function',
    'service-interface': 'function',
    'ruleset-interface': 'ruleset',
    'loop-interface': 'loop',
    'optimise-interface': 'optimise',
};

/** The `kinds` of `get('*', kinds)` that `listCallables` reads: every callable interface, and the contexts. */
const CALLABLE_VIEW: readonly Kind[] = ['context', ...Object.keys(INTERFACE_KINDS)] as Kind[];

// Recurses into `context` nodes only — an interface node has no body, so a callable declared inside another callable's
// body is never reached.
function walkCallables(node: unknown, path: readonly string[], into: Callable[]): void {
    for (const [key, value] of authoredEntries(node)) {
        if (!isRecord(value)) continue;
        const kind = value['@kind'];
        if (kind === 'context') {
            walkCallables(value, [...path, key], into);
        } else if (
            typeof kind === 'string' &&
            kind in INTERFACE_KINDS &&
            hasOnlyTypedParameters(callableParameters(value))
        ) {
            into.push({path: [...path, key].join('.'), kind: INTERFACE_KINDS[kind]});
        }
    }
}

/**
 * Every fully typed user callable: `func`, `decision`, `service`, `ruleset` and `loop` at any context depth, and
 * `optimise`. A callable that declares any untyped parameter is excluded.
 */
export function listCallables(service: CallableSource): Callable[] {
    const callables: Callable[] = [];
    const view = service.get('*', CALLABLE_VIEW);
    if (!isPortableError(view)) walkCallables(view, [], callables);
    return callables;
}
