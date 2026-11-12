import {useSyncExternalStore, type ReactElement} from 'react';
import {Alert, Code, Popover, Stack, Switch, Text, VisuallyHidden} from '@mantine/core';
import {IconAlertTriangle, IconHelpCircle} from '@tabler/icons-react';
import {getModelContext} from '../../../src/components/webmcp';
import * as classes from './modelerHost.module.css';

const STORAGE_KEY = 'edgerules-agent-tools';
export const WEBMCP_FLAG = 'chrome://flags/#enable-webmcp-testing';

// The choice of the user, shared by the top bar and the project page. On unless the user turned it off; kept per
// browser.
const listeners = new Set<() => void>();
let enabled = readEnabled();

function readEnabled(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

function setEnabled(next: boolean): void {
    enabled = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
        // The choice then lasts until the page closes.
    }
    for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Whether the browser has WebMCP: `document.modelContext`, only with the Chrome flag and in a secure context. */
export function useWebMcpSupported(): boolean {
    return getModelContext() !== undefined;
}

/** Whether the project tools are registered: the browser has WebMCP and the user did not turn it off. */
export function useAgentToolsEnabled(): boolean {
    const chosen = useSyncExternalStore(subscribe, () => enabled);
    return useWebMcpSupported() && chosen;
}

// For an agent that reads the page text. A browser agent without WebMCP support lists the tools with JavaScript, and its
// output limit can cut a full `getTools()` dump short: names only fit, and `get-project-overview` indexes every tool.
export const AGENT_HINT =
    'Agent tools of the open project: list their names with ' +
    '(await document.modelContext.getTools()).map((t) => t.name), then call get-project-overview first; ' +
    'its tools member says what each tool does. Use read-source and search-model to read the model, and ' +
    'run-tests to run the tests.';

function UnsupportedWarning(): ReactElement {
    return (
        <Alert color="orange" variant="light" p="xs" title="WebMCP is off in this browser" data-testid="webmcp-warning">
            <Stack gap={6}>
                <Text size="xs">
                    The Modeler cannot offer its tools to an agent because this browser has no WebMCP. To turn it on in
                    Chrome:
                </Text>
                <Text size="xs" component="ol" pl="md" m={0}>
                    <li>
                        Open <Code>{WEBMCP_FLAG}</Code>.
                    </li>
                    <li>Set the flag to Enabled.</li>
                    <li>Restart Chrome and reload this page.</li>
                </Text>
                <Text size="xs">
                    WebMCP also needs a secure page: https or localhost. Other browsers do not have WebMCP yet.
                </Text>
            </Stack>
        </Alert>
    );
}

function WebMcpHelp({supported}: {supported: boolean}): ReactElement {
    return (
        <Popover position="bottom-end" width={340} shadow="md" withArrow>
            <Popover.Target>
                <button
                    type="button"
                    className={classes.webMcpHelp}
                    data-warn={supported ? undefined : true}
                    aria-label={supported ? 'About WebMCP' : 'WebMCP is off in this browser'}
                    title={supported ? 'About WebMCP' : 'WebMCP is off in this browser'}
                    data-testid="webmcp-help"
                >
                    {supported ? (
                        <IconHelpCircle size={16} aria-hidden="true" />
                    ) : (
                        <IconAlertTriangle size={16} aria-hidden="true" />
                    )}
                </button>
            </Popover.Target>
            <Popover.Dropdown aria-label="About WebMCP" data-testid="webmcp-help-panel">
                <Stack gap={8}>
                    <Text fw={600} size="sm">
                        WebMCP (experimental)
                    </Text>
                    {!supported && <UnsupportedWarning />}
                    <Text size="xs">
                        WebMCP lets an AI agent in this browser, for example Claude in Chrome, work on the open project
                        through tools: read the model, run the tests, and change rules, tests and documentation.
                    </Text>
                    <Text size="xs">
                        Each agent change shows in a notice with Undo. Changes stay unsaved until you save the project:
                        the agent cannot save.
                    </Text>
                    <Text size="xs">
                        While WebMCP is on, any agent in this browser can read and change the open project. Turn it off
                        when you do not use an agent.
                    </Text>
                    <Text size="xs" c="dimmed">
                        This feature is experimental. WebMCP is an early web standard and Chrome supports it only behind
                        a flag, so it can change or stop working in a new browser version.
                    </Text>
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
}

/**
 * The opt-in of the WebMCP tools in the top bar: "WebMCP" with a switch and a help button. The switch is disabled when
 * the browser has no WebMCP, and the help button then shows how to turn on the Chrome flag.
 */
export function WebMcpToggle(): ReactElement {
    const supported = useWebMcpSupported();
    const chosen = useSyncExternalStore(subscribe, () => enabled);
    const on = supported && chosen;
    return (
        <div className={classes.webMcp} data-testid="webmcp-toggle">
            <Switch
                size="xs"
                label="WebMCP"
                labelPosition="left"
                checked={on}
                disabled={!supported}
                onChange={(event) => setEnabled(event.currentTarget.checked)}
                classNames={{label: classes.webMcpLabel}}
            />
            <WebMcpHelp supported={supported} />
            {on && <VisuallyHidden data-testid="agent-tools-hint">{AGENT_HINT}</VisuallyHidden>}
        </div>
    );
}
