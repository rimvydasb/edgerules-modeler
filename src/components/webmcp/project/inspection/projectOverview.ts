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
    version: number; // `ProjectSessionSnapshot.localVersion`
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
    };
}
