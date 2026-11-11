import type {ProjectSession} from '../../project-session';
import {createProjectChangeService, type ProjectChangeService} from './changes/projectChangeService';
import {createRegressionMonitor, type RegressionMonitor} from './regression/regressionMonitor';

/**
 * Everything a tool can reach. A tool calls one method of one service and never sees the `ProjectSession`.
 * Phase 3 adds `inspector` and `guide`, Phase 4 `host`.
 */
export interface ProjectToolsContext {
    changes: ProjectChangeService;
    regression: RegressionMonitor;
}

export function createProjectToolsContext(session: ProjectSession): ProjectToolsContext {
    const regression = createRegressionMonitor(session);
    return {changes: createProjectChangeService(session, regression), regression};
}
