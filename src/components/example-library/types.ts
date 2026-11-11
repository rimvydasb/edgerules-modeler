import type {ExampleLevel, ProjectBundleInput} from '../project-session';

export interface LibraryIndustry {
    id: string;
    title: string;
    description?: string;
    icon?: string;
}

export interface LibraryVersion {
    version: string; // released version, semver
    ref: string; // commit SHA that holds the files of the version
    released: string; // ISO date
}

/** One example of `library.json`. The metadata fields are those of the newest version. */
export interface LibraryEntry {
    id: string; // the slug
    path: string; // example directory in the repository
    name: string;
    description: string;
    industry: string;
    level: ExampleLevel;
    features: string[];
    tags?: string[];
    engine: string; // semver range of the engine that links the model
    thumbnail?: string; // path relative to the example directory
    requires?: string[];
    stats?: {tests?: number; lines?: number};
    versions: LibraryVersion[]; // newest first
}

export interface LibraryIndex {
    schemaVersion: 1;
    generatedFrom: string;
    industries: LibraryIndustry[];
    featured: string[];
    examples: LibraryEntry[];
}

export interface LibrarySource {
    indexUrl: string; // URL of library.json; also the `library` of a ProjectOrigin
    fileBaseUrl: (ref: string) => string; // base URL of the repository files at a commit, with a final '/'
}

export interface ExampleCoordinates {
    id: string; // example id, the slug
    version: string; // released version
}

export interface LoadedExample {
    entry: LibraryEntry; // the index entry
    ref: string; // commit SHA of the files
    project: ProjectBundleInput; // ready for ProjectFactory.createBundle; `origin` and `readme` are set
}

export interface LibraryClient {
    loadIndex(): Promise<LibraryIndex>; // fetches and validates library.json; caches it for the session
    resolve(coordinates: ExampleCoordinates): LibraryVersion | undefined; // the version and its ref, from the index
    loadReadme(entry: LibraryEntry, version: string): Promise<string>; // README Markdown at the ref of the version
    loadExample(entry: LibraryEntry, version: string): Promise<LoadedExample>; // all files of the manifest, in parallel
    resolveFileUrl(entry: LibraryEntry, version: string, relativePath: string): string; // URL of a file of a version
}
