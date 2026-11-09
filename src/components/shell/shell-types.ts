import type {CSSProperties} from 'react';
import type {BoxedEditorOpenTarget} from '../boxed-editor';
import type {CodeEditorService} from '../code-editor';
import type {FlowEditorOpenTarget} from '../flow-editor';
import type {ProjectDescriptor, ProjectLocator, ProjectOrigin} from '../project-session';

// 'tests' shows the tests of the root path in the Tests Manager; it is the only view of a test. 'preview' shows the
// rendered Markdown of a document root (`doc:README.md`); only a document root has it.
export type ShellView = 'code' | 'boxed' | 'flow' | 'tests' | 'preview';

// The links of the open project to other projects, the Library and its source example. The host owns the routes.
export interface ShellNavigation {
    onBrowseExamples: () => void; // "Browse examples"
    onOpenProject: (locator: ProjectLocator) => void; // a recent project
    recentProjects?: ProjectDescriptor[]; // newest first; the Shell shows up to 5 and omits the open project
    onShowOrigin?: (origin: ProjectOrigin) => void; // the origin chip and "View original example"
    originStatus?: 'latest' | 'update-available'; // from the library index; no status without it
    onDuplicate?: () => void; // shows "Duplicate"; the host copies the project and opens the copy
}

export interface ShellProps {
    languageService: CodeEditorService; // diagnostics and completions; the engine class statics fit
    path?: string; // controlled root path: '*', the path of an entity, or a document path such as 'doc:README.md'
    defaultPath?: string; // uncontrolled initial root path; defaults to '*'
    onPathChange?: (path: string) => void; // breadcrumb click, drill-down, or fallback to an existing path
    view?: ShellView; // controlled active view
    defaultView?: ShellView; // uncontrolled initial view; defaults to 'boxed'
    onViewChange?: (view: ShellView) => void; // view switch, or "View as code" of an editor
    readOnly?: boolean; // passed to every editor
    explorerOpen?: boolean; // controlled visibility of the Project Explorer side panel
    defaultExplorerOpen?: boolean; // uncontrolled initial visibility of the Project Explorer; defaults to true
    onExplorerOpenChange?: (open: boolean) => void; // the hide button or a rail icon of the panel
    onOpenNode?: (target: BoxedEditorOpenTarget | FlowEditorOpenTarget) => void; // targets the Shell does not open
    navigation?: ShellNavigation; // shows the Workspace crumb and the project menu
    className?: string;
    style?: CSSProperties;
}
