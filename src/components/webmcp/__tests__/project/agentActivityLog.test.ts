import {describe, expect, it, vi} from 'vitest';
import {ok} from '../../core/toolResult';
import {createAgentActivityLog, MAX_AGENT_CHANGES} from '../../project/changes/agentActivityLog';
import type {AppliedOperation} from '../../project/changes/operations/appliedOperation';

// An operation on an in-memory value: its target state is `state.value`.
function operation(state: {value: number}, target = 'x'): AppliedOperation {
    return {
        target,
        stateAfter: state.value,
        readState: () => state.value,
        inverse: () => operation(state, target),
        changed: [target],
        summary: `set ${target}`,
    };
}

const REGRESSION = {
    status: 'complete' as const,
    passed: 1,
    failed: 0,
    newlyFailing: [],
    stillFailing: [],
    newlyPassing: [],
    truncated: false,
};

describe('AgentActivityLog', () => {
    it('lists the newest change first and keeps at most 50 changes', () => {
        const log = createAgentActivityLog(vi.fn());
        const state = {value: 0};
        for (let n = 0; n < MAX_AGENT_CHANGES + 2; n += 1) log.record('edit-model', `Change ${n}`, [operation(state)]);
        expect(log.list()).toHaveLength(50);
        expect(log.list()[0].changeId).toBe('ac-52');
        expect(log.list().at(-1)?.changeId).toBe('ac-3');
        expect(log.canUndo('ac-1')).toBe(false);
    });

    it('checks only the undo targets, and blocks the undo with the conflicting targets', async () => {
        const revert = vi.fn(async () =>
            ok({version: 1, changeId: 'ac-2', changed: [], regression: REGRESSION, reverted: 'ac-1'}),
        );
        const log = createAgentActivityLog(revert);
        const x = {value: 1};
        const y = {value: 2};
        const change = log.record('edit-model', 'Set x, set y', [operation(x, 'x'), operation(y, 'y')]);
        expect(change.targets).toEqual(['x', 'y']);

        y.value = 3;
        expect(log.canUndo(change.changeId)).toBe(false);
        expect(await log.undo(change.changeId)).toEqual({
            ok: false,
            error: expect.objectContaining({code: 'UndoBlocked', conflicts: ['y']}),
        });
        expect(revert).not.toHaveBeenCalled();

        y.value = 2;
        expect((await log.undo(change.changeId)).ok).toBe(true);
        expect(revert).toHaveBeenCalledOnce();
    });

    it('notifies subscribers and stores the regression totals of a change', () => {
        const log = createAgentActivityLog(vi.fn());
        const listener = vi.fn();
        const unsubscribe = log.subscribe(listener);
        const change = log.record('set-documentation', 'Documented x', [operation({value: 0})]);
        log.setRegression(change.changeId, {...REGRESSION, failed: 2});
        expect(listener).toHaveBeenCalledTimes(2);
        expect(log.list()[0].regression).toEqual({passed: 1, failed: 2, newlyFailing: 0});
        unsubscribe();
        log.record('edit-model', 'Set x', [operation({value: 0})]);
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
