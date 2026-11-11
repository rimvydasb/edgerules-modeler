import type {ProjectSession} from '../../project-session';
import {createProjectChangeService, type ProjectChangeService} from './changes/projectChangeService';
import {createLanguageGuide, type LanguageGuide} from './guide/languageGuide';
import {createProjectInspector, type InspectionHostState, type ProjectInspector} from './inspection/projectInspector';
import {createRegressionMonitor, type RegressionMonitor} from './regression/regressionMonitor';

/**
 * Everything a tool can reach. A tool calls one method of one service and never sees the `ProjectSession`.
 * Phase 4 adds `host`.
 */
export interface ProjectToolsContext {
    changes: ProjectChangeService;
    regression: RegressionMonitor;
    inspector: ProjectInspector;
    guide: LanguageGuide;
}

/** `host` supplies what the session does not know: read-only, save and focus. It is read at each call. */
export function createProjectToolsContext(
    session: ProjectSession,
    host: () => InspectionHostState = () => ({readOnly: false, canSave: false}),
): ProjectToolsContext {
    const regression = createRegressionMonitor(session);
    return {
        changes: createProjectChangeService(session, regression),
        regression,
        inspector: createProjectInspector(session, regression, host),
        guide: createLanguageGuide(),
    };
}
