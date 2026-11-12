import type {ProjectSession, ProjectSessionPhase, ProjectSlice} from '../../../project-session';
import type {ModelSection} from '../../core/paths';
import type {SourcePath} from '../../core/toolResult';
import type {RegressionMonitor} from '../regression/regressionMonitor';
import {buildOutline, MODEL_SECTIONS} from './modelOutline';

/** A Shell view; the same values as `ProjectToolsView`. */
export type OverviewView = 'code' | 'boxed' | 'flow' | 'tests' | 'preview';

/** What the host knows and the session does not: the options of `registerProjectTools`. */
export interface InspectionHostState {
    readOnly: boolean;
    canSave: boolean; // `save-project` is registered
    focus?: {path: SourcePath; view: OverviewView}; // only with `navigation`
    tools?: Record<string, string>; // the summary of each registered tool by name, in catalog order
}

export interface ProjectOverview {
    project: {name: string; description?: string; origin?: string}; // `origin` as `<id>@<version>`
    model: {name?: string; version?: string};
    version: number; // `ProjectSessionSnapshot.localVersion`: a token to pass back as `baseVersion`
    phase: ProjectSessionPhase;
    unsavedSlices: ProjectSlice[]; // empty when everything is saved
    savedAt?: string; // ISO time of the last save
    dslValid: boolean; // false when the last `commitDsl` failed
    dslError?: string;
    draftPending: boolean; // the user has uncommitted DSL in the Code view; writes still apply
    counts: Record<ModelSection, number> & {testSubjects: number; testCases: number};
    tests: {passed: number; failed: number; ranAt?: number}; // the last regression run
    focus?: {path: SourcePath; view: OverviewView};
    readOnly: boolean;
    canSave: boolean;
    tools?: Record<string, string>; // the tool index: what each tool of this page does, in one line
    workflow: string[]; // how the registered tools work together, one short line each
}

// Each line names the tools it needs; a line shows only when all of them are registered.
const WORKFLOW: readonly {tools: readonly string[]; line: string}[] = [
    {tools: ['run-tests'], line: 'Verify: run-tests runs every test now; the tests totals above are the last run.'},
    {
        tools: ['search-model', 'read-source'],
        line: 'Find: search-model for each place that uses a name, then read-source with paths for several entries.',
    },
    {
        tools: ['edit-model', 'edit-tests'],
        line: 'Change: edit-model or edit-tests run every test; add dryRun: true to see the result with no change.',
    },
    {tools: ['evaluate-model'], line: 'Probe: evaluate-model runs a workbook, decision or function with an input.'},
    {
        tools: [],
        line: 'version counts every change of any slice, so it can jump by many. Use it only as baseVersion.',
    },
];

/** The workflow lines of the registered tools; every line when the host gives no tool index. */
export function workflowOf(tools: Record<string, string> | undefined): string[] {
    return WORKFLOW.filter((step) => tools === undefined || step.tools.every((name) => name in tools)).map(
        (step) => step.line,
    );
}

export function projectOverview(
    session: ProjectSession,
    regression: RegressionMonitor,
    host: InspectionHostState,
): ProjectOverview {
    const snapshot = session.getSnapshot();
    const {metadata} = session.getSlice('model');
    const outline = buildOutline(session);
    const counts = Object.fromEntries(MODEL_SECTIONS.map((section) => [section, 0])) as Record<ModelSection, number>;
    if (Array.isArray(outline)) for (const entry of outline) counts[entry.section] += 1;
    const subjects = Object.values(session.tests.exportDocument().subjects);
    return {
        project: {
            name: snapshot.name,
            ...(snapshot.origin && {origin: `${snapshot.origin.id}@${snapshot.origin.version}`}),
        },
        model: {...(metadata.name && {name: metadata.name}), ...(metadata.version && {version: metadata.version})},
        version: snapshot.localVersion,
        phase: snapshot.phase,
        unsavedSlices: [...snapshot.dirtySlices],
        ...(snapshot.savedAt !== undefined && {savedAt: snapshot.savedAt}),
        dslValid: snapshot.dslValidity.status === 'valid',
        ...(snapshot.dslValidity.status === 'invalid' && {dslError: snapshot.dslValidity.message}),
        draftPending: snapshot.hasDslDraft,
        counts: {
            ...counts,
            testSubjects: subjects.filter((suite) => suite.cases.length > 0).length,
            testCases: subjects.reduce((total, suite) => total + suite.cases.length, 0),
        },
        tests: regression.lastTotals(),
        ...(host.focus && {focus: host.focus}),
        readOnly: host.readOnly,
        canSave: host.canSave,
        ...(host.tools && {tools: host.tools}),
        workflow: workflowOf(host.tools),
    };
}
