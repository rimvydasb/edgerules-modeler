import {changeIdOf, RULESET_MODEL, RULESET_TESTS, type Scenario} from './scenario';

export const undoWrongChange: Scenario = {
    name: 'undo a wrong change',
    task: 'Lower the default of income-based rows. The change breaks cases: take it back.',
    project: {model: {dsl: RULESET_MODEL}, tests: RULESET_TESTS},
    steps: [
        {
            note: 'A wrong change: the ruleset now has no matching rows, both cases fail.',
            tool: 'edit-model',
            input: {
                operations: [
                    {
                        op: 'set',
                        path: 'risk',
                        code: 'ruleset risk(age: number, income: number): {\n hitPolicy: "first-match"\n rules: [\n { when: { age: > 100 }, then: { level: "high" } }\n ]\n default: { level: "none" }\n}',
                    },
                ],
            },
            expect: {
                ok: true,
                changed: ['risk'],
                regression: {passed: 0, failed: 2, newlyFailing: ['Young', 'Senior'], newlyPassing: []},
            },
        },
        {
            note: 'Undo the change: both cases pass again.',
            tool: 'undo-agent-change',
            input: (previous) => ({changeId: changeIdOf(previous, 0)}),
            expect: {
                ok: true,
                changed: ['risk'],
                regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: ['Young', 'Senior']},
            },
        },
    ],
};
