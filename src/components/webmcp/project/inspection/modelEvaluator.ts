import {isPortableError} from '#lib/portable';
import type {ProjectSession} from '../../../project-session';
import type {ModelPath} from '../../core/paths';
import {fail, messageOf, ok, type ToolResult} from '../../core/toolResult';
import {toToolError} from '../../core/portableErrors';

export const RESULT_BUDGET = 6_000;

export interface EvaluateModelInput {
    target: ModelPath; // '*' evaluates the whole model
    input?: Record<string, unknown>; // the parameters of a callable, or the placeholder values of the model
}

export interface EvaluationResult {
    result: unknown; // the value of `engine.execute(target, input)`
    truncated: boolean; // the JSON of `result` exceeded 6,000 characters and was trimmed
}

/** Runs `target` with `input`. Nothing in the project changes. */
export async function evaluateModel(
    session: ProjectSession,
    input: EvaluateModelInput,
    signal: AbortSignal,
): Promise<ToolResult<EvaluationResult>> {
    const {engine} = session;
    if (engine.requiresSolver() && engine.solverHandler === undefined) {
        return fail('SolverRequired', `'${input.target}' calls an external function that has no resolver.`, {
            path: input.target,
            hint: 'The host has to register a solver before the model can run.',
        });
    }
    signal.throwIfAborted();
    let result: unknown;
    try {
        result = await engine.execute(input.target, input.input);
    } catch (thrown) {
        if (isPortableError(thrown)) return {ok: false, error: toToolError(thrown, {path: input.target})};
        return fail('ExecutionError', messageOf(thrown), {path: input.target});
    }
    if (isPortableError(result)) return {ok: false, error: toToolError(result, {path: input.target})};
    const json = JSON.stringify(result) ?? 'null';
    if (json.length <= RESULT_BUDGET) return ok({result, truncated: false});
    return ok({result: json.slice(0, RESULT_BUDGET), truncated: true});
}
