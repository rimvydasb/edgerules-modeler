// Exports the projects of `models/` as example directories to a checkout of `edgerules-examples`.
//
//   node scripts/export-examples.ts [target-directory]     (default: ../edgerules-examples)
//
// It loads the `*_PROJECT` bundles with Vite, so that `README.md?raw` imports and the TypeScript sources resolve as they
// do in Storybook, and writes each example with `exampleToFiles`. A second run changes no file. The `assets/` folder of
// an example is not touched.
import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

type ExampleMetadata = import('../src/components/project-session/example/exampleFiles').ExampleMetadata;
type ProjectBundleInput = import('../src/components/project-session/factory/createProjectFactory').ProjectBundleInput;

interface ExampleSource {
    module: string; // module of `models/` that exports the project
    exportName: string;
    id: string; // the slug: the folder name and the example id
    example: ExampleMetadata;
}

const ENGINE = '>=0.2.7-alpha';
const AUTHORS = ['edgerules'];

// The first 3 examples of docs/stories/examples-repository-story.md.
const EXAMPLES: ExampleSource[] = [
    {
        module: '/models/loan-repayment/index.ts',
        exportName: 'LOAN_REPAYMENT_PROJECT',
        id: 'loan-repayment',
        example: {
            industry: 'financial',
            level: 'beginner',
            features: ['decision-table', 'function', 'service', 'workbook', 'chart'],
            engine: ENGINE,
            authors: AUTHORS,
        },
    },
    {
        module: '/models/loan-origination/index.ts',
        exportName: 'LOAN_ORIGINATION_PROJECT',
        id: 'loan-origination',
        example: {
            industry: 'financial',
            level: 'intermediate',
            features: ['facts', 'decision-table', 'decision', 'function', 'service', 'workbook', 'chart'],
            engine: ENGINE,
            authors: AUTHORS,
        },
    },
    {
        module: '/models/client-outreach/index.ts',
        exportName: 'CLIENT_OUTREACH_PROJECT',
        id: 'client-outreach',
        example: {
            industry: 'financial',
            level: 'advanced',
            features: ['optimise', 'decision-table', 'loop', 'function', 'service', 'workbook'],
            engine: ENGINE,
            authors: AUTHORS,
            requires: ['milp-solver'],
        },
    },
];

// Written by the export; everything else in an example directory (`assets/`) stays.
const MANAGED = ['model', 'docs', 'tests', 'flow'];
const MANAGED_ROOT_FILES = ['edgerules.project.json', 'README.md'];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? join(root, '..', 'edgerules-examples'));

const server = await createServer({
    root,
    appType: 'custom',
    server: {middlewareMode: true},
    logLevel: 'error',
    optimizeDeps: {noDiscovery: true},
});
try {
    const {exampleToFiles} = await server.ssrLoadModule('/src/components/project-session/example/exampleFiles.ts');
    for (const {module, exportName, id, example} of EXAMPLES) {
        const project = (await server.ssrLoadModule(module))[exportName] as ProjectBundleInput;
        const directory = join(target, 'examples', example.industry, id);
        for (const name of MANAGED) rmSync(join(directory, name), {recursive: true, force: true});
        for (const name of MANAGED_ROOT_FILES) rmSync(join(directory, name), {force: true});

        const files = exampleToFiles(project, example) as Record<string, string>;
        for (const [path, text] of Object.entries(files)) {
            mkdirSync(dirname(join(directory, path)), {recursive: true});
            writeFileSync(join(directory, path), text);
        }
        console.log(`${id}: ${Object.keys(files).length} files -> ${directory} (${readdirSync(directory).join(', ')})`);
    }
} finally {
    await server.close();
}
