import {validateInputMembers} from '../../core/paths';
import {fail} from '../../core/toolResult';
import type {UndoResult} from '../../project/changes/agentActivityLog';
import {changeResultProperties, changeResultRequired, inputSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export type {UndoResult};

export interface UndoAgentChangeInput {
    changeId: string;
}

export const undoAgentChange: ProjectTool<UndoAgentChangeInput, UndoResult> = {
    name: 'undo-agent-change',
    title: 'Undo agent change',
    description:
        'Reverts one change that a tool of this page made, with its changeId, by its inverse operations. The undo is ' +
        'a new change: it has its own changeId, and the result reports link errors and the regression like ' +
        'edit-model. It fails when the user or another agent change edited a target of that change later.',
    inputSchema: inputSchema(
        {changeId: {type: 'string', description: "The changeId of a change result, e.g. 'ac-3'."}},
        ['changeId'],
    ),
    outputSchema: resultSchema({...changeResultProperties, reverted: {type: 'string'}}, [
        ...changeResultRequired,
        'reverted',
    ]),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: false},
    availability: 'write',

    async run(input, context, signal) {
        const invalid = validateInputMembers(input, ['changeId']);
        if (invalid) return {ok: false, error: invalid};
        if (typeof input.changeId !== 'string' || input.changeId === '') {
            return fail('InvalidInput', "'changeId' must be the changeId of a change result, e.g. 'ac-3'.");
        }
        return context.changes.undo(input.changeId, signal);
    },
};
