import type {SourcePath, ToolError} from '../../../core/toolResult';

/**
 * One operation as it was applied inside a change transaction, with what its undo needs. The appliers create it;
 * `ProjectChangeService` sets `stateAfter` again when the transaction commits, so a later operation of the same batch
 * on the same target does not make the undo check fail.
 */
export interface AppliedOperation {
    target: SourcePath; // the undo target; a test case as `<subject>#<caseId>`
    stateAfter: unknown; // the target state that a later undo compares with
    readState(): unknown; // the current state of the target, in the form of `stateAfter`
    inverse: () => AppliedOperation; // applies the inverse operation and returns its own record
    changed: SourcePath[]; // the target, and the paths that a rename rewrote
    summary: string; // for example "set risk.score" or "renamed limit to maxLimit"
}

/** One applier for each operation family. It runs inside the change transaction and throws to roll it back. */
export interface OperationApplier<Op> {
    apply(operation: Op): AppliedOperation;
}

/** Thrown by an applier to roll back the transaction with this error. The caller adds the operation index. */
export class OperationFailure extends Error {
    constructor(readonly error: ToolError) {
        super(error.message);
        this.name = 'OperationFailure';
    }
}

/** Target states are plain JSON values or `null` for an absent target. */
export function sameState(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
