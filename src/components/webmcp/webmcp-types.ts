import type {ProjectSession} from '../project-session';
import type {ModelContextLike} from './platform/modelContext';
import type {AgentActivityLog} from './project/changes/agentActivityLog';

/** A Shell view. The same values as `ShellView` of `edgerules-react/shell`, which this component does not import. */
export type ProjectToolsView = 'code' | 'boxed' | 'flow' | 'tests' | 'preview';

/** Implemented by the host from its routes; the Shell path and view stay controlled by the host. */
export interface ProjectToolsNavigation {
    getFocus(): {path: string; view: ProjectToolsView}; // what the user looks at now
    open(path: string, view: ProjectToolsView): void; // the same navigation as a Project Explorer click
}

export interface ProjectToolsOptions {
    modelContext: ModelContextLike | undefined; // `getModelContext()`, or a polyfill of the host
    session: ProjectSession; // the open project
    navigation?: ProjectToolsNavigation; // enables the navigation tools
    readOnly?: boolean; // registers only read tools; default false
    allowSave?: boolean; // registers `save-project`; default false
}

/**
 * The agent changes, their undo and the running tool, for the Shell `agentActivity` prop. `undo` waits for the
 * running tool call, as a tool call does.
 */
export interface ProjectToolsActivity extends AgentActivityLog {
    running(): string | undefined; // the name of the tool that runs now; `subscribe` reports each change
}

export interface ProjectToolsHandle {
    readonly active: boolean; // false when `modelContext` is undefined
    readonly activity?: ProjectToolsActivity; // the agent changes and their undo; absent when not active
    setReadOnly(readOnly: boolean): void; // re-registers the write tools
    setAllowSave(allowSave: boolean): void; // registers or unregisters `save-project`
    dispose(): void; // unregisters every tool and aborts every running call
}
