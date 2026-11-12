import type {ProjectToolsContext} from '../project/projectToolsContext';
import type {AnyToolDefinition, ToolDefinition} from '../protocol/toolDefinition';

/** A tool of the open project: a `ToolDefinition` bound to `ProjectToolsContext`. */
export type ProjectTool<I extends object, O extends object> = ToolDefinition<I, O, ProjectToolsContext>;

export type AnyProjectTool = AnyToolDefinition<ProjectToolsContext>;
