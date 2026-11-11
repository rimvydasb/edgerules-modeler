import {createLibraryClient, type LibrarySource} from '../../src/components/example-library';

/** The published `rimvydasb/edgerules-examples` repository on jsDelivr: the index at `main`, files pinned to a commit. */
export const EXAMPLES_SOURCE: LibrarySource = {
    indexUrl: 'https://cdn.jsdelivr.net/gh/rimvydasb/edgerules-examples@main/library.json',
    fileBaseUrl: (ref) => `https://cdn.jsdelivr.net/gh/rimvydasb/edgerules-examples@${ref}/`,
};

export const EXAMPLES_REPOSITORY_URL = (path: string, ref: string) =>
    `https://github.com/rimvydasb/edgerules-examples/tree/${ref}/${path}`;

export function createExamplesClient() {
    return createLibraryClient(EXAMPLES_SOURCE);
}
