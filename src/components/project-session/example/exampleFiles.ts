import type {TestSuite} from '../../test-cases-service';
import type {FlowLayout} from '#lib/flowLayout';
import {
    DEFAULT_MODEL_SOURCE,
    PROJECT_FORMAT_VERSION,
    PROJECT_MANIFEST_FILE,
    emptyDocumentation,
    emptyFlow,
    emptyTests,
    generateReadme,
    type DocumentationDocument,
    type FlowMetadataDocument,
    type TestSuitesDocument,
} from '../bundle/types';
import {ProjectError} from '../errors';
import type {ProjectBundleInput} from '../factory/createProjectFactory';
import {prettierJson} from './prettierJson';

export const EXAMPLE_README_FILE = 'README.md';
export const EXAMPLE_DOCUMENTATION_FILE = 'docs/descriptions.json';
export const EXAMPLE_FLOW_FILE = 'flow/layout.json';
const TEST_SUITE_SUFFIX = '.tests.json';
const SUBJECT_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Files of an example by path relative to the example directory; the content is text. */
export type ExampleFiles = Record<string, string>;

export type ExampleLevel = 'beginner' | 'intermediate' | 'advanced';

/** The catalog metadata an example adds to a project: the `example` object of `edgerules.project.json`. */
export interface ExampleMetadata {
    industry: string; // id from `industries.json`; the parent folder of the example
    level: ExampleLevel;
    features: string[]; // DSL features the example shows
    engine: string; // semver range of `@edgerules/web` that links the model
    authors: string[];
    requires?: string[]; // host capabilities, for example 'milp-solver' for an `optimise` element
    thumbnail?: string; // path of the card image, relative to the example directory
}

// Fixed key orders keep the diff of a change to one line. Keys that are not listed follow, sorted.
const MANIFEST_KEYS = [
    'kind',
    'formatVersion',
    'name',
    'description',
    'tags',
    'model',
    'documentation',
    'tests',
    'flow',
];
const MODEL_KEYS = ['format', 'source', 'name', 'version'];
const EXAMPLE_KEYS = ['industry', 'level', 'features', 'thumbnail', 'engine', 'authors', 'requires'];
const SUITE_KEYS = ['rows', 'cases'];
const ROW_KEYS = ['path', 'section', 'order', 'type', 'present', 'custom'];
const CASE_KEYS = ['id', 'name', 'order', 'inputs', 'assertions'];
const LAYOUT_KEYS = ['positions', 'outputs', 'charts'];

function fail(message: string, issues: string[] = []): never {
    throw new ProjectError('invalid-bundle', message, {issues});
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

type Plain = Record<string, unknown>;

/** The entries of `value` with `order` first, in that order, and the other keys sorted after them. */
function ordered(value: object, order: string[]): Plain {
    const source = value as Plain;
    const known = order.filter((key) => source[key] !== undefined);
    const rest = Object.keys(source)
        .filter((key) => !order.includes(key) && source[key] !== undefined)
        .sort(compare);
    return Object.fromEntries([...known, ...rest].map((key) => [key, source[key]]));
}

function sortedMap<T>(map: Record<string, T>, transform: (value: T) => unknown = (value) => value): Plain {
    return Object.fromEntries(
        Object.keys(map)
            .sort(compare)
            .map((key) => [key, transform(map[key])]),
    );
}

function suiteJson(suite: TestSuite): Plain {
    return ordered(
        {
            rows: suite.rows.map((row) => ordered(row, ROW_KEYS)),
            cases: suite.cases.map((testCase) => ordered(testCase, CASE_KEYS)),
        },
        SUITE_KEYS,
    );
}

// A drag of 0.3 px must not change the file.
function layoutJson(layout: FlowLayout): Plain {
    const positions = sortedMap(layout.positions, ({x, y}) => ({x: Math.round(x), y: Math.round(y)}));
    return ordered({...layout, positions}, LAYOUT_KEYS);
}

function dslText(model: ProjectBundleInput['model']): string {
    if (!('dsl' in model)) fail('An example stores the model as DSL: convert a Portable model to DSL first');
    return `${model.dsl.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
}

/**
 * The canonical files of an example directory: the same text for the same project, so a change to the project shows as
 * a small diff. Throws `ProjectError` `invalid-bundle` for a model that is not DSL or a test subject that is not a file
 * name. It uses no engine.
 */
export function exampleToFiles(project: ProjectBundleInput, example: ExampleMetadata): ExampleFiles {
    const files: ExampleFiles = {};
    const documentation = project.documentation ?? emptyDocumentation();
    const tests = project.tests ?? emptyTests();
    const flow = project.flow ?? emptyFlow();
    const subjects = Object.keys(tests.subjects).sort(compare);
    const layoutRoots = Object.keys(flow.layouts);

    for (const subject of subjects) {
        if (!SUBJECT_PATTERN.test(subject)) fail(`The test subject '${subject}' is not a file name`);
    }

    files[DEFAULT_MODEL_SOURCE] = dslText(project.model);
    files[EXAMPLE_README_FILE] = project.readme ?? generateReadme(project.name, project.description);
    if (Object.keys(documentation.byPath).length > 0) {
        files[EXAMPLE_DOCUMENTATION_FILE] = prettierJson({
            schemaVersion: documentation.schemaVersion,
            byPath: sortedMap(documentation.byPath),
        });
    }
    for (const subject of subjects) {
        files[`tests/${subject}${TEST_SUITE_SUFFIX}`] = prettierJson(suiteJson(tests.subjects[subject]));
    }
    if (layoutRoots.length > 0) {
        files[EXAMPLE_FLOW_FILE] = prettierJson({
            schemaVersion: flow.schemaVersion,
            layouts: sortedMap(flow.layouts, layoutJson),
        });
    }

    const {name, version} = project.model;
    files[PROJECT_MANIFEST_FILE] = prettierJson({
        ...ordered(
            {
                kind: 'EdgeRulesProject',
                formatVersion: PROJECT_FORMAT_VERSION,
                name: project.name,
                description: project.description,
                tags: project.tags,
                model: ordered({format: 'dsl', source: DEFAULT_MODEL_SOURCE, name, version}, MODEL_KEYS),
                documentation: files[EXAMPLE_DOCUMENTATION_FILE] === undefined ? undefined : EXAMPLE_DOCUMENTATION_FILE,
                tests:
                    subjects.length === 0
                        ? undefined
                        : subjects.map((subject) => `tests/${subject}${TEST_SUITE_SUFFIX}`),
                flow: files[EXAMPLE_FLOW_FILE] === undefined ? undefined : EXAMPLE_FLOW_FILE,
            },
            MANIFEST_KEYS,
        ),
        example: ordered(example, EXAMPLE_KEYS),
    });
    return files;
}

function readText(files: ExampleFiles, path: string, referencedBy: string): string {
    const text = files[path];
    if (text === undefined) fail(`${referencedBy} lists '${path}', which is not in the example`);
    return text;
}

function readJson(files: ExampleFiles, path: string, referencedBy: string): Plain {
    const text = readText(files, path, referencedBy);
    try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Plain;
    } catch (error) {
        fail(`'${path}' is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    return fail(`'${path}' is not a JSON object`);
}

function readManifest(files: ExampleFiles): Plain {
    if (files[PROJECT_MANIFEST_FILE] === undefined) fail(`The example has no ${PROJECT_MANIFEST_FILE}`);
    const manifest = readJson(files, PROJECT_MANIFEST_FILE, 'The example');
    if (manifest.kind !== 'EdgeRulesProject') fail(`${PROJECT_MANIFEST_FILE}: kind must be "EdgeRulesProject"`);
    if (manifest.formatVersion !== PROJECT_FORMAT_VERSION) {
        fail(`${PROJECT_MANIFEST_FILE}: formatVersion must be ${PROJECT_FORMAT_VERSION}`);
    }
    return manifest;
}

/** The `example` object of the manifest. Throws `ProjectError` `invalid-bundle` when it is missing. */
export function exampleMetadataOf(files: ExampleFiles): ExampleMetadata {
    const example = readManifest(files).example;
    if (typeof example !== 'object' || example === null) fail(`${PROJECT_MANIFEST_FILE} has no "example" object`);
    return example as ExampleMetadata;
}

/**
 * The project of an example directory, for `ProjectFactory.createBundle`. The manifest lists the slice files, so no
 * directory listing is needed. Throws `ProjectError` `invalid-bundle` for a missing or unreadable file; the factory
 * checks the model and the slices.
 */
export function exampleFromFiles(files: ExampleFiles): ProjectBundleInput {
    const manifest = readManifest(files);
    const model = (manifest.model ?? {}) as Plain;
    const source = typeof model.source === 'string' ? model.source : DEFAULT_MODEL_SOURCE;
    const name = manifest.name;
    if (typeof name !== 'string' || name === '') fail(`${PROJECT_MANIFEST_FILE}: name must be a non-empty string`);

    const input: ProjectBundleInput = {
        name,
        ...(typeof manifest.description === 'string' && {description: manifest.description}),
        ...(Array.isArray(manifest.tags) && {tags: manifest.tags as string[]}),
        model: {
            dsl: readText(files, source, PROJECT_MANIFEST_FILE),
            ...(typeof model.name === 'string' && {name: model.name}),
            ...(typeof model.version === 'string' && {version: model.version}),
        },
        ...(files[EXAMPLE_README_FILE] !== undefined && {readme: files[EXAMPLE_README_FILE]}),
    };

    if (typeof manifest.documentation === 'string') {
        const document = readJson(files, manifest.documentation, PROJECT_MANIFEST_FILE);
        input.documentation = document as unknown as DocumentationDocument;
    }
    if (Array.isArray(manifest.tests)) {
        const subjects: TestSuitesDocument['subjects'] = {};
        for (const path of manifest.tests as string[]) {
            const file = path.slice(path.lastIndexOf('/') + 1);
            if (!file.endsWith(TEST_SUITE_SUFFIX)) fail(`'${path}' is not a ${TEST_SUITE_SUFFIX} file`);
            subjects[file.slice(0, -TEST_SUITE_SUFFIX.length)] = readJson(
                files,
                path,
                PROJECT_MANIFEST_FILE,
            ) as unknown as TestSuite;
        }
        input.tests = {schemaVersion: 1, subjects};
    }
    if (typeof manifest.flow === 'string') {
        input.flow = readJson(files, manifest.flow, PROJECT_MANIFEST_FILE) as unknown as FlowMetadataDocument;
    }
    return input;
}
