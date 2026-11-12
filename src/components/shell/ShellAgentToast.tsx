import {Button, Group, Loader, Text} from '@mantine/core';
import {useEffect, useReducer, useRef, useState, type ReactElement} from 'react';
import {Toast} from '#ui/Toast';
import type {ShellAgentActivity, ShellAgentChange} from './shell-types';
import * as classes from './shell.module.css';

/** The re-render on each notification of the activity, and the tool that runs now. */
function useActivity(activity: ShellAgentActivity | undefined): string | undefined {
    const [, refresh] = useReducer((tick: number) => tick + 1, 0);
    useEffect(() => activity?.subscribe(refresh), [activity]);
    return activity?.running?.();
}

/** "Companion is working" while a tool of the agent runs. */
export function ShellAgentWorking({activity}: {activity: ShellAgentActivity | undefined}): ReactElement | null {
    const running = useActivity(activity);
    if (running === undefined) return null;
    return (
        <div className={classes.agentWorking} role="status" data-testid="shell-agent-working" title={running}>
            <Loader size={12} />
            <span>Companion is working</span>
        </div>
    );
}

function totalsOf(change: ShellAgentChange): string {
    const {regression} = change;
    if (!regression) return 'Running the tests…';
    if (regression.passed === undefined)
        return regression.failed === 0 ? 'All tests pass' : `${regression.failed} failed`;
    return `Tests: ${regression.passed} passed, ${regression.failed} failed`;
}

function failureOf(result: unknown): string | undefined {
    if (typeof result !== 'object' || result === null || (result as {ok?: unknown}).ok !== false) return undefined;
    const message = (result as {error?: {message?: unknown}}).error?.message;
    return typeof message === 'string' ? message : 'The undo failed.';
}

export interface ShellAgentToastProps {
    activity: ShellAgentActivity;
    onShow: (target: string) => void; // opens a target of the change in its default view
}

/**
 * A toast for each new agent change: its summary, the regression totals, "Undo" while the change can be undone, and
 * "Show". The changes that the log holds when the Shell mounts get no toast; an undo from the toast closes it.
 */
export function ShellAgentToast({activity, onShow}: ShellAgentToastProps): ReactElement | null {
    useActivity(activity);
    const seen = useRef<Set<string> | undefined>(undefined);
    seen.current ??= new Set(activity.list().map((change) => change.changeId));
    const undone = useRef(new Set<string>());
    const [shown, setShown] = useState<string>();
    const [failure, setFailure] = useState<string>();

    const newest = activity.list()[0];
    useEffect(() => {
        if (!newest || seen.current!.has(newest.changeId)) return;
        seen.current!.add(newest.changeId);
        setFailure(undefined);
        // The undo that the user started from the toast needs no toast of its own.
        setShown(newest.reverts !== undefined && undone.current.has(newest.reverts) ? undefined : newest.changeId);
    }, [newest]);

    const change = shown === undefined ? undefined : activity.list().find((entry) => entry.changeId === shown);
    if (failure !== undefined)
        return <Toast open message={failure} onClose={() => setFailure(undefined)} autoHideDuration={8000} />;
    if (!change) return null;

    const undo = () => {
        undone.current.add(change.changeId);
        setShown(undefined);
        activity.undo(change.changeId).then(
            (result) => setFailure(failureOf(result)),
            (error: unknown) => setFailure(error instanceof Error ? error.message : String(error)),
        );
    };
    const target = change.targets[0];

    return (
        <Toast
            key={change.changeId}
            open
            onClose={() => setShown(undefined)}
            message={
                <div data-testid="shell-agent-toast">
                    <Text size="sm" fw={600}>
                        {change.summary}
                    </Text>
                    <Text size="xs" c="dimmed" data-testid="shell-agent-totals">
                        {totalsOf(change)}
                    </Text>
                </div>
            }
            action={
                <Group gap="xs">
                    {activity.canUndo(change.changeId) && (
                        <Button size="compact-xs" variant="light" onClick={undo}>
                            Undo
                        </Button>
                    )}
                    {target !== undefined && (
                        <Button size="compact-xs" variant="subtle" onClick={() => onShow(target)}>
                            Show
                        </Button>
                    )}
                </Group>
            }
        />
    );
}
