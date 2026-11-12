import type {ProjectSession} from '../../../../project-session';
import {README_PATH} from '../../../core/paths';
import type {SourcePath} from '../../../core/toolResult';
import type {AppliedOperation, OperationApplier} from './appliedOperation';

/** One `set-documentation` item: the whole Markdown text of one path. */
export interface DocumentationItem {
    path: SourcePath; // a model path, or 'doc:README.md'
    text: string; // '' removes the documentation of a model entry
}

/** The applier of `set-documentation`. The inverse operation writes the text before. */
export function createDocumentationOperations(session: ProjectSession): OperationApplier<DocumentationItem> {
    const {documentation, readme} = session;

    function read(path: SourcePath): string {
        return path === README_PATH ? readme.exportDocument() : (documentation.getDescription(path) ?? '');
    }

    function write(path: SourcePath, text: string): AppliedOperation {
        const before = read(path);
        if (path === README_PATH) readme.setMarkdown(text);
        else documentation.setDescription(path, text);
        return {
            target: path,
            stateAfter: read(path),
            readState: () => read(path),
            inverse: () => write(path, before),
            changed: [path],
            summary: path === README_PATH ? 'set the README' : `documented ${path}`,
        };
    }

    return {apply: (item) => write(item.path, item.text)};
}
