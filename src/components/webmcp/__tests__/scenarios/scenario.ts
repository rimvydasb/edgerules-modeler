import type {ProjectBundleInput, TestSuitesDocument} from '../../../project-session';
import type {ToolResult} from '../../core/toolResult';

/** The expected regression report of one call. Case lists are case names, in report order. */
export interface ExpectedRegression {
    passed: number;
    failed: number;
    newlyFailing: string[];
    newlyPassing: string[];
}

export interface ScenarioStep {
    note: string; // what the agent intends with this call
    tool: string;
    // The input; a function reads the results of the earlier steps (for example, a `changeId`).
    input: object | ((previous: ToolResult<unknown>[]) => object);
    // Expected outcome: `ok: true` with the regression report, or `ok: false` with an error code.
    expect:
        | {ok: true; regression: ExpectedRegression; changed?: string[]; extra?: Record<string, unknown>}
        | {ok: false; code: string; diagnostics?: number};
}

/** A fixed change-and-react session: a task text, the tool calls in order and the expected result of each call. */
export interface Scenario {
    name: string;
    task: string;
    project: Partial<ProjectBundleInput>;
    steps: ScenarioStep[];
}

export const RULESET_MODEL = `{
    ruleset risk(age: number, income: number): {
        hitPolicy: "first-match"
        rules: [
            { when: { age: 18..25 }, then: { level: "high" } }
            { when: { age: > 25 }, then: { level: "low" } }
        ]
        default: { level: "none" }
    }
    applicant: { age: 30, income: 5000 }
    decision: risk(age: applicant.age, income: applicant.income)
    level: decision.level
}`;

export const RULESET_TESTS: TestSuitesDocument = {
    schemaVersion: 1,
    subjects: {
        risk: {
            cases: [
                {
                    id: 'young',
                    name: 'Young',
                    order: 0,
                    inputs: {age: '20', income: '1000'},
                    assertions: {level: 'high'},
                },
                {
                    id: 'senior',
                    name: 'Senior',
                    order: 1,
                    inputs: {age: '60', income: '1000'},
                    assertions: {level: 'low'},
                },
            ],
            rows: [
                {path: 'age', section: 'inputs', order: 0, type: 'number', present: true},
                {path: 'income', section: 'inputs', order: 1, type: 'number', present: true},
                {path: 'level', section: 'assertions', order: 0, type: 'string', present: true},
            ],
        },
    },
};

export const changeIdOf = (previous: ToolResult<unknown>[], step: number): string => {
    const result = previous[step];
    if (!result?.ok || typeof (result as {changeId?: unknown}).changeId !== 'string') {
        throw new Error(`Step ${step} has no changeId.`);
    }
    return (result as unknown as {changeId: string}).changeId;
};
