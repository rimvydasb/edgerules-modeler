import {runTests} from './feedback/runTests';
import type {AnyProjectTool} from './projectTool';

/** Every tool, in catalog order (webmcp-story.md, "Tool catalog"). Later phases add the other tools. */
export const TOOL_CATALOG: readonly AnyProjectTool[] = [runTests];
