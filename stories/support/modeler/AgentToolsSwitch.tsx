import {useState, type ReactElement} from 'react';
import {Switch, Text} from '@mantine/core';
import {getModelContext} from '../../../src/components/webmcp';
import * as classes from './modelerHost.module.css';

const STORAGE_KEY = 'edgerules-agent-tools';

function readEnabled(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
        return false;
    }
}

/** Whether the user allowed agents to use the project tools. Off until the user turns it on; kept per browser. */
export function useAgentToolsEnabled(): [boolean, (enabled: boolean) => void] {
    const [enabled, setEnabled] = useState(readEnabled);
    const update = (next: boolean): void => {
        setEnabled(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
        } catch {
            // The choice then lasts until the page closes.
        }
    };
    return [enabled, update];
}

interface AgentToolsSwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

/** The opt-in of the WebMCP tools: any agent in the browser that reads the tool list can then change the project. */
export function AgentToolsSwitch({enabled, onChange}: AgentToolsSwitchProps): ReactElement {
    const supported = getModelContext() !== undefined;
    return (
        <div className={classes.agentTools} data-testid="agent-tools-switch">
            <Switch
                size="xs"
                label="Agent tools"
                checked={enabled}
                onChange={(event) => onChange(event.currentTarget.checked)}
            />
            <Text size="xs" c="dimmed" data-testid="agent-tools-status">
                {!supported
                    ? 'No WebMCP in this browser (chrome://flags/#enable-webmcp-testing).'
                    : enabled
                      ? 'On: an agent in the browser can read and change this project.'
                      : 'Off: no agent can see this project.'}
            </Text>
        </div>
    );
}
