import type {ProjectSession} from '../project-session';
import type {ModelContextLike} from './platform/modelContext';

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

export interface ProjectToolsHandle {
    readonly active: boolean; // false when `modelContext` is undefined
    setReadOnly(readOnly: boolean): void; // re-registers the write tools
    setAllowSave(allowSave: boolean): void; // registers or unregisters `save-project`
    dispose(): void; // unregisters every tool and aborts every running call
}
