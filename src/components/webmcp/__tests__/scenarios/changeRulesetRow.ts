import {RULESET_MODEL, RULESET_TESTS, type Scenario} from './scenario';

const BROKEN_RULESET = `ruleset risk(age: number, income: number): {
    hitPolicy: "first-match"
    rules: [
        { when: { age: 18..25 }, then: { level: "high" } }
        { when: { age: > 25 }, then: { level: "high" } }
    ]
    default: { level: "none" }
}`;

const FIXED_RULESET = BROKEN_RULESET.replace('then: { level: "high" } }\n    ]', 'then: { level: "low" } }\n    ]');

export const changeRulesetRow: Scenario = {
    name: 'change a ruleset row, then fix it',
    task: 'Everyone above 25 is high risk. Change the second row. Then restore the low level for them.',
    project: {model: {dsl: RULESET_MODEL}, tests: RULESET_TESTS},
    steps: [
        {
            note: 'Baseline: both cases pass.',
            tool: 'run-tests',
            input: {},
            expect: {ok: true, regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: []}},
        },
        {
            note: 'The second row now gives "high": the Senior case fails.',
            tool: 'edit-model',
            input: {operations: [{op: 'set', path: 'risk', code: BROKEN_RULESET}]},
            expect: {
                ok: true,
                changed: ['risk'],
                regression: {passed: 1, failed: 1, newlyFailing: ['Senior'], newlyPassing: []},
            },
        },
        {
            note: 'Fix the row: the Senior case passes again.',
            tool: 'edit-model',
            input: {operations: [{op: 'set', path: 'risk', code: FIXED_RULESET}]},
            expect: {
                ok: true,
                changed: ['risk'],
                regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: ['Senior']},
            },
        },
    ],
};
