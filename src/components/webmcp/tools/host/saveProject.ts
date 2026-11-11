import {validateInputMembers} from '../../core/paths';
import {fail} from '../../core/toolResult';
import type {SaveResultView} from '../../project/projectHostActions';
import {baseVersionSchema, inputSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateBaseVersion} from '../change/changeInput';

export type {SaveResultView};

export interface SaveProjectInput {
    baseVersion?: number;
}

export const saveProject: ProjectTool<SaveProjectInput, SaveResultView> = {
    name: 'save-project',
    title: 'Save project',
    description:
        'Saves the open project as a new revision in the workspace of the user. Changes stay only in this page ' +
        'until a save. Use it when the user asks to save.',
    inputSchema: inputSchema({baseVersion: baseVersionSchema}),
    outputSchema: resultSchema({revision: {type: 'string'}, savedAt: {type: 'string'}}, ['revision', 'savedAt']),
    annotations: {readOnlyHint: false, untrustedContentHint: false, consequentialHint: true},
    availability: 'save',

    async run(input, context, signal) {
        const invalid = validateInputMembers(input, ['baseVersion']) ?? validateBaseVersion(input.baseVersion);
        if (invalid) return {ok: false, error: invalid};
        const save = context.host.save;
        if (!save) return fail('InvalidInput', 'Saving is off in this page.', {hint: 'Ask the user to save.'});
        // The save is the commit point: an abort after it does not stop the write.
        signal.throwIfAborted();
        return save(input.baseVersion);
    },
};
