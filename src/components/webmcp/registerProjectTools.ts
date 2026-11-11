import {createToolQueue} from './platform/toolQueue';
import {createToolRegistry} from './platform/toolRegistry';
import {createProjectToolsContext} from './project/projectToolsContext';
import type {ToolAvailabilityFlags} from './protocol/toolDefinition';
import {TOOL_CATALOG} from './tools/toolCatalog';
import type {ProjectToolsHandle, ProjectToolsOptions} from './webmcp-types';

const INACTIVE_HANDLE: ProjectToolsHandle = {
    active: false,
    setReadOnly: () => {},
    setAllowSave: () => {},
    dispose: () => {},
};

/**
 * Registers the tools of the open project with WebMCP. The host calls it once after it opens a `ProjectSession` and
 * calls `dispose` before it closes the session. Does nothing and returns an inactive handle when `modelContext` is
 * undefined. The first regression run starts at once; its result is the first baseline, and every tool call waits for
 * it.
 */
export function registerProjectTools(options: ProjectToolsOptions): ProjectToolsHandle {
    const {modelContext, session} = options;
    if (modelContext === undefined) return INACTIVE_HANDLE;

    const flags: ToolAvailabilityFlags = {
        readOnly: options.readOnly ?? false,
        navigation: options.navigation !== undefined,
        allowSave: options.allowSave ?? false,
    };
    const context = createProjectToolsContext(session);
    const queue = createToolQueue();
    const registry = createToolRegistry({modelContext, tools: TOOL_CATALOG, context, queue});
    registry.sync(flags);
    queue.run(() => context.regression.runAll(registry.signal)).catch(() => undefined);

    return {
        active: true,
        setReadOnly(readOnly) {
            flags.readOnly = readOnly;
            registry.sync(flags);
        },
        setAllowSave(allowSave) {
            flags.allowSave = allowSave;
            registry.sync(flags);
        },
        dispose: () => registry.dispose(),
    };
}
