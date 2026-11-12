import type {ProjectBundleInput, TestSuitesDocument} from '../../project-session';
import {openFixtureProject} from '../../project-session/testing/sessionFixture';
import {registerProjectTools} from '../registerProjectTools';
import type {ProjectToolsOptions} from '../webmcp-types';
import {createRecordingModelContext} from './recordingModelContext';

export {LOAN_MODEL} from '../../project-session/testing/sessionFixture';

// Tests of the fixture model `LOAN_MODEL`: `risk` gives "high" below 25 and "low" from 25.
// `young` and `senior` pass. The '*' case `unused-is-two` always fails: `unused` is 1.
export const LOAN_TESTS: TestSuitesDocument = {
    schemaVersion: 1,
    subjects: {
        risk: {
            cases: [
                {id: 'young', name: 'Young', order: 0, inputs: {age: '20'}, assertions: {level: 'high'}},
                {id: 'senior', name: 'Senior', order: 1, inputs: {age: '60'}, assertions: {level: 'low'}},
            ],
            rows: [
                {path: 'age', section: 'inputs', order: 0, type: 'number', present: true},
                {path: 'level', section: 'assertions', order: 0, type: 'string', present: true},
            ],
        },
        '*': {
            cases: [{id: 'unused-is-two', name: 'Unused is two', order: 0, inputs: {}, assertions: {unused: '2'}}],
            rows: [{path: 'unused', section: 'assertions', order: 0, type: 'number', present: true}],
        },
    },
};

/**
 * A real `@edgerules/node` project session with the tools registered on a recording model context. Needs
 * `fake-indexeddb/auto` imported by the test file.
 */
export async function openToolsFixture(
    input: Partial<ProjectBundleInput> = {tests: LOAN_TESTS},
    options: Partial<Omit<ProjectToolsOptions, 'modelContext' | 'session'>> = {},
) {
    const fixture = await openFixtureProject(input);
    const modelContext = createRecordingModelContext();
    const handle = registerProjectTools({modelContext, session: fixture.session, ...options});
    return {...fixture, modelContext, handle, call: modelContext.call};
}
