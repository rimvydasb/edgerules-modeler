import {exampleFromFiles, ProjectError, type ExampleFiles} from '../project-session';
import type {
    ExampleCoordinates,
    LibraryClient,
    LibraryEntry,
    LibraryIndex,
    LibrarySource,
    LibraryVersion,
    LoadedExample,
} from './types';

export interface LibraryClientOptions {
    fetch?: typeof fetch; // defaults to the global fetch
    now?: () => number; // clock in ms, defaults to Date.now
}

/** The index is never served from a cache older than this: in memory, and (via revalidation) in the browser. */
export const INDEX_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const MANIFEST_FILE = 'edgerules.project.json';
const README_FILE = 'README.md';
const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateEntry(entry: unknown, position: number): LibraryEntry | undefined {
    const where = `examples[${position}]`;
    if (!isRecord(entry)) throw new Error(`${where} is not an object`);
    for (const key of ['id', 'path', 'name', 'description', 'industry', 'engine'] as const) {
        if (typeof entry[key] !== 'string' || entry[key] === '') throw new Error(`${where}.${key} must be a string`);
    }
    if (!LEVELS.has(entry.level as string)) throw new Error(`${where}.level is not a known level`);
    if (!isStringArray(entry.features)) throw new Error(`${where}.features must be a string array`);
    if (!Array.isArray(entry.versions)) throw new Error(`${where}.versions must be an array`);
    // A version without a `ref` is a draft that is not released yet: it cannot be loaded, so it is left out instead of
    // failing the whole library. A malformed (non-object, or `version` is not a string) version is still an error.
    const versions = entry.versions.filter((version) => {
        if (!isRecord(version) || typeof version.version !== 'string') {
            throw new Error(`${where}.versions: every version needs "version"`);
        }
        return typeof version.ref === 'string' && version.ref !== '';
    });
    if (versions.length === 0) return undefined; // nothing released yet: the example is not listed
    return {...entry, versions} as unknown as LibraryEntry;
}

/** Checks the shape of `library.json`; throws an `Error` that names the first wrong member. */
export function validateLibraryIndex(value: unknown): LibraryIndex {
    if (!isRecord(value)) throw new Error('library.json is not an object');
    if (value.schemaVersion !== 1)
        throw new Error(`Unsupported library.json schemaVersion ${String(value.schemaVersion)}`);
    if (!Array.isArray(value.industries)) throw new Error('industries must be an array');
    if (!Array.isArray(value.examples)) throw new Error('examples must be an array');
    const examples = value.examples.map(validateEntry).filter((entry): entry is LibraryEntry => entry !== undefined);
    return {
        ...(value as unknown as LibraryIndex),
        examples,
        featured: isStringArray(value.featured) ? value.featured : [],
    };
}

/** A client of one library: the index is refetched after `INDEX_MAX_AGE_MS`, the files of an example in parallel. */
export function createLibraryClient(source: LibrarySource, options: LibraryClientOptions = {}): LibraryClient {
    const fetcher = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
    const now = options.now ?? Date.now;
    let index: LibraryIndex | undefined;
    let loadedAt = 0;
    let pending: Promise<LibraryIndex> | undefined;

    async function fetchText(url: string, label: string, init?: RequestInit): Promise<string> {
        const response = await fetcher(url, init);
        if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
        return response.text();
    }

    function versionOf(entry: LibraryEntry, version: string): LibraryVersion {
        const found = entry.versions.find((candidate) => candidate.version === version);
        if (!found) throw new Error(`${entry.id}@${version} is not in the index`);
        return found;
    }

    function fileUrl(entry: LibraryEntry, ref: string, file: string): string {
        return `${source.fileBaseUrl(ref)}${entry.path}/${file}`;
    }

    return {
        loadIndex() {
            if (index && now() - loadedAt < INDEX_MAX_AGE_MS) return Promise.resolve(index);
            // `no-cache` makes the browser revalidate: a copy cached by the HTTP cache is never used unchecked.
            pending ??= fetchText(source.indexUrl, 'library.json', {cache: 'no-cache'})
                .then((text) => validateLibraryIndex(JSON.parse(text)))
                .then((loaded) => {
                    loadedAt = now();
                    return (index = loaded);
                })
                .finally(() => {
                    pending = undefined; // a failure can be retried
                });
            return pending;
        },

        resolve({id, version}: ExampleCoordinates) {
            return index?.examples.find((entry) => entry.id === id)?.versions.find((v) => v.version === version);
        },

        resolveFileUrl(entry, version, relativePath) {
            return fileUrl(entry, versionOf(entry, version).ref, relativePath.replace(/^\.?\//, ''));
        },

        loadReadme(entry, version) {
            return fetchText(fileUrl(entry, versionOf(entry, version).ref, README_FILE), README_FILE);
        },

        async loadExample(entry, version): Promise<LoadedExample> {
            const {ref} = versionOf(entry, version);
            const read = (file: string) => fetchText(fileUrl(entry, ref, file), file);

            const manifestText = await read(MANIFEST_FILE);
            let manifest: unknown;
            try {
                manifest = JSON.parse(manifestText);
            } catch (error) {
                throw new Error(`${MANIFEST_FILE}: ${error instanceof Error ? error.message : String(error)}`);
            }
            const listed = isRecord(manifest) ? manifest : {};
            const model = isRecord(listed.model) ? listed.model : {};
            const paths = [
                typeof model.source === 'string' ? model.source : undefined,
                typeof listed.documentation === 'string' ? listed.documentation : undefined,
                ...(isStringArray(listed.tests) ? listed.tests : []),
                typeof listed.flow === 'string' ? listed.flow : undefined,
            ].filter((path): path is string => path !== undefined);

            const files: ExampleFiles = {[MANIFEST_FILE]: manifestText};
            await Promise.all([
                ...paths.map(async (path) => {
                    files[path] = await read(path);
                }),
                // The README has a fixed path and is optional: a project without one gets a generated README.
                read(README_FILE).then(
                    (text) => {
                        files[README_FILE] = text;
                    },
                    () => undefined,
                ),
            ]);

            let project;
            try {
                project = exampleFromFiles(files);
            } catch (error) {
                if (error instanceof ProjectError) throw new Error(`${entry.id}@${version}: ${error.message}`);
                throw error;
            }
            return {
                entry,
                ref,
                project: {...project, origin: {library: source.indexUrl, id: entry.id, version}},
            };
        },
    };
}
