/** One page of `text`, from `offset`. A page ends at a line break when one exists in the last 20% of the page. */
export function pageOf(text: string, offset: number, size: number): {text: string; nextOffset?: number} {
    const end = offset + size;
    if (end >= text.length) return {text: text.slice(offset)};
    const lineBreak = text.lastIndexOf('\n', end - 1);
    const cut = lineBreak >= offset + size * 0.8 ? lineBreak + 1 : end;
    return {text: text.slice(offset, cut), nextOffset: cut};
}
