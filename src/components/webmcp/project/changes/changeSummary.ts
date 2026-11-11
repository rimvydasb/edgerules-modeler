import {clipText} from '../../core/toolResult';

const MAX_SUMMARY = 200;

/** The summary of one agent change from the summaries of its operations: "Set risk.score, renamed limit to x". */
export function changeSummary(operationSummaries: readonly string[]): string {
    const text = operationSummaries.join(', ');
    return clipText(text.charAt(0).toUpperCase() + text.slice(1), MAX_SUMMARY);
}

/** The summary of an undo: "Undid ac-3: set risk.score". */
export function undoSummary(changeId: string, summary: string): string {
    return clipText(`Undid ${changeId}: ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`, MAX_SUMMARY);
}
