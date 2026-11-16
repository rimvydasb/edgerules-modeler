import {useEffect, useMemo, useState, type ReactElement} from 'react';
import {Box, Text} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {MutableDecisionService} from '@edgerules/web/mutable';
import {BoxedEditor, createBoxedEditorService, type BoxedEditorService} from '../../../src/components/boxed-editor';
import type {DocumentationService} from '../../../src/components/documentation-service';
import type {ProjectEngine, ProjectSession} from '../../../src/components/project-session';
import type {TestCasesService} from '../../../src/components/test-cases-service';
import {createTestRunner, type TestSubject} from '../../../src/components/tests-manager';
import {registerHighsSolver} from '../../support/highsSolver';
import {openStoryProject} from '../../support/storyProject';

const LOAN_ORIGINATION_MODEL = `{
  type Applicant: {
    name: <string, required: true>
    age: <number, required: true>
  }
  application: {
    applicationDate: <date, required: true>
    propertyValue: <number, required: true>
    loanAmount: <number, required: true>
  }
  payment: application.loanAmount / 12
}`;

interface EngineFixture {
    service: BoxedEditorService;
    mutable: ProjectEngine; // the session's engine facade
}

// The project session also supplies documentation and test cases.
interface ExecutingFixture extends EngineFixture {
    session: ProjectSession;
}

async function buildService(code: string) {
    return createBoxedEditorService((await openStoryProject(code)).engine);
}

async function buildServiceWithMutable(code: string): Promise<ExecutingFixture> {
    const session = await openStoryProject(code);
    return {service: createBoxedEditorService(session.engine), mutable: session.engine, session};
}

function errorText(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
        try {
            return JSON.stringify(error);
        } catch {
            // Fall through for non-serializable host errors.
        }
    }
    return String(error);
}

/**
 * Renders the real mutable engine alongside the editor, with the live result of the model under it.
 */
function ExecutingHarness({
    service,
    mutable,
    path = '*',
    method = '*',
    input,
    documentationService,
    readOnly = false,
    allowReadOnlyToggle = false,
}: EngineFixture & {
    path?: string;
    method?: string;
    input?: Record<string, unknown>;
    documentationService?: DocumentationService;
    readOnly?: boolean;
    allowReadOnlyToggle?: boolean;
}): ReactElement {
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState('loading');
    const [viewerReadOnly, setViewerReadOnly] = useState(readOnly);

    useEffect(() => {
        let current = true;
        setResult('loading');
        mutable.execute(method, input).then(
            (value) => {
                if (current) setResult(JSON.stringify(value));
            },
            (error: unknown) => {
                if (current) setResult(`error: ${errorText(error)}`);
            },
        );
        return () => {
            current = false;
        };
    }, [mutable, method, input, revision]);

    return (
        <Box w="fit-content">
            {allowReadOnlyToggle && (
                <button
                    type="button"
                    data-testid="toggle-read-only"
                    onClick={() => setViewerReadOnly((current) => !current)}
                >
                    {viewerReadOnly ? 'Resume editing' : 'Reviewer mode'}
                </button>
            )}
            <BoxedEditor
                service={service}
                path={path}
                languageService={MutableDecisionService}
                documentationService={documentationService}
                readOnly={viewerReadOnly}
                onChange={() => setRevision((current) => current + 1)}
            />
            <Text size="xs" data-testid="live-result" mt="xs">
                {result}
            </Text>
            <Text size="xs" data-testid="live-model">
                {JSON.stringify(service.toPortable())}
            </Text>
            <Text size="xs" data-testid="boxed-change-count">
                Changes: {revision}
            </Text>
        </Box>
    );
}

async function buildExecutingService(code: string, withSolver = false): Promise<ExecutingFixture> {
    const fixture = await buildServiceWithMutable(code);
    if (withSolver) await registerHighsSolver(fixture.mutable);
    return fixture;
}

const MODEL_SUBJECT: TestSubject = {id: '*', kind: 'model', name: 'Model'};

/**
 * Wires a `TestCasesService` + `TestRunner` exactly as a host would — `testRunner` memoized on
 * `[mutable, testCasesService, subject, revision]` and `revision` bumped from `onChange`, so
 * editing any row re-runs the *selected* case (debounced ~300 ms); the other case goes stale
 * (shown italic) until navigated to, per Resolved Decision — Open Question #2, Option 1.
 */
function TestCasesAndTestRunnerHarness({
    service,
    mutable,
    testCasesService,
    path,
}: {
    service: BoxedEditorService;
    mutable: ProjectEngine;
    testCasesService: TestCasesService;
    path: string;
}): ReactElement {
    const [revision, setRevision] = useState(0);
    const testRunner = useMemo(
        () =>
            createTestRunner(mutable, testCasesService, MODEL_SUBJECT, {
                modelRevision: String(revision),
            }),
        [mutable, testCasesService, revision],
    );

    // Seeds the test cases the first time this story mounts, into the story's fresh project session.
    useEffect(() => {
        if (testCasesService.listTestCases().length > 0) return;
        testCasesService.syncRows([
            {path: 'application.loanAmount', section: 'inputs', order: 0, type: 'number', present: true},
            {path: 'application.propertyValue', section: 'inputs', order: 1, type: 'number', present: true},
            {
                path: 'application.applicationDate',
                section: 'inputs',
                order: 2,
                type: 'date',
                present: true,
            },
        ]);
        const small = testCasesService.addTestCase('Small loan');
        testCasesService.setCell(small.id, 'application.loanAmount', 'input', '80000');
        testCasesService.setCell(small.id, 'application.propertyValue', 'input', '100000');
        testCasesService.setCell(small.id, 'application.applicationDate', 'input', '"2024-01-01"');
        const large = testCasesService.addTestCase('Large loan');
        testCasesService.setCell(large.id, 'application.loanAmount', 'input', '250000');
        testCasesService.setCell(large.id, 'application.propertyValue', 'input', '320000');
        testCasesService.setCell(large.id, 'application.applicationDate', 'input', '"2024-06-15"');
        // Unparseable for a `number` row — a real `CellParseError`, caught before `execute()` is even
        // called, surfaces as a run-level failure (header chip, every cell blank), never a per-row one.
        const invalid = testCasesService.addTestCase('Invalid input');
        testCasesService.setCell(invalid.id, 'application.loanAmount', 'input', 'not-a-number');
        testCasesService.setCell(invalid.id, 'application.propertyValue', 'input', '320000');
        testCasesService.setCell(invalid.id, 'application.applicationDate', 'input', '"2024-06-15"');
    }, [testCasesService]);

    return (
        <BoxedEditor
            service={service}
            path={path}
            languageService={MutableDecisionService}
            testCasesService={testCasesService}
            testRunner={testRunner}
            testSubjectId="*"
            revision={revision}
            onChange={() => setRevision((current) => current + 1)}
        />
    );
}

const meta: Meta<typeof BoxedEditor> = {
    title: 'Components/Boxed Editor',
    component: BoxedEditor,
    parameters: {
        docs: {
            description: {
                component:
                    'Structured authoring surface for EdgeRules models: a single flat treegrid of rows ' +
                    'over a `BoxedEditorService` facade, backed by the real `@edgerules/web`/`@edgerules/node` ' +
                    'engine — no rule-evaluation logic of its own. Click a `field` row’s value to swap in a ' +
                    'model-scoped CodeMirror editor (Enter/blur commits, Escape reverts, `onChange` fires ' +
                    'once per successful commit); every appendable container renders a trailing "(new …)" ' +
                    'placeholder to append without opening a menu; a row’s three-dots menu adds the rest ' +
                    '(rename, duplicate, delete, and construct-specific actions for `function`/`ruleset`/' +
                    '`optimise`).',
            },
        },
    },
};
export default meta;
type Story = StoryObj<typeof BoxedEditor>;

export const BlankModel: Story = {
    loaders: [async () => buildExecutingService('{}')],
    render: (_args, {loaded}) => (
        <ExecutingHarness service={loaded.service} mutable={loaded.mutable} allowReadOnlyToggle />
    ),
};

export const ReadOnly: Story = {
    loaders: [async () => ({service: await buildService(LOAN_ORIGINATION_MODEL)})],
    render: (args, {loaded}) => (
        <BoxedEditor {...args} service={loaded.service} path="*" languageService={MutableDecisionService} readOnly />
    ),
};

export const TestCasesAndTestRunner: Story = {
    parameters: {
        docs: {
            description: {
                story:
                    'A `TestCasesService` + `TestRunner` wired exactly as a host would, with three seeded ' +
                    'cases. Show the test column with the flask toggle in the header — the first case runs at once. ' +
                    "Edit `application.loanAmount`'s value cell (click, retype, Enter) to watch the " +
                    "*selected* case's `payment` re-run (debounced ~300 ms) — switch cases with the " +
                    "header's ‹ › and the one you leave goes stale (italic) until you navigate back to it, " +
                    'at which point it re-runs immediately. "Invalid input" carries an unparseable ' +
                    "`loanAmount` cell — navigate to it to see the run-level failure: the header's error " +
                    'icon and every result cell blank, never a per-row error.',
            },
        },
    },
    loaders: [async () => buildServiceWithMutable(LOAN_ORIGINATION_MODEL)],
    render: (_args, {loaded}) => (
        <TestCasesAndTestRunnerHarness
            service={loaded.service}
            mutable={loaded.mutable}
            testCasesService={loaded.session.tests.forSubject('*')}
            path="*"
        />
    ),
};

// --- Full model: every row kind, with a DocumentationService overlay ---

const FULL_MODEL = `{
  type Applicant: {
    name: <string, required: true>
    surname: <string, required: true>
  }
  application: {
    applicationDate: <date, required: true>
    applicants: <Applicant[], required: true>
    propertyValue: <number, required: true>
  }
  reviewStages: ["Application", "Underwriting", "Credit review", "Closing"]
  offices: [
    { id: 1, address: { city: "Vilnius", zip: "01001" } }
    { id: 2, address: { city: "Kaunas", zip: "44001" } }
  ]
  func monthly(amount: number): amount / 12
  func compute(x: number): { doubled: x * 2; total: doubled + 1 }
  func answer(): 42
  group: {
    func nested(x: number): x + 1
  }
  ruleset risk(age: number, income: number): {
    hitPolicy: "first-match"
    rules: [
      { when: { age: 18..25, income: < 30000 }, then: { level: "high", limit: 1000 } }
      { when: age >= 26 and age <= 64, then: { level: "medium", limit: 5000 } }
    ]
    default: { level: "none", limit: 0 }
  }
  optimise factoryProduction(workers: number, sticks: number, plates: number): {
    bottlenecks: true
    variables: {
      chairs: <number, integer: true, min: 0>
      tables: <number, integer: true, min: 0>
    }
    maximise: 15 * chairs + 40 * tables
    constraints: {
      workerCapacity: 1 * chairs + 3 * tables <= workers
      stickSupply: 4 * chairs + 4 * tables <= sticks
      plateSupply: 1 * chairs + 2 * tables <= plates
    }
    timeLimit: 1000
  }
  plan: factoryProduction(workers: 8, sticks: 40, plates: 12)
}`;

export const FullModel: Story = {
    parameters: {
        docs: {
            description: {
                story:
                    'Every `BoxedRowKind` in one model: a reusable `complexType`, a `list`, a `relation`, ' +
                    'four `func` shapes — `monthly` (a single inline expression: a synthesized, non-draggable ' +
                    '`result` row), `compute` (a multi-statement body: ordinary field rows), `answer` (no ' +
                    'arguments) and `group.nested` (nested in a context) — a `ruleset` with both rule-condition ' +
                    'forms, its hit policy and its pinned default, and an `optimise` solved by highs-js — plus a ' +
                    '`DocumentationService` overlay with three rows pre-seeded. Hover the Description column, or ' +
                    "hold **Alt** to reveal every type at once. A rule's three-dots menu adds, duplicates and " +
                    'removes rows and columns.',
            },
        },
    },
    loaders: [
        async () => {
            const fixture = await buildExecutingService(FULL_MODEL, true);
            const documentationService = fixture.session.documentation;
            documentationService.setDescription('application', 'Current loan application');
            documentationService.setDescription('reviewStages', 'Ordered application workflow');
            documentationService.setDescription('risk', 'Credit risk tiering');
            return {...fixture, documentationService};
        },
    ],
    render: (_args, {loaded}) => (
        <ExecutingHarness
            service={loaded.service}
            mutable={loaded.mutable}
            documentationService={loaded.documentationService}
        />
    ),
};

// --- ruleset-bearing model: inline rule CRUD ---

// --- optimisation-bearing model: inline variable/objective/constraint CRUD ---
