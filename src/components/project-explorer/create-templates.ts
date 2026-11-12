import type {PortableSetValue} from '@edgerules/portable';
import type {ExplorerEntryKind, ExplorerSection} from './tree-model';

/** One "New …" item of a section menu. */
export interface CreateOption {
    kind: ExplorerEntryKind;
    label: string;
    defaultName: string; // the start of the proposed name; a number makes it unique
    // The new entity is declared for a record type the user picks: the template gets its name, and the proposed name
    // starts with it (`ApplicantFacts`).
    ofType?: boolean;
    template: (type?: string) => PortableSetValue;
}

// The parameter name of a declaration for `type`: `applicant` for `Applicant`.
function parameterName(type: string): string {
    return type.charAt(0).toLowerCase() + type.slice(1);
}

const EMPTY_BODY = {'@kind': 'context', fields: {result: 0}} as const;

// The smallest valid entity of each kind; the user completes it in the opened editor.
// A method is a function or a ruleset; a service is a `service` declaration and a workbook a root `workbook`
// declaration. Input, output and chart nodes exist only inside a workbook, so no section offers them: the Flow Editor of the workbook creates them.
// A `facts` declaration is declared for an existing record type, which the user picks. A `decision` section offers no
// "New …" item.
export const CREATE_OPTIONS: Record<Exclude<ExplorerSection, 'documents' | 'tests' | 'decisions'>, CreateOption[]> = {
    types: [
        {
            kind: 'type',
            label: 'Type',
            defaultName: 'NewType',
            template: () => ({'@kind': 'type', fields: {value: {'@kind': 'placeholder', type: 'string'}}}),
        },
    ],
    factsLibrary: [
        {
            kind: 'facts',
            label: 'Fact',
            defaultName: 'Facts',
            ofType: true,
            template: (type = 'Type') => ({'@kind': 'facts', context: {[parameterName(type)]: type}, fields: {}}),
        },
    ],
    methods: [
        {
            kind: 'function',
            label: 'Function',
            defaultName: 'newFunction',
            template: () => ({'@kind': 'method', parameters: {}, body: EMPTY_BODY}),
        },
        {
            kind: 'ruleset',
            label: 'Ruleset',
            defaultName: 'newRuleset',
            template: () => ({
                '@kind': 'ruleset',
                parameters: {value: 'number'},
                hitPolicy: 'first-match',
                rules: [],
                default: EMPTY_BODY,
            }),
        },
    ],
    services: [
        {
            kind: 'service',
            label: 'Service',
            defaultName: 'newService',
            template: () => ({'@kind': 'service', parameters: {}, body: EMPTY_BODY}),
        },
    ],
    variables: [
        {kind: 'variable', label: 'Value', defaultName: 'newValue', template: () => 0},
        {
            kind: 'context',
            label: 'Context',
            defaultName: 'newContext',
            template: () => ({'@kind': 'context', fields: {}}),
        },
    ],
    workbooks: [
        {
            kind: 'workbook',
            label: 'Workbook',
            defaultName: 'newWorkbook',
            template: () => ({'@kind': 'workbook', fields: {}}),
        },
    ],
};

/** `base`, or `base2`, `base3`, … : the first name that `taken` does not hold. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
    if (!taken.has(base)) return base;
    let index = 2;
    while (taken.has(`${base}${index}`)) index++;
    return `${base}${index}`;
}
