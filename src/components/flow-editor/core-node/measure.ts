/*
 * The node fonts as CSS `font` shorthands. The families are the Mantine theme variables the node CSS uses, so a width
 * is measured in the font the node renders in; `measureText` resolves them before it sets the canvas font.
 */
const UI_FONT = 'var(--mantine-font-family)';
const MONO_FONT = 'var(--mantine-font-family-monospace)';

const FALLBACK_FAMILIES: Record<string, string> = {
    '--mantine-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    '--mantine-font-family-monospace': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const FONTS = {
    title: `600 14px ${UI_FONT}`,
    field: `12px ${MONO_FONT}`,
    name: `14px ${UI_FONT}`,
    label: `600 11px ${UI_FONT}`,
    chip: `12.5px ${MONO_FONT}`,
    ret: `12px ${MONO_FONT}`,
    value: `13px ${MONO_FONT}`,
    placeholder: `italic 13px ${UI_FONT}`,
} as const;

const resolved = new Map<string, string>();

/** The font with each `var(--name)` replaced by the value of that variable on the document root, cached per font. */
function resolveFont(font: string): string {
    const cached = resolved.get(font);
    if (cached !== undefined) return cached;
    const root = typeof document === 'undefined' ? undefined : getComputedStyle(document.documentElement);
    const value = font.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
        const family = root?.getPropertyValue(name).trim();
        return family || FALLBACK_FAMILIES[name] || 'sans-serif';
    });
    // Before Mantine has set its variables the fallback is used, and that result is not kept.
    if (root?.getPropertyValue('--mantine-font-family').trim()) resolved.set(font, value);
    return value;
}

let context: CanvasRenderingContext2D | null | undefined;

function canvasContext(): CanvasRenderingContext2D | null {
    if (context === undefined) {
        try {
            context = document.createElement('canvas').getContext('2d');
        } catch {
            context = null;
        }
    }
    return context;
}

/** Text width in px. Without a canvas (server rendering, tests) it estimates from the character count. */
export function measureText(text: string, font: string): number {
    const ctx = canvasContext();
    if (!ctx) return text.length * 7;
    ctx.font = resolveFont(font);
    return ctx.measureText(text).width;
}
