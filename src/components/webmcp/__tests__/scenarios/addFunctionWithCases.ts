import {RULESET_MODEL, RULESET_TESTS, type Scenario} from './scenario';

export const addFunctionWithCases: Scenario = {
    name: 'add a function and its test cases',
    task: 'Add a function double(x) and cover it with two test cases.',
    project: {model: {dsl: RULESET_MODEL}, tests: RULESET_TESTS},
    steps: [
        {
            note: 'Add the function. No case exists for it yet.',
            tool: 'edit-model',
            input: {operations: [{op: 'set', path: 'double', code: 'func double(x: number): { result: x * 2 }'}]},
            expect: {
                ok: true,
                changed: ['double'],
                regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: []},
            },
        },
        {
            note: 'Add the cases of the function: every case passes.',
            tool: 'edit-tests',
            input: {
                subject: 'double',
                operations: [
                    {op: 'add', name: 'Two', inputs: {x: '2'}, assertions: {result: '4'}},
                    {op: 'add', name: 'Zero', inputs: {x: '0'}, assertions: {result: '0'}},
                ],
            },
            expect: {
                ok: true,
                changed: ['double'],
                regression: {passed: 4, failed: 0, newlyFailing: [], newlyPassing: []},
            },
        },
    ],
};
