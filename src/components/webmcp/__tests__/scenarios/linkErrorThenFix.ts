import {RULESET_MODEL, RULESET_TESTS, type Scenario} from './scenario';

export const linkErrorThenFix: Scenario = {
    name: 'a change with a link error, then the fixed change',
    task: 'Add a field bonus that doubles the income.',
    project: {model: {dsl: RULESET_MODEL}, tests: RULESET_TESTS},
    steps: [
        {
            note: 'The field `incme` does not exist: nothing changes and the diagnostics return.',
            tool: 'edit-model',
            input: {operations: [{op: 'set', path: 'bonus', code: 'applicant.incme * 2'}]},
            expect: {ok: false, code: 'LinkError', diagnostics: 1},
        },
        {
            note: 'The fixed change links; every case still passes.',
            tool: 'edit-model',
            input: {operations: [{op: 'set', path: 'bonus', code: 'applicant.income * 2'}]},
            expect: {
                ok: true,
                changed: ['bonus'],
                regression: {passed: 2, failed: 0, newlyFailing: [], newlyPassing: []},
            },
        },
    ],
};
