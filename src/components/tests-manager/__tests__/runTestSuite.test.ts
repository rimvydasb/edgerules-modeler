import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import type {TestSuite} from '../../test-cases-service';
import {runTestSuite} from '../runner/runTestSuite';

const MODEL = `{
    func risk(age: number): { level: if age < 25 then "high" else "low" }
}`;

const SUITE: TestSuite = {
    rows: [
        {path: 'age', section: 'inputs', order: 0, type: 'number', present: true},
        {path: 'level', section: 'assertions', order: 0, type: 'string', present: true},
    ],
    cases: [
        {id: 'risk-1', name: 'Young', order: 0, inputs: {age: '20'}, assertions: {level: 'high'}},
        {id: 'risk-2', name: 'Older', order: 1, inputs: {age: '40'}, assertions: {level: 'low'}},
    ],
};

function engine() {
    const service = MutableDecisionService.fromCode(MODEL);
    service.link();
    return service;
}

describe('runTestSuite', () => {
    it('passes the cases whose assertions match the engine result', async () => {
        const outcomes = await runTestSuite(engine(), 'risk', SUITE);
        expect(outcomes).toEqual([
            {id: 'risk-1', name: 'Young', passed: true, failures: []},
            {id: 'risk-2', name: 'Older', passed: true, failures: []},
        ]);
    });

    it('fails a case with the expected and the actual value', async () => {
        const wrong: TestSuite = {...SUITE, cases: [{...SUITE.cases[0], assertions: {level: 'low'}}]};
        const [outcome] = await runTestSuite(engine(), 'risk', wrong);
        expect(outcome.passed).toBe(false);
        expect(outcome.failures).toEqual(['level: expected low, got "high"']);
    });

    it('fails a case when the subject does not exist', async () => {
        const [outcome] = await runTestSuite(engine(), 'missing', SUITE);
        expect(outcome.passed).toBe(false);
        expect(outcome.failures).not.toEqual([]);
    });
});
