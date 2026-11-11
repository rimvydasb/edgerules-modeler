import {createToolQueue} from './platform/toolQueue';
import {createToolRegistry} from './platform/toolRegistry';
import {createProjectHostActions} from './project/projectHostActions';
import {createProjectToolsContext} from './project/projectToolsContext';
import type {ToolAvailabilityFlags} from './protocol/toolDefinition';
import {TOOL_CATALOG} from './tools/toolCatalog';
import type {ProjectToolsActivity, ProjectToolsHandle, ProjectToolsOptions} from './webmcp-types';

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
    const {navigation} = options;
    const canSave = () => flags.allowSave && !flags.readOnly;
    const context = createProjectToolsContext(
        session,
        () => ({readOnly: flags.readOnly, canSave: canSave(), ...(navigation && {focus: navigation.getFocus()})}),
        createProjectHostActions(session, navigation, canSave),
    );
    const queue = createToolQueue();
    const presence = createPresence();
    const registry = createToolRegistry({
        modelContext,
        tools: TOOL_CATALOG,
        context,
        queue,
        onRunning: presence.set,
    });
    registry.sync(flags);
    queue.run(() => context.regression.runAll(registry.signal)).catch(() => undefined);

    const log = context.changes.activity;
    const activity: ProjectToolsActivity = {
        list: () => log.list(),
        canUndo: (changeId) => log.canUndo(changeId),
        // A Shell undo is a change like a tool call: it waits for the running call and follows `dispose`.
        undo: (changeId, signal) =>
            queue.run(() => log.undo(changeId, signal ? AbortSignal.any([signal, registry.signal]) : registry.signal)),
        running: presence.get,
        subscribe(listener) {
            const offLog = log.subscribe(listener);
            const offPresence = presence.subscribe(listener);
            return () => {
                offLog();
                offPresence();
            };
        },
    };

    return {
        active: true,
        activity,
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

// The tool call that runs now. Calls run one at a time through `ToolQueue`, so one name is enough.
function createPresence() {
    let current: string | undefined;
    const listeners = new Set<() => void>();
    return {
        get: () => current,
        set(name: string, running: boolean) {
            const next = running ? name : current === name ? undefined : current;
            if (next === current) return;
            current = next;
            for (const listener of [...listeners]) listener();
        },
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
