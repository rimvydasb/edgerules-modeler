import {fieldsOf, isRecord, typeText} from '#lib/portableUtils';

// The decision requirements graph (DRG) of a linked model, read from `get('*')`: the `requires` objects of each
// `decision` and `service`, the structure types they read, and the `facts` of those types. Knowledge requirements (the
// calls of a `func`, `ruleset`, `loop` or `optimise`) are not part of it: the engine does not report them.

/** The DMN element that a diagram node draws. */
export type DrdElementKind = 'decision' | 'input' | 'service';

/** One element of the decision requirements graph. */
export interface DrdElement {
    id: string; // the model path of the declaration; the type name of an input
    kind: DrdElementKind;
    name: string; // the declared name, the last segment of the path
    context?: {name: string; type: string}; // decision only: the decision context
    parameters?: {name: string; type: string}[]; // service only
    results?: string[]; // decision and service: the result field names, when the result is a structure
    fields?: number; // input only: the number of structure fields, without the owner field
    facts?: string[]; // input only: the facts field names of the type
}

/**
 * A requirement edge, from the required element to the requiring one, as DMN draws it. An `owner` association links a
 * child input type to the parent type that holds it; the `owner` child field names it.
 */
export interface DrdRequirement {
    id: string;
    kind: 'information' | 'owner';
    source: string;
    target: string;
    label?: string; // owner only: the owner field name
}

export interface DrdGraph {
    elements: DrdElement[];
    requirements: DrdRequirement[];
}

// The result field names of a `return` that is a structure.
function resultFields(value: unknown): string[] | undefined {
    const fields = fieldsOf(value);
    return fields ? Object.keys(fields) : undefined;
}

function namedTypes(value: unknown): {name: string; type: string}[] {
    if (!isRecord(value)) return [];
    return Object.entries(value).map(([name, type]) => ({name, type: typeText(type) ?? 'any'}));
}

interface Declarations {
    decisions: Map<string, Record<string, unknown>>;
    services: Map<string, Record<string, unknown>>;
    types: Map<string, Record<string, unknown>>;
    facts: Map<string, string[]>; // structure type name -> facts field names
}

// Every declaration of the model, at any depth of its contexts, keyed by path; types by name.
function collect(node: unknown, prefix: string, found: Declarations): void {
    const fields = fieldsOf(node);
    if (!fields) return;
    for (const [name, child] of Object.entries(fields)) {
        if (name.startsWith('@') || !isRecord(child)) continue;
        const path = prefix ? `${prefix}.${name}` : name;
        switch (child['@kind']) {
            case 'decision':
            case 'decision-interface':
                found.decisions.set(path, child);
                break;
            case 'service':
            case 'service-interface':
                found.services.set(path, child);
                break;
            case 'type':
                found.types.set(name, child);
                break;
            case 'facts': {
                const type = namedTypes(child.context)[0]?.type;
                if (type === undefined) break;
                const names = Object.keys(fieldsOf(child) ?? resultFields(child.return) ?? {});
                found.facts.set(type, [...(found.facts.get(type) ?? []), ...names]);
                break;
            }
            case 'context':
                collect(child, path, found);
                break;
        }
    }
}

function requiresOf(node: Record<string, unknown>): {inputs: string[]; decisions: string[]} {
    const requires = isRecord(node.requires) ? node.requires : {};
    const list = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
    return {inputs: list(requires.inputs), decisions: list(requires.decisions)};
}

/**
 * The decision requirements graph of `model`, the linked `get('*')` view. An input element is a structure type that a
 * decision or a service reads; a type that nothing reads is not drawn. An unlinked model has no `requires`: its
 * decisions and services have no requirement.
 */
export function buildRequirementsGraph(model: unknown): DrdGraph {
    const found: Declarations = {decisions: new Map(), services: new Map(), types: new Map(), facts: new Map()};
    collect(model, '', found);
    const elements: DrdElement[] = [];
    const requirements: DrdRequirement[] = [];
    const inputs = new Set<string>();
    const link = (source: string, target: string) =>
        requirements.push({id: `${source}->${target}`, kind: 'information', source, target});

    for (const [path, node] of found.decisions) {
        const context = namedTypes(node.context)[0];
        elements.push({
            id: path,
            kind: 'decision',
            name: path.split('.').at(-1)!,
            ...(context && {context}),
            ...(resultFields(node.return) && {results: resultFields(node.return)}),
        });
    }
    for (const [path, node] of found.services) {
        elements.push({
            id: path,
            kind: 'service',
            name: path.split('.').at(-1)!,
            parameters: namedTypes(node.parameters),
            ...(resultFields(node.return) && {results: resultFields(node.return)}),
        });
    }
    for (const [path, node] of [...found.decisions, ...found.services]) {
        const requires = requiresOf(node);
        for (const input of requires.inputs) {
            inputs.add(input);
            link(`type:${input}`, path);
        }
        for (const decision of requires.decisions) {
            if (found.decisions.has(decision) && decision !== path) link(decision, path);
        }
    }
    for (const name of [...inputs].sort()) {
        const type = found.types.get(name);
        const fields = Object.entries(fieldsOf(type) ?? {});
        elements.push({
            id: `type:${name}`,
            kind: 'input',
            name,
            fields: fields.filter(([, field]) => !(isRecord(field) && field.owner === true)).length,
            facts: found.facts.get(name) ?? [],
        });
        // The owner field of a child type: an association to the parent type, when the diagram shows both.
        for (const [field, value] of fields) {
            if (!isRecord(value) || value.owner !== true) continue;
            const parent = typeText(value);
            if (parent === undefined || !inputs.has(parent)) continue;
            requirements.push({
                id: `owner:${name}.${field}`,
                kind: 'owner',
                source: `type:${name}`,
                target: `type:${parent}`,
                label: field,
            });
        }
    }
    return {elements, requirements};
}
