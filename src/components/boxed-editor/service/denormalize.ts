import type {
    HitPolicy,
    PortableContext,
    PortableExpression,
    PortableOptimise,
    PortablePlaceholderValue,
    PortableRule,
    PortableRuleset,
    PortableSetValue,
    PortableType,
    PortableValue,
} from '@edgerules/portable';
import type {BoxedRowData, BoxedTableRowData, SignatureParameter} from '../boxed-editor-types';

function expression(text = ''): PortableExpression {
    return {'@kind': 'expression', expression: text};
}

function parameters(
    values: SignatureParameter[] | undefined,
): Record<string, string | PortablePlaceholderValue | null> {
    const result: Record<string, string | PortablePlaceholderValue | null> = {};
    for (const parameter of values ?? []) {
        if (!parameter.type) {
            result[parameter.name] = null;
        } else if (parameter.required === undefined) {
            result[parameter.name] = parameter.type;
        } else {
            result[parameter.name] = {
                '@kind': 'placeholder',
                type: parameter.type,
                required: parameter.required,
            };
        }
    }
    return result;
}

function contextFromChildren(children: BoxedRowData[] | undefined): PortableContext {
    const fields: PortableContext['fields'] = {};
    for (const child of children ?? []) {
        fields[child.name] = denormalize(child) as PortableValue;
    }
    return {'@kind': 'context', fields};
}

/**
 * A `type` member's own node — a bare type reference (`"string"`) or a `<...>`
 * type-literal string, never an `expression` wrapper (unlike an ordinary context `field`,
 * `denormalize`'s generic `'field'` case). Shared by `typeDefinitionFromChildren` (a whole-type
 * rewrite) and `createBoxedEditorService`'s `complexTypeOwner` coalescing (a single member edit —
 * `type` fields aren't individually addressable by the engine's `set`/`remove`/
 * `rename`, so every member edit rewrites the owning top-level `type` as a whole).
 */
export function denormalizeTypeField(row: BoxedRowData): string | PortableType {
    return row.kind === 'complexType' ? typeDefinitionFromChildren(row.children) : (row.value ?? row.type ?? '');
}

function typeDefinitionFromChildren(children: BoxedRowData[] | undefined): PortableType {
    return {
        '@kind': 'type',
        fields: Object.fromEntries((children ?? []).map((child) => [child.name, denormalizeTypeField(child)])),
    };
}

function recordFromCells(columns: string[] | undefined, cells: string[] | undefined): PortableContext {
    const fields: PortableContext['fields'] = {};
    (columns ?? []).forEach((column, index) => {
        const value = cells?.[index] ?? '';
        if (value !== '') fields[column] = expression(value);
    });
    return {'@kind': 'context', fields};
}

function recordFromTableRow(row: BoxedTableRowData, columns = row.columns): PortableContext {
    const result = recordFromCells(columns, row.cells);
    for (const child of row.children ?? []) {
        result.fields[child.name] = denormalize(child) as PortableValue;
    }
    return result;
}

function functionNode(row: BoxedTableRowData): PortableSetValue {
    const children = row.children ?? [];
    const onlyResult =
        children.length === 1 && (children[0].kind === 'function-result' || children[0].name === 'result');
    const keyword = row.keyword ?? 'function';
    // A `decision` or a `facts` holds its one parameter, the decision context, in `context`.
    if (keyword === 'facts') {
        return {
            '@kind': 'facts',
            context: parameters(row.parameters),
            fields: contextFromChildren(children).fields,
        } as PortableSetValue;
    }
    const body = onlyResult ? expression(children[0].value) : contextFromChildren(children);
    if (keyword === 'decision') {
        return {'@kind': 'decision', context: parameters(row.parameters), body} as PortableSetValue;
    }
    return {
        '@kind': keyword === 'function' ? 'method' : keyword,
        parameters: parameters(row.parameters),
        body,
    } as PortableSetValue;
}

function ruleNode(row: BoxedTableRowData): PortableRule {
    const when =
        row.conditionsExpression !== undefined
            ? expression(row.conditionsExpression)
            : Object.fromEntries(
                  (row.conditionColumns ?? [])
                      .map((column, index) => [column, row.conditions?.[index] ?? ''] as const)
                      .filter(([, value]) => value !== ''),
              );
    return {
        '@kind': 'rule',
        ...(row.name && !/^Rule \d+$/.test(row.name) ? {name: row.name} : {}),
        ...(Object.keys(when).length > 0 ? {when} : {}),
        then: recordFromCells(row.actionColumns, row.actions),
        ...(row.priority !== undefined ? {priority: row.priority} : {}),
    } as PortableRule;
}

function rulesetNode(row: BoxedTableRowData): PortableRuleset {
    const hitPolicy = row.children?.find((child) => child.kind === 'ruleset-hit-policy')?.value;
    const rules: PortableRule[] = (row.children ?? [])
        .filter((child) => child.kind === 'rule')
        .map((child) =>
            ruleNode({
                ...(child as BoxedTableRowData),
                conditionColumns: row.conditionColumns,
                actionColumns: row.actionColumns,
            }),
        );
    const fallback = row.children?.find((child) => child.kind === 'ruleset-default') as BoxedTableRowData | undefined;
    return {
        '@kind': 'ruleset',
        parameters: parameters(row.parameters),
        hitPolicy: (hitPolicy ?? 'first-match') as HitPolicy,
        rules,
        ...(fallback ? {default: recordFromCells(row.actionColumns, fallback.actions)} : {}),
    };
}

function optimisationNode(row: BoxedTableRowData): PortableOptimise {
    const node: Record<string, unknown> = {
        '@kind': 'optimise',
        parameters: parameters(row.parameters),
    };
    for (const child of row.children ?? []) {
        switch (child.kind) {
            case 'optimisation-setting':
                node[child.name] =
                    child.name === 'bottlenecks'
                        ? child.value === 'true'
                        : child.name === 'timeLimit'
                          ? Number(child.value)
                          : (child.value ?? '');
                break;
            case 'optimisation-variable-group':
                node.variables = Object.fromEntries(
                    (child.children ?? []).map((variable) => [variable.name, variable.value ?? '']),
                );
                break;
            case 'optimisation-objective':
                node[child.name] = child.value ?? '';
                break;
            case 'optimisation-constraint-group':
                node.constraints = Object.fromEntries(
                    (child.children ?? []).map((constraint) => [constraint.name, constraint.value ?? '']),
                );
                break;
        }
    }
    return node as unknown as PortableOptimise;
}

/** The `set` value of a row. */
export function denormalize(row: BoxedRowData): PortableSetValue {
    switch (row.kind) {
        case 'model':
            return contextFromChildren(row.children);
        case 'context':
            return row.keyword === 'workbook'
                ? {...contextFromChildren(row.children), '@kind': 'workbook'}
                : contextFromChildren(row.children);
        case 'complexType':
            return typeDefinitionFromChildren(row.children);
        case 'list':
            return (row.children ?? []).map((child) => denormalize(child)) as PortableValue[];
        case 'relation':
            return (row.children ?? []).map((child) => {
                const table = child as BoxedTableRowData;
                return recordFromTableRow(table, (row as BoxedTableRowData).columns);
            });
        case 'relation-item':
            return recordFromTableRow(row as BoxedTableRowData);
        case 'function':
            return functionNode(row as BoxedTableRowData);
        case 'ruleset':
            return rulesetNode(row as BoxedTableRowData);
        case 'optimisation':
            return optimisationNode(row as BoxedTableRowData);
        case 'rule':
            return ruleNode(row as BoxedTableRowData);
        case 'ruleset-default':
            return recordFromCells((row as BoxedTableRowData).actionColumns, (row as BoxedTableRowData).actions);
        case 'ruleset-hit-policy':
            return row.value ?? '';
        case 'optimisation-setting':
            return row.name === 'bottlenecks'
                ? row.value === 'true'
                : row.name === 'timeLimit'
                  ? Number(row.value)
                  : (row.value ?? '');
        case 'optimisation-variable':
        case 'optimisation-objective':
        case 'optimisation-constraint':
            return row.value ?? '';
        case 'function-result':
        case 'list-item':
        case 'field':
            return expression(row.value);
        case 'optimisation-variable-group':
        case 'optimisation-constraint-group':
            return contextFromChildren(row.children);
    }
}
