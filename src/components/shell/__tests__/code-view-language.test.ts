import {MutableDecisionService} from '@edgerules/node/mutable';
import {describe, expect, it} from 'vitest';
import {factsCode, factsPath} from '#lib/factsPaths';
import type {CodeEditorService} from '../../code-editor';
import {codeEmbedContext, modelScopedService} from '../views/codeViewLanguage';

const engine = MutableDecisionService.fromCode(`{
    type Applicant: { age: <number>; income: <number> }
    facts Applicant(a: Applicant): { isAdult: a.age >= 18 }
    func double(x: number): { result: x * 2 }
    rules: {
        limit: double(10)
        func check(app: Applicant): {
            ok: app.age > 18
            d: double(app.income)
        }
    }
    other: {
        func check(app: Applicant): { ok: app.age > 1 }
    }
    workbook book: {
        score: double(rules.limit)
    }
}`);
const model = engine.getCode('*') as string;

function codeOf(root: string): string {
    if (root === factsPath('Applicant')) return factsCode(engine, 'Applicant') as string;
    return engine.getCode(root) as string;
}

function scoped(root: string) {
    const context = codeEmbedContext(model, root, codeOf(root));
    if (!context) throw new Error(`no context for ${root}`);
    return {context, service: modelScopedService(MutableDecisionService, context)};
}

describe('codeEmbedContext', () => {
    it.each(['double', 'rules', 'rules.check', 'other.check', 'Applicant', factsPath('Applicant'), 'book'])(
        'places the code of %s at its place in the model',
        (root) => {
            const {context} = scoped(root);
            // The model with the code of the entity unindented: the same model.
            const rebuilt = MutableDecisionService.fromCode(context.prefix + codeOf(root) + context.suffix);
            expect(rebuilt.getCode('*')).toBe(model);
        },
    );

    it('picks the entity of the path, not one of the same name elsewhere', () => {
        const {context} = scoped('other.check');
        expect(context.prefix).toContain('other: {');
        expect(context.prefix).not.toContain('book');
    });

    it('has no context for the model root or a path not in the model', () => {
        expect(codeEmbedContext(model, '*', model)).toBeUndefined();
        expect(codeEmbedContext(model, 'missing', 'func missing(): { r: 1 }')).toBeUndefined();
        expect(codeEmbedContext(model, 'rules.nope', '{ a: 1 }')).toBeUndefined();
    });
});

describe('modelScopedService', () => {
    it('resolves types and functions declared elsewhere in the model', () => {
        const code = codeOf('rules.check');
        // On its own the code references an unknown type.
        expect(MutableDecisionService.diagnostics(code)).not.toEqual([]);
        expect(scoped('rules.check').service.diagnostics(code)).toEqual([]);
        expect(scoped(factsPath('Applicant')).service.diagnostics(codeOf(factsPath('Applicant')))).toEqual([]);
        expect(scoped('rules').service.diagnostics(codeOf('rules'))).toEqual([]);
    });

    it('reports a reference that is unknown in the model too, inside the code', () => {
        const code = 'func double(x: number): { result: missing * 2 }';
        const diagnostics = scoped('double').service.diagnostics(code);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]!.message).toContain('missing');
        expect(diagnostics[0]!.from).toBeGreaterThanOrEqual(0);
        expect(diagnostics[0]!.to).toBeLessThanOrEqual(code.length);
    });

    it('reports a parse error at the end of the code', () => {
        const code = '{\n    limit: double(10)';
        const diagnostics = scoped('rules').service.diagnostics(code);
        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['UnclosedDelimiter']);
    });

    it('completes names declared elsewhere in the model', () => {
        const code = '{\n    limit: dou\n}';
        const position = code.indexOf('dou') + 3;
        // On its own the code has no `double`.
        const labels = (service: CodeEditorService) =>
            service.completions!(code, position).options.map((option) => option.label);
        expect(labels(MutableDecisionService)).not.toContain('double');
        expect(labels(scoped('rules').service)).toContain('double');
    });
});
