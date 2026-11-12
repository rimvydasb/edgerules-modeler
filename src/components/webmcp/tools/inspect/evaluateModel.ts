import {validateInputMembers, validateModelPath} from '../../core/paths';
import {fail} from '../../core/toolResult';
import type {EvaluateModelInput, EvaluationResult} from '../../project/inspection/modelEvaluator';
import {inputSchema, modelPathSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';

export const evaluateModel: ProjectTool<EvaluateModelInput, EvaluationResult> = {
    name: 'evaluate-model',
    title: 'Evaluate model',
    description:
        'Runs the whole model, or one function, decision or service, with an input object and returns the result ' +
        'value. Nothing in the project changes. Use it to probe an assumption with one concrete case.',
    summary: 'Run the model or one callable with an input',
    inputSchema: inputSchema(
        {
            target: {...modelPathSchema, description: "'*' evaluates the whole model; otherwise a callable path."},
            input: {type: 'object', description: 'The parameters of a callable, or placeholder values of the model.'},
        },
        ['target'],
    ),
    outputSchema: resultSchema({result: {}, truncated: {type: 'boolean'}}, ['result', 'truncated']),
    annotations: {readOnlyHint: true, untrustedContentHint: false, consequentialHint: false},
    availability: 'always',

    async run(input, context, signal) {
        const invalid = validateInputMembers(input, ['target', 'input']) ?? validateModelPath(input.target, 'target');
        if (invalid) return {ok: false, error: invalid};
        const {input: values} = input;
        if (values !== undefined && (typeof values !== 'object' || values === null || Array.isArray(values))) {
            return fail('InvalidInput', "'input' must be a JSON object.");
        }
        return context.inspector.evaluate(input, signal);
    },
};
