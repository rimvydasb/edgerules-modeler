import {editModel} from './change/editModel';
import {editTests} from './change/editTests';
import {setDocumentation} from './change/setDocumentation';
import {undoAgentChange} from './change/undoAgentChange';
import {runTests} from './feedback/runTests';
import {evaluateModel} from './inspect/evaluateModel';
import {listModelEntries} from './inspect/listModelEntries';
import {listTests} from './inspect/listTests';
import {readSource} from './inspect/readSource';
import {searchModel} from './inspect/searchModel';
import {getLanguageGuide} from './orient/getLanguageGuide';
import {getProjectOverview} from './orient/getProjectOverview';
import type {AnyProjectTool} from './projectTool';

/** Every tool, in catalog order (webmcp-story.md, "Tool catalog"). Phase 4 adds the host tools. */
export const TOOL_CATALOG: readonly AnyProjectTool[] = [
    editModel,
    editTests,
    setDocumentation,
    undoAgentChange,
    runTests,
    getProjectOverview,
    getLanguageGuide,
    listModelEntries,
    readSource,
    searchModel,
    listTests,
    evaluateModel,
];
