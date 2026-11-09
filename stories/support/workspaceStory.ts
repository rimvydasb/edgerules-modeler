import {init, MutableDecisionService} from '@edgerules/web/mutable';
import {
    createLocalProjectRepository,
    createProjectFactory,
    type ProjectBundleInput,
} from '../../src/components/project-session';
import {addWorkspaceProject} from '../../src/components/local-workspace';

/**
 * A fresh workspace in its own IndexedDB database, seeded with `projects`. Every call gets a new database, so a story
 * always starts from its fixture and stories rendered side by side never share projects.
 */
export async function openStoryWorkspace(projects: ProjectBundleInput[] = []) {
    await init();
    const repository = createLocalProjectRepository({
        dbName: `edgerules-storybook-workspace-${crypto.randomUUID()}`,
    });
    const factory = createProjectFactory({engine: MutableDecisionService});
    for (const project of projects) await addWorkspaceProject({repository, factory}, project);
    return {repository, factory};
}

const MODEL = '{ amount: 1000\n  fee: amount * 0.02 }';
const ORIGIN = {library: 'https://cdn.jsdelivr.net/gh/rimvydasb/edgerules-examples/library.json'};

export const COPIES: ProjectBundleInput[] = [
    {
        name: 'Loan repayment',
        description: 'Prices a loan request',
        model: {dsl: MODEL},
        origin: {...ORIGIN, id: 'loan-repayment', version: '1.2.0'},
    },
    {name: 'Claims triage', model: {dsl: MODEL}, origin: {...ORIGIN, id: 'claims-triage', version: '1.0.0'}},
    {name: 'My pricing', description: 'Own pricing rules', model: {dsl: MODEL}},
];
