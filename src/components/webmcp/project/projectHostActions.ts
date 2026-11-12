import {listCallables} from '#lib/callables';
import {isPortableError} from '#lib/portable';
import {
    isRootPath,
    primaryRootView,
    resolveRootPath,
    ROOT_VIEWS,
    rootPathSegments,
    rootViews,
    type RootView,
} from '#lib/rootViews';
import {isProjectError, type ProjectSession} from '../../project-session';
import {README_PATH} from '../core/paths';
import {fail, messageOf, ok, type SourcePath, type ToolResult} from '../core/toolResult';

/** A Shell view; the same values as `ProjectToolsView` and `ShellView`. */
export type HostView = RootView;

/** The routes of the host, as `ProjectToolsNavigation` declares them. */
export interface HostNavigation {
    getFocus(): {path: string; view: HostView};
    open(path: string, view: HostView): void;
}

export interface OpenInEditorInput {
    path: SourcePath;
    view?: HostView; // default: the default view of the entry kind
}

export interface OpenResult {
    path: SourcePath;
    view: HostView;
}

export interface SaveResultView {
    revision: string;
    savedAt: string; // ISO time
}

/** The host capabilities; each one is absent when the host does not give it. */
export interface ProjectHostActions {
    navigation?: HostNavigation;
    // Checks that the Shell offers `view` for `path`, then calls `navigation.open`. Only with `navigation`.
    open?: (input: OpenInEditorInput) => ToolResult<OpenResult>;
    // Only while `allowSave` is on and `readOnly` is off.
    save?: (baseVersion?: number) => Promise<ToolResult<SaveResultView>>;
}

/** The views that the Shell offers for `path`, or the error when the path is not a Shell root path. */
export function viewsOf(session: ProjectSession, path: SourcePath): ToolResult<{views: readonly HostView[]}> {
    if (path === README_PATH) return ok({views: ROOT_VIEWS.document});
    const model = session.engine.toPortable();
    if (!isRootPath(model, path)) {
        const ancestor = resolveRootPath(model, path);
        if (isPortableError(session.engine.get(path))) {
            return fail('NotFound', `No model entry '${path}'.`, {
                path,
                hint: 'Call list-model-entries or search-model to find the path.',
            });
        }
        return fail('InvalidInput', `'${path}' is inside '${ancestor}'; the editor opens '${ancestor}' as a whole.`, {
            path,
            hint: `Open '${ancestor}' instead.`,
        });
    }
    const readme = session.getSlice('readme').trim() !== '';
    const subjects = new Set(['*', ...listCallables(session.engine).map((callable) => callable.path)]);
    const views = rootViews(rootPathSegments(model, path), model, readme).filter(
        (view) => view !== 'tests' || subjects.has(path),
    );
    return ok({views});
}

/**
 * The host actions of `registerProjectTools`. `navigation` comes from the host; `canSave` is read at each call, since
 * `setAllowSave` and `setReadOnly` change it.
 */
export function createProjectHostActions(
    session: ProjectSession,
    navigation: HostNavigation | undefined,
    canSave: () => boolean,
): ProjectHostActions {
    const actions: ProjectHostActions = {
        get save() {
            return canSave() ? save : undefined;
        },
    };
    if (navigation) {
        actions.navigation = navigation;
        actions.open = (input) => open(navigation, input);
    }
    return actions;

    function open(nav: HostNavigation, input: OpenInEditorInput): ToolResult<OpenResult> {
        const offered = viewsOf(session, input.path);
        if (!offered.ok) return offered;
        const {views} = offered;
        const view = input.view ?? primaryRootView(views);
        if (!views.includes(view)) {
            return fail('InvalidInput', `The editor has no '${view}' view for '${input.path}'.`, {
                path: input.path,
                hint: `The views of '${input.path}': ${views.join(', ')}.`,
            });
        }
        nav.open(input.path, view);
        return ok({path: input.path, view});
    }

    async function save(baseVersion?: number): Promise<ToolResult<SaveResultView>> {
        const snapshot = session.getSnapshot();
        if (baseVersion !== undefined && baseVersion !== snapshot.localVersion) {
            return fail('VersionConflict', `The project changed after version ${baseVersion}.`, {
                currentVersion: snapshot.localVersion,
                hint: 'Call get-project-overview to see the changes, then save without baseVersion.',
            });
        }
        if (snapshot.dslValidity.status === 'invalid') {
            return fail('ParseError', `The model DSL is invalid, so the project cannot be saved.`, {
                hint: 'The user has invalid code in the Code view; ask the user to fix or discard it.',
            });
        }
        try {
            const result = await session.save();
            return ok({revision: result.revision, savedAt: result.descriptor.savedAt});
        } catch (thrown) {
            if (isProjectError(thrown, 'conflict')) {
                return fail('SaveConflict', 'The workspace has a newer revision of this project.', {
                    hint: 'Ask the user to reload the project or to save a copy.',
                });
            }
            if (isProjectError(thrown, 'invalid-state')) {
                return fail('InvalidInput', `The project cannot be saved now: ${messageOf(thrown)}`, {
                    hint: 'Retry after the current save ends.',
                });
            }
            throw thrown;
        }
    }
}
