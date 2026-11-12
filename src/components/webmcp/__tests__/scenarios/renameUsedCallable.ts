import {RULESET_MODEL, RULESET_TESTS, type Scenario} from './scenario';

export const renameUsedCallable: Scenario = {
    name: 'rename a callable that a ruleset uses',
    task: 'Rename the ruleset risk to riskLevel.',
    project: {model: {dsl: RULESET_MODEL}, tests: RULESET_TESTS},
    steps: [
        {
            note: 'The call in `decision` is rewritten; the cases follow the new name.',
            tool: 'edit-model',
            input: {operations: [{op: 'rename', path: 'risk', newName: 'riskLevel'}]},
            expect: {
                ok: true,
                changed: ['riskLevel', 'decision'],
                regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: []},
            },
        },
    ],
};
