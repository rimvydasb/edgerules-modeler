import {editModel} from './change/editModel';
import {editTests} from './change/editTests';
import {setDocumentation} from './change/setDocumentation';
import {undoAgentChange} from './change/undoAgentChange';
import {runTests} from './feedback/runTests';
import type {AnyProjectTool} from './projectTool';

/** Every tool, in catalog order (webmcp-story.md, "Tool catalog"). Later phases add the other tools. */
export const TOOL_CATALOG: readonly AnyProjectTool[] = [
    editModel,
    editTests,
    setDocumentation,
    undoAgentChange,
    runTests,
];
