import {embedService, type CodeEditorEmbedContext, type CodeEditorService} from '../../code-editor/language/service';

// `getCode('*')` indents every nesting level by this much.
const INDENT = '    ';
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function stepsOf(root: string): string[] | undefined {
    const names = root.split('.');
    return names.every((name) => IDENTIFIER.test(name)) ? names : undefined;
}

// The declaration line of `name` at `indent`: `name: …`, `func name(…`, `type name: …`, `facts name(…` and so on.
function declares(rest: string, name: string): boolean {
    return new RegExp(`^(?:[a-z]+ )?${name}\\s*[:(]`).test(rest);
}

/**
 * The text around the code of `root` in `model`, the canonical code of the whole model (`getCode('*')`), so that the
 * code of one entity can be analyzed in the scope of the model. `code` is the code of `root` as `getCode(root)` returns
 * it. Undefined for the model root, or when `root` is not found in `model`.
 */
export function codeEmbedContext(model: string, root: string, code: string): CodeEditorEmbedContext | undefined {
    if (root === '*' || code === '') return undefined;
    const steps = stepsOf(root);
    if (!steps) return undefined;

    const lines = model.split('\n');
    let line = 0; // the `{` of the model
    for (const [index, step] of steps.entries()) {
        const indent = INDENT.repeat(index + 1);
        let found: number | undefined;
        for (let next = line + 1; next < lines.length; next++) {
            const text = lines[next]!;
            if (text.trim() === '') continue;
            // A line that is indented less closes the parent.
            if (!text.startsWith(indent)) break;
            if (text[indent.length] !== ' ' && declares(text.slice(indent.length), step)) {
                found = next;
                break;
            }
        }
        if (found === undefined) return undefined;
        line = found;
    }

    // `getCode(root)` starts at the left margin; inside the model, the lines after the first are indented.
    const indent = INDENT.repeat(steps.length);
    const embedded = code
        .split('\n')
        .map((text, index) => (index === 0 || text === '' ? text : indent + text))
        .join('\n');
    const lineStart = lines.slice(0, line).reduce((offset, text) => offset + text.length + 1, 0);
    const from = model.indexOf(embedded, lineStart);
    if (from === -1 || from > lineStart + lines[line]!.length) return undefined;
    return {prefix: model.slice(0, from), suffix: model.slice(from + embedded.length)};
}

/**
 * `service` for the code of one entity, analyzed in the scope of the whole model by `context`: references to types
 * and functions declared elsewhere in the model resolve. While the code does not parse on its own, the parse errors
 * of the code alone are reported: in the model, an unclosed delimiter is reported after the code, outside its range.
 */
export function modelScopedService(service: CodeEditorService, context: CodeEditorEmbedContext): CodeEditorService {
    const embedded = embedService(service, context);
    return {
        ...embedded,
        diagnostics: (code) => {
            const parseErrors = service.diagnostics(code).filter((diagnostic) => diagnostic.source === 'parser');
            return parseErrors.length > 0 ? parseErrors : embedded.diagnostics(code);
        },
    };
}
