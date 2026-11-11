import type {ProjectSession} from '../../project-session';
import {createRegressionMonitor, type RegressionMonitor} from './regression/regressionMonitor';

/**
 * Everything a tool can reach. A tool calls one method of one service and never sees the `ProjectSession`.
 * Phase 2 adds `changes` (ProjectChangeService), Phase 3 `inspector` and `guide`, Phase 4 `host`.
 */
export interface ProjectToolsContext {
    regression: RegressionMonitor;
}

export function createProjectToolsContext(session: ProjectSession): ProjectToolsContext {
    return {regression: createRegressionMonitor(session)};
}
