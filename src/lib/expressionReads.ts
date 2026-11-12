/**
 * The dotted paths an expression text reads, such as `mix.status` or `plan`, in order of first read. String literals,
 * the members of a path (`records[i].data` reads `records`), the names of named arguments and record keys are
 * skipped. A local name (`r` of `for r in records`) and a keyword are paths too: a caller keeps only the paths whose
 * first name it knows.
 */
export function readPaths(text: string): string[] {
    const code = text.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const paths = new Set<string>();
    // Not after a word character or a member dot (a range `0..n` still reads `n`), and not a `name:` key.
    for (const match of code.matchAll(/(?<!\w)(?<!(?:^|[^.])\.)[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?!\w|\s*:(?!=))/g))
        paths.add(match[0]);
    return [...paths];
}
