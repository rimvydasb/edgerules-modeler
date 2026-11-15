import {createLibraryClient, type LibrarySource} from '../../src/components/example-library';

/**
 * The published `rimvydasb/edgerules-examples` repository. The index is read from raw.githubusercontent.com at `main`
 * (cached 5 min): jsDelivr caches a branch URL for 12 h at the edge and 7 days in the browser, which showed stale or
 * half-published indexes. Files are pinned to a commit on jsDelivr, where they are immutable and safe to cache.
 */
export const EXAMPLES_SOURCE: LibrarySource = {
    indexUrl: 'https://raw.githubusercontent.com/rimvydasb/edgerules-examples/main/library.json',
    fileBaseUrl: (ref) => `https://cdn.jsdelivr.net/gh/rimvydasb/edgerules-examples@${ref}/`,
};

export const EXAMPLES_REPOSITORY_URL = (path: string, ref: string) =>
    `https://github.com/rimvydasb/edgerules-examples/tree/${ref}/${path}`;

export function createExamplesClient() {
    return createLibraryClient(EXAMPLES_SOURCE);
}
