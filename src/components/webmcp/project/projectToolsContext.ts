import type {ProjectSession} from '../../project-session';
import {createProjectChangeService, type ProjectChangeService} from './changes/projectChangeService';
import {createLanguageGuide, type LanguageGuide} from './guide/languageGuide';
import {createProjectInspector, type InspectionHostState, type ProjectInspector} from './inspection/projectInspector';
import type {ProjectHostActions} from './projectHostActions';
import {createRegressionMonitor, type RegressionMonitor} from './regression/regressionMonitor';

/**
 * Everything a tool can reach. A tool calls one method of one service and never sees the `ProjectSession`.
 */
export interface ProjectToolsContext {
    changes: ProjectChangeService;
    regression: RegressionMonitor;
    inspector: ProjectInspector;
    guide: LanguageGuide;
    host: ProjectHostActions; // navigation and save, from the options of `registerProjectTools`
}

/**
 * `host` supplies what the session does not know: read-only, save and focus. It is read at each call. `actions` are
 * the host capabilities; none by default.
 */
export function createProjectToolsContext(
    session: ProjectSession,
    host: () => InspectionHostState = () => ({readOnly: false, canSave: false}),
    actions: ProjectHostActions = {},
): ProjectToolsContext {
    const regression = createRegressionMonitor(session);
    return {
        changes: createProjectChangeService(session, regression),
        regression,
        inspector: createProjectInspector(session, regression, host),
        guide: createLanguageGuide(),
        host: actions,
    };
}
