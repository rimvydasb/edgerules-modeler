import {listCallables} from '#lib/callables';
import type {ProjectSession} from '../../../project-session';
import {deriveRows} from '../../../tests-manager/internal';
import {README_PATH, type ModelPath, type TestSubject} from '../../core/paths';
import {toToolError} from '../../core/portableErrors';
import {fail, ok, type SourcePath, type ToolError, type ToolResult} from '../../core/toolResult';
import type {RegressionMonitor} from '../regression/regressionMonitor';
import type {RegressionReport} from '../regression/regressionReport';
import {
    createAgentActivityLog,
    type AgentActivityLog,
    type AgentChangeTool,
    type RecordedChange,
    type UndoResult,
} from './agentActivityLog';
import {changeSummary, undoSummary} from './changeSummary';
import {OperationFailure, type AppliedOperation} from './operations/appliedOperation';
import {createDocumentationOperations, type DocumentationItem} from './operations/documentationOperations';
import {createModelOperations, type ModelOperation} from './operations/modelOperations';
import {createTestOperations, type TestOperation} from './operations/testOperations';

export interface EditModelInput {
    operations: ModelOperation[];
    baseVersion?: number; // `version` from a previous result; omit to apply on the current state
}

export interface ChangeResult {
    version: number; // `localVersion` after the change and its regression run
    changeId: string;
    changed: ModelPath[]; // the target paths, and each path whose references a rename rewrote
    regression: RegressionReport;
}

export interface EditTestsInput {
    subject: TestSubject;
    operations: TestOperation[];
    baseVersion?: number;
}

export interface TestsChangeResult extends ChangeResult {
    addedCaseIds: string[]; // in the order of the `add` operations
}

export interface SetDocumentationInput {
    items: DocumentationItem[]; // 'doc:README.md' sets the README; it MUST NOT be empty
    baseVersion?: number;
}

export interface DocumentationChangeResult {
    version: number;
    changeId: string;
}

/**
 * The only write path of the tools: checks the version, applies the operations in one session transaction, records
 * the inverse operations in the activity log and runs the regression. Expects input whose shape the tool validated.
 */
export interface ProjectChangeService {
    editModel(input: EditModelInput, signal: AbortSignal): Promise<ToolResult<ChangeResult>>;
    editTests(input: EditTestsInput, signal: AbortSignal): Promise<ToolResult<TestsChangeResult>>;
    setDocumentation(input: SetDocumentationInput): ToolResult<DocumentationChangeResult>;
    undo(changeId: string, signal: AbortSignal): Promise<ToolResult<UndoResult>>;
    readonly activity: AgentActivityLog;
}

interface Applied {
    change: RecordedChange['change'];
    operations: AppliedOperation[];
}

function unique(paths: readonly SourcePath[]): SourcePath[] {
    return [...new Set(paths)];
}

export function createProjectChangeService(
    session: ProjectSession,
    regression: RegressionMonitor,
): ProjectChangeService {
    const log = createAgentActivityLog(revert);

    const localVersion = () => session.getSnapshot().localVersion;

    function versionConflict(baseVersion: number | undefined): ToolResult<never> | undefined {
        if (baseVersion === undefined || baseVersion === localVersion()) return undefined;
        return fail('VersionConflict', `The project changed after version ${baseVersion}.`, {
            currentVersion: localVersion(),
            hint: 'Read the entries you change again, then retry with the current version or without baseVersion.',
        });
    }

    /**
     * Runs `work` in one session transaction and records it as one agent change. `work` applies the operations and
     * pushes each record; an `OperationFailure` or an engine error rolls every slice back. With `link`, the model
     * MUST link at the end. Returns the error, or the recorded change.
     */
    function commit(
        tool: AgentChangeTool,
        work: (applied: AppliedOperation[]) => void,
        options: {link: boolean; summary?: (applied: AppliedOperation[]) => string; reverts?: string},
    ): {ok: false; error: ToolError} | {ok: true; applied: Applied} {
        const operations: AppliedOperation[] = [];
        let failure: ToolError | undefined;
        const result = session.transaction(() => {
            try {
                work(operations);
                if (options.link) session.engine.link();
            } catch (thrown) {
                failure = thrown instanceof OperationFailure ? thrown.error : toToolError(thrown, {phase: 'link'});
                throw thrown;
            }
        });
        if (!result.ok) {
            return {ok: false, error: failure ?? toToolError(result.error)};
        }
        // The undo compares with the state after the whole change, not after each operation.
        for (const operation of operations) operation.stateAfter = operation.readState();
        const summary = options.summary?.(operations) ?? changeSummary(operations.map((op) => op.summary));
        const change = log.record(tool, summary, operations, options.reverts);
        return {ok: true, applied: {change, operations}};
    }

    // Applies each operation with its index, so a failure names the operation.
    function applyEach<Op>(operations: readonly Op[], apply: (operation: Op) => AppliedOperation) {
        return (applied: AppliedOperation[]) => {
            operations.forEach((operation, index) => {
                try {
                    applied.push(apply(operation));
                } catch (thrown) {
                    const error =
                        thrown instanceof OperationFailure ? thrown.error : toToolError(thrown, {phase: 'link'});
                    throw new OperationFailure({...error, operation: index});
                }
            });
        };
    }

    async function finish(applied: Applied, signal: AbortSignal): Promise<ChangeResult> {
        const report = await regression.runAll(signal);
        log.setRegression(applied.change.changeId, report);
        return {
            version: localVersion(),
            changeId: applied.change.changeId,
            changed: unique(applied.operations.flatMap((operation) => operation.changed)),
            regression: report,
        };
    }

    function subjectExists(subject: TestSubject): boolean {
        return subject === '*' || listCallables(session.engine).some((callable) => callable.path === subject);
    }

    async function revert(recorded: RecordedChange, signal: AbortSignal): Promise<ToolResult<UndoResult>> {
        signal.throwIfAborted();
        const {change, operations} = recorded;
        const committed = commit(
            'undo-agent-change',
            (applied) => {
                for (const operation of [...operations].reverse()) applied.push(operation.inverse());
            },
            {link: true, summary: () => undoSummary(change.changeId, change.summary), reverts: change.changeId},
        );
        if (!committed.ok) return {ok: false, error: committed.error};
        return ok({...(await finish(committed.applied, signal)), reverted: change.changeId});
    }

    return {
        activity: log,

        async editModel(input, signal) {
            const conflict = versionConflict(input.baseVersion);
            if (conflict) return conflict;
            signal.throwIfAborted();
            const model = createModelOperations(session);
            const committed = commit('edit-model', applyEach(input.operations, model.apply), {link: true});
            if (!committed.ok) return {ok: false, error: committed.error};
            return ok(await finish(committed.applied, signal));
        },

        async editTests(input, signal) {
            const conflict = versionConflict(input.baseVersion);
            if (conflict) return conflict;
            const {subject} = input;
            if (!subjectExists(subject)) {
                return fail('NotFound', `The model has no function '${subject}' to test.`, {
                    path: subject,
                    hint: 'Call list-tests to see the test subjects.',
                });
            }
            signal.throwIfAborted();
            const service = session.tests.forSubject(subject);
            const tests = createTestOperations(service, subject);
            const committed = commit(
                'edit-tests',
                (applied) => {
                    const kind =
                        subject === '*'
                            ? 'model'
                            : (listCallables(session.engine).find((c) => c.path === subject)?.kind ?? 'function');
                    service.syncRows(deriveRows(session.engine, {id: subject, kind, name: subject}));
                    applyEach(input.operations, tests.apply)(applied);
                },
                {link: false},
            );
            if (!committed.ok) return {ok: false, error: committed.error};
            const result = await finish(committed.applied, signal);
            return ok({...result, addedCaseIds: [...tests.addedCaseIds]});
        },

        setDocumentation(input) {
            const conflict = versionConflict(input.baseVersion);
            if (conflict) return conflict;
            const missing = input.items.findIndex(
                (item) => item.path !== README_PATH && typeof session.engine.getCode(item.path) !== 'string',
            );
            if (missing !== -1) {
                const path = input.items[missing].path;
                return fail('NotFound', `The model has no entry '${path}'.`, {
                    path,
                    operation: missing,
                    hint: 'Call list-model-entries to see the paths of the model.',
                });
            }
            const documentation = createDocumentationOperations(session);
            const committed = commit('set-documentation', applyEach(input.items, documentation.apply), {link: false});
            if (!committed.ok) return {ok: false, error: committed.error};
            return ok({version: localVersion(), changeId: committed.applied.change.changeId});
        },

        undo: (changeId, signal) => log.undo(changeId, signal),
    };
}
