import type {Unsubscribe} from '#lib/changeBatch';
import {fail, type SourcePath, type ToolResult} from '../../core/toolResult';
import type {RegressionReport} from '../regression/regressionReport';
import {sameState, type AppliedOperation} from './operations/appliedOperation';

export type AgentChangeTool = 'edit-model' | 'edit-tests' | 'set-documentation' | 'undo-agent-change';

/** One change that a tool made, as the Shell lists it. */
export interface AgentChange {
    changeId: string; // `ac-<n>`, unique within the log
    tool: AgentChangeTool;
    summary: string; // for example "Set risk.score, renamed limit to maxLimit"
    targets: SourcePath[]; // the undo targets; a test case as `<subject>#<caseId>`
    at: number; // epoch ms
    reverts?: string; // the `changeId` that this undo reverted
    regression?: {passed: number; failed: number; newlyFailing: number}; // the totals of its regression run
}

/** The result of `undo-agent-change`: a change of its own. */
export interface UndoResult {
    version: number; // `localVersion` after the undo
    changeId: string; // the id of the undo
    changed: SourcePath[];
    regression: RegressionReport;
    reverted: string; // the `changeId` of the reverted change
}

/** The agent changes of the open project, newest first, and their undo. */
export interface AgentActivityLog {
    list(): readonly AgentChange[]; // newest first; at most 50 changes
    canUndo(changeId: string): boolean; // every undo target matches its recorded state
    undo(changeId: string, signal?: AbortSignal): Promise<ToolResult<UndoResult>>; // the logic of `undo-agent-change`
    subscribe(listener: () => void): Unsubscribe;
}

/** A recorded change with the applied operations that its undo replays. */
export interface RecordedChange {
    change: AgentChange;
    operations: readonly AppliedOperation[];
}

/** The side of the log that `ProjectChangeService` uses. */
export interface AgentActivityRecorder extends AgentActivityLog {
    record(
        tool: AgentChangeTool,
        summary: string,
        operations: readonly AppliedOperation[],
        reverts?: string,
    ): AgentChange;
    setRegression(changeId: string, regression: RegressionReport): void;
}

export const MAX_AGENT_CHANGES = 50;

/**
 * `revert` replays the inverse operations of a change whose targets all match; it is the transaction of
 * `ProjectChangeService`, which owns every write.
 */
export function createAgentActivityLog(
    revert: (recorded: RecordedChange, signal: AbortSignal) => Promise<ToolResult<UndoResult>>,
): AgentActivityRecorder {
    let changes: RecordedChange[] = []; // newest first
    let list: readonly AgentChange[] = [];
    let counter = 0;
    const listeners = new Set<() => void>();

    function publish(next: RecordedChange[]): void {
        changes = next;
        list = Object.freeze(changes.map((recorded) => recorded.change));
        for (const listener of [...listeners]) listener();
    }

    function conflictsOf(recorded: RecordedChange): SourcePath[] {
        const conflicts = recorded.operations
            .filter((operation) => !sameState(operation.readState(), operation.stateAfter))
            .map((operation) => operation.target);
        return [...new Set(conflicts)];
    }

    const find = (changeId: string) => changes.find((recorded) => recorded.change.changeId === changeId);

    return {
        list: () => list,

        canUndo(changeId) {
            const recorded = find(changeId);
            return recorded !== undefined && conflictsOf(recorded).length === 0;
        },

        async undo(changeId, signal = new AbortController().signal) {
            const recorded = find(changeId);
            if (!recorded) {
                return fail('NotFound', `No agent change '${changeId}' in the activity log.`, {
                    hint: `The log keeps the last ${MAX_AGENT_CHANGES} changes; each change result has its changeId.`,
                });
            }
            const conflicts = conflictsOf(recorded);
            if (conflicts.length > 0) {
                return fail(
                    'UndoBlocked',
                    `A target of '${changeId}' changed after it; the undo would lose that edit.`,
                    {
                        conflicts,
                        hint: 'Read the conflicting entries and change them with edit-model or edit-tests instead.',
                    },
                );
            }
            return revert(recorded, signal);
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        record(tool, summary, operations, reverts) {
            counter += 1;
            const change: AgentChange = {
                changeId: `ac-${counter}`,
                tool,
                summary,
                targets: [...new Set(operations.map((operation) => operation.target))],
                at: Date.now(),
                ...(reverts !== undefined && {reverts}),
            };
            publish([{change, operations}, ...changes].slice(0, MAX_AGENT_CHANGES));
            return change;
        },

        setRegression(changeId, regression) {
            const totals = {
                passed: regression.passed,
                failed: regression.failed,
                newlyFailing: regression.newlyFailing.length,
            };
            publish(
                changes.map((recorded) =>
                    recorded.change.changeId === changeId
                        ? {...recorded, change: {...recorded.change, regression: totals}}
                        : recorded,
                ),
            );
        },
    };
}
