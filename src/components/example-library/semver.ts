// A small semver subset for engine ranges such as `>=0.2.7-alpha`: comparators joined by spaces.

interface Version {
    core: [number, number, number];
    pre: string[];
}

function parse(text: string): Version | undefined {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(text.trim());
    if (!match) return undefined;
    return {core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split('.') : []};
}

function compareIdentifier(a: string, b: string): number {
    const numeric = /^\d+$/;
    if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b);
    if (numeric.test(a)) return -1;
    if (numeric.test(b)) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
}

function compare(a: Version, b: Version): number {
    for (let i = 0; i < 3; i += 1) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
    if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length; // a release is newer
    for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
        if (a.pre[i] === undefined) return -1;
        if (b.pre[i] === undefined) return 1;
        const result = compareIdentifier(a.pre[i], b.pre[i]);
        if (result !== 0) return result;
    }
    return 0;
}

/** True when `version` satisfies `range`. An unparsable version or range counts as compatible. */
export function satisfiesEngine(version: string, range: string): boolean {
    const actual = parse(version);
    if (!actual) return true;
    for (const comparator of range.split(/\s+/).filter(Boolean)) {
        const match = /^(>=|<=|>|<|=)?(.+)$/.exec(comparator);
        const bound = match && parse(match[2]);
        if (!match || !bound) return true;
        const order = compare(actual, bound);
        const ok =
            {'>=': order >= 0, '<=': order <= 0, '>': order > 0, '<': order < 0, '=': order === 0}[match[1] ?? '='] ??
            true;
        if (!ok) return false;
    }
    return true;
}
