// A JSON writer whose output `prettier --check` accepts for the repository settings (print width 120, no spaces inside
// brackets): objects always break, an array stays on one line when it fits and breaks one element a line otherwise.
// An example file is canonical text, so the serializer owns the layout instead of calling Prettier.

const PRINT_WIDTH = 120;
const INDENT = '  ';

type Json = null | boolean | number | string | Json[] | {[key: string]: Json | undefined};

function isObject(value: Json): value is {[key: string]: Json | undefined} {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inline(value: Json): string | undefined {
    if (Array.isArray(value)) {
        const parts = value.map(inline);
        return parts.every((part) => part !== undefined) ? `[${parts.join(', ')}]` : undefined;
    }
    if (isObject(value)) return Object.keys(value).length === 0 ? '{}' : undefined;
    return JSON.stringify(value);
}

// Prettier keeps an array with several object or array elements broken, even when it would fit.
function forcesBreak(value: Json[]): boolean {
    const nested = value.filter((item) =>
        Array.isArray(item) ? item.length > 0 : isObject(item) && Object.keys(item).length > 0,
    );
    return nested.length > 1 && nested.length === value.length;
}

function print(value: Json, depth: number, column: number, trailing: number): string {
    const pad = INDENT.repeat(depth);
    if (Array.isArray(value)) {
        const flat = inline(value);
        if (flat !== undefined && !forcesBreak(value) && column + flat.length + trailing <= PRINT_WIDTH) return flat;
        const inner = INDENT.repeat(depth + 1);
        const items = value.map((item, index) => {
            const last = index === value.length - 1 ? 0 : 1;
            return `${inner}${print(item, depth + 1, inner.length, last)}`;
        });
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    if (isObject(value)) {
        const entries = Object.entries(value).filter((entry): entry is [string, Json] => entry[1] !== undefined);
        if (entries.length === 0) return '{}';
        const inner = INDENT.repeat(depth + 1);
        const lines = entries.map(([key, item], index) => {
            const head = `${inner}${JSON.stringify(key)}: `;
            return `${head}${print(item, depth + 1, head.length, index === entries.length - 1 ? 0 : 1)}`;
        });
        return `{\n${lines.join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

/** The JSON text of `value` as Prettier prints it, with a final newline. Keys keep the order they have in `value`. */
export function prettierJson(value: unknown): string {
    return `${print(value as Json, 0, 0, 0)}\n`;
}
