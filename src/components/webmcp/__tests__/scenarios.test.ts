import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {ToolResult} from '../core/toolResult';
import {openToolsFixture} from '../testing/toolsFixture';
import {SCENARIOS} from './scenarios';

interface ReportedCase {
    name: string;
}
interface ReportedRegression {
    passed: number;
    failed: number;
    newlyFailing: ReportedCase[];
    newlyPassing: ReportedCase[];
}

describe('change-and-react scenarios', () => {
    it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        const {call} = await openToolsFixture(scenario.project);
        const results: ToolResult<unknown>[] = [];

        for (const [index, step] of scenario.steps.entries()) {
            const input = typeof step.input === 'function' ? step.input(results) : step.input;
            const result = await call(step.tool, input);
            results.push(result);
            const where = `step ${index + 1} (${step.note})`;

            if (!step.expect.ok) {
                expect(result.ok, where).toBe(false);
                if (result.ok) continue;
                expect(result.error.code, where).toBe(step.expect.code);
                if (step.expect.diagnostics !== undefined) {
                    expect(result.error.diagnostics, where).toHaveLength(step.expect.diagnostics);
                }
                continue;
            }

            expect(result.ok, `${where}: ${result.ok ? '' : result.error.message}`).toBe(true);
            if (!result.ok) continue;
            const reported = result as unknown as {regression: ReportedRegression; changed?: string[]};
            const {regression} = reported;
            expect(
                {
                    passed: regression.passed,
                    failed: regression.failed,
                    newlyFailing: regression.newlyFailing.map((c) => c.name),
                    newlyPassing: regression.newlyPassing.map((c) => c.name),
                },
                where,
            ).toEqual(step.expect.regression);
            if (step.expect.changed) expect(reported.changed, where).toEqual(step.expect.changed);
        }
    });
});
