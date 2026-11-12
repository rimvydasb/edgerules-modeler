import type {ProjectSession} from '../../../project-session';
import {ok, type SourcePath, type ToolResult} from '../../core/toolResult';
import type {RegressionMonitor} from '../regression/regressionMonitor';
import {evaluateModel, type EvaluateModelInput, type EvaluationResult} from './modelEvaluator';
import {listModelEntries, type ListModelEntriesInput, type ModelEntriesPage} from './modelOutline';
import {searchModel, type SearchModelInput, type SearchResult} from './modelSearch';
import {projectOverview, type InspectionHostState, type ProjectOverview} from './projectOverview';
import {readSource, readSources, type SourceBatch, type SourcePage} from './sourceReader';
import {testSuiteView, type ListTestsInput, type TestSuiteView} from './testSuiteView';

/** Read-only use cases over the open project. */
export interface ProjectInspector {
    overview(): ProjectOverview;
    outline(input: ListModelEntriesInput): ToolResult<ModelEntriesPage>;
    source(input: {path: SourcePath; offset?: number}): ToolResult<SourcePage>;
    sources(input: {paths: SourcePath[]; offsets?: Record<SourcePath, number>}): ToolResult<SourceBatch>;
    search(input: SearchModelInput): ToolResult<SearchResult>;
    testSuite(input: ListTestsInput): ToolResult<TestSuiteView>;
    evaluate(input: EvaluateModelInput, signal: AbortSignal): Promise<ToolResult<EvaluationResult>>;
}

export type {InspectionHostState};

/** `host` is read at each call: the options of `registerProjectTools` can change after it. */
export function createProjectInspector(
    session: ProjectSession,
    regression: RegressionMonitor,
    host: () => InspectionHostState,
): ProjectInspector {
    return {
        overview: () => projectOverview(session, regression, host()),
        outline: (input) => listModelEntries(session, input),
        source: (input) => readSource(session, input),
        sources: (input) => ok(readSources(session, input)),
        search: (input) => searchModel(session, input),
        testSuite: (input) => testSuiteView(session, input),
        evaluate: (input, signal) => evaluateModel(session, input, signal),
    };
}
