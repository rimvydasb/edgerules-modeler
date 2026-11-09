import 'fake-indexeddb/auto';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {describe, expect, it} from 'vitest';
import {format} from 'prettier';
import {createTestRunner} from '../../tests-manager/runner/createTestRunner';
import type {TestSubject} from '../../tests-manager/tests-manager-types';
import {ProjectError} from '../errors';
import {exampleFromFiles, exampleMetadataOf, exampleToFiles, type ExampleFiles} from '../example/exampleFiles';
import {openFixtureProject} from '../testing/sessionFixture';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'mini-example');

function readDirectory(directory: string): ExampleFiles {
    const files: ExampleFiles = {};
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) Object.assign(files, readDirectory(path));
        else files[relative(FIXTURE, path)] = readFileSync(path, 'utf8');
    }
    return files;
}

const fixture = readDirectory(FIXTURE);
const roundTrip = (files: ExampleFiles) => exampleToFiles(exampleFromFiles(files), exampleMetadataOf(files));

describe('example files', () => {
    it('writes the same files it reads: the fixture is canonical', () => {
        expect(roundTrip(fixture)).toEqual(fixture);
    });

    it('writes JSON that Prettier leaves unchanged', async () => {
        for (const [path, text] of Object.entries(roundTrip(fixture))) {
            if (path.endsWith('.json')) expect(await format(text, {filepath: path, printWidth: 120})).toBe(text);
        }
    });

    it('opens the fixture with the project factory, and its test suite passes with the real engine', async () => {
        const {session, bundle} = await openFixtureProject(exampleFromFiles(fixture));
        expect(bundle.manifest.model).toMatchObject({name: 'Mini Risk', version: '1.0.0'});
        expect(bundle.readme).toBe(fixture['README.md']);
        expect(Object.keys(bundle.tests.subjects)).toEqual(['risk']);

        const subject: TestSubject = {id: 'risk', kind: 'function', name: 'risk'};
        const testCases = session.tests.forSubject('risk');
        await createTestRunner(session.engine as never, testCases, subject).runAll();
        expect(testCases.listTestCases()).toHaveLength(2);
        for (const testCase of testCases.listTestCases()) {
            expect(testCases.getResultSet(testCase.id)?.status, testCase.name).toBe('ok');
            expect(testCases.getResultSet(testCase.id)?.results.level?.value, testCase.name).toBe(
                testCase.assertions.level,
            );
        }
    });

    it('rounds flow positions to whole pixels and orders the keys', () => {
        const input = exampleFromFiles(fixture);
        input.flow = {
            schemaVersion: 2,
            layouts: {riskBook: {positions: {b: {x: 10.4, y: 20.6}, a: {x: 1, y: 2}}, outputs: []}},
        };
        const layout = JSON.parse(exampleToFiles(input, exampleMetadataOf(fixture))['flow/layout.json']);
        expect(Object.keys(layout.layouts.riskBook.positions)).toEqual(['a', 'b']);
        expect(layout.layouts.riskBook.positions.b).toEqual({x: 10, y: 21});
    });

    it('is deterministic whatever the order of the authored maps', () => {
        const input = exampleFromFiles(fixture);
        const reversed = {...input, documentation: {schemaVersion: 1 as const, byPath: {z: 'last', '*': 'first'}}};
        const forward = {...input, documentation: {schemaVersion: 1 as const, byPath: {'*': 'first', z: 'last'}}};
        const meta = exampleMetadataOf(fixture);
        expect(exampleToFiles(reversed, meta)).toEqual(exampleToFiles(forward, meta));
    });

    it('rejects a missing file, a Portable model and a test subject that is not a file name', () => {
        const {'model/main.edge': _model, ...withoutModel} = fixture;
        expect(() => exampleFromFiles(withoutModel)).toThrow(ProjectError);
        expect(() => exampleFromFiles({})).toThrow(/edgerules.project.json/);
        const input = exampleFromFiles(fixture);
        expect(() => exampleToFiles({...input, model: {portable: {} as never}}, exampleMetadataOf(fixture))).toThrow(
            /DSL/,
        );
        const subject = input.tests?.subjects.risk;
        expect(() =>
            exampleToFiles(
                {...input, tests: {schemaVersion: 1, subjects: {'a/b': subject!}}},
                exampleMetadataOf(fixture),
            ),
        ).toThrow(/file name/);
    });
});
