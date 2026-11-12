import {isPortableError} from '#lib/portable';
import {isContextNode, authoredEntries} from '#lib/portableUtils';
import type {ProjectSession} from '../../../../project-session';
import type {ModelPath} from '../../../core/paths';
import {toToolError} from '../../../core/portableErrors';
import {fail} from '../../../core/toolResult';
import {OperationFailure, type AppliedOperation, type OperationApplier} from './appliedOperation';

export type ModelOperation =
    // One declaration or one field. `engine.setCode(path, code)`; creates the entry when new.
    | {op: 'set'; path: ModelPath; code: string}
    // `session.execute({type: 'renamePath', path, newName})`. `newName` is one segment.
    | {op: 'rename'; path: ModelPath; newName: string}
    // `engine.remove(path)`. Also removes the documentation of the path and of each nested path.
    | {op: 'remove'; path: ModelPath};

function isAtOrUnder(path: string, base: string): boolean {
    return path === base || path.startsWith(`${base}.`);
}

function parentPrefix(path: string): string {
    const dot = path.lastIndexOf('.');
    return dot === -1 ? '' : path.slice(0, dot + 1);
}

function notFound(path: string): OperationFailure {
    return new OperationFailure(
        fail('NotFound', `The model has no entry '${path}'.`, {
            path,
            hint: 'Call list-model-entries to see the paths of the model.',
        }).error,
    );
}

/** The appliers of `edit-model`: `set`, `rename` and `remove`, each with its inverse operation. */
export function createModelOperations(session: ProjectSession): OperationApplier<ModelOperation> {
    const {engine, documentation} = session;

    // The code of `path`, or `null` when the model has no such entry.
    function readCode(path: string): string | null {
        const code = engine.getCode(path);
        return typeof code === 'string' ? code : null;
    }

    // The code of each entry that is not a context, by path: what a rename can rewrite. A context is left out, so the
    // parent of a renamed field does not count as rewritten. Replace with the paths the engine returns once
    // rimvydasb/edgerules#68 ships.
    function codeIndex(): Map<string, string> {
        const index = new Map<string, string>();
        const visit = (node: unknown, prefix: string) => {
            for (const [name, child] of authoredEntries(node)) {
                const path = prefix + name;
                if (isContextNode(child)) visit(child, `${path}.`);
                else {
                    const code = readCode(path);
                    if (code !== null) index.set(path, code);
                }
            }
        };
        visit(engine.toPortable(), '');
        return index;
    }

    function set(path: string, code: string): AppliedOperation {
        const before = readCode(path);
        const result = engine.setCode(path, code);
        if (isPortableError(result)) {
            throw new OperationFailure(toToolError(result, {source: code, path}));
        }
        return {
            target: path,
            stateAfter: readCode(path),
            readState: () => readCode(path),
            inverse: before === null ? () => remove(path) : () => set(path, before),
            changed: [path],
            summary: before === null ? `added ${path}` : `set ${path}`,
        };
    }

    function rename(path: string, newName: string): AppliedOperation {
        const newPath = parentPrefix(path) + newName;
        if (readCode(path) === null) throw notFound(path);
        if (newPath !== path && readCode(newPath) !== null) {
            throw new OperationFailure(
                fail('DuplicateName', `The model already has an entry '${newPath}'.`, {path: newPath}).error,
            );
        }
        const before = codeIndex();
        const result = session.execute({type: 'renamePath', path, newName});
        if (!result.ok) throw result.error; // outside a transaction only; inside one the command throws
        const rewritten: string[] = [];
        for (const [entry, code] of codeIndex()) {
            if (isAtOrUnder(entry, newPath)) continue;
            if (before.get(entry) !== code) rewritten.push(entry);
        }
        const oldName = path.slice(parentPrefix(path).length);
        return {
            target: newPath,
            stateAfter: readCode(newPath),
            readState: () => readCode(newPath),
            inverse: () => rename(newPath, oldName),
            changed: [newPath, ...rewritten],
            summary: `renamed ${path} to ${newName}`,
        };
    }

    function remove(path: string): AppliedOperation {
        const code = readCode(path);
        if (code === null) throw notFound(path);
        const removedDocs = Object.entries(documentation.exportDocument().byPath).filter(([key]) =>
            isAtOrUnder(key, path),
        );
        const result = engine.remove(path);
        if (isPortableError(result)) throw new OperationFailure(toToolError(result, {path}));
        for (const [key] of removedDocs) documentation.setDescription(key, '');
        return {
            target: path,
            stateAfter: null,
            readState: () => readCode(path),
            inverse: () => {
                const restored = set(path, code);
                for (const [key, text] of removedDocs) documentation.setDescription(key, text);
                return restored;
            },
            changed: [path],
            summary: `removed ${path}`,
        };
    }

    return {
        apply(operation) {
            switch (operation.op) {
                case 'set':
                    return set(operation.path, operation.code);
                case 'rename':
                    return rename(operation.path, operation.newName);
                case 'remove':
                    return remove(operation.path);
            }
        },
    };
}
