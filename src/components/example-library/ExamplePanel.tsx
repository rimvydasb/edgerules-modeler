import {Badge, Button, Card, Group, Text} from '@mantine/core';
import type {KeyboardEvent, ReactElement} from 'react';
import type {WorkspaceStatus} from './libraryQuery';
import type {LibraryEntry} from './types';

const MAX_FEATURES = 3;

export interface ExamplePanelProps {
    entry: LibraryEntry;
    industryTitle: string;
    status: WorkspaceStatus;
    incompatible?: boolean; // the loaded engine is outside the engine range of the example
    thumbnailUrl?: string;
    busy?: boolean; // "Copy and open" is loading the files
    tabIndex?: 0 | -1;
    onCopyAndOpen: () => void;
    onDetails: () => void;
}

/** One example in the gallery: thumbnail, industry, level, name, description, features, badge and the two actions. */
export function ExamplePanel({
    entry,
    industryTitle,
    status,
    incompatible,
    thumbnailUrl,
    busy,
    tabIndex = 0,
    onCopyAndOpen,
    onDetails,
}: ExamplePanelProps): ReactElement {
    const extra = entry.features.length - MAX_FEATURES;
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        // Enter on the panel itself opens the details; Enter on a button inside it keeps its own action.
        if (event.key === 'Enter' && event.target === event.currentTarget) onDetails();
    };

    return (
        <Card
            withBorder
            padding="sm"
            h="100%"
            tabIndex={tabIndex}
            aria-label={entry.name}
            data-testid="example-panel"
            data-example-id={entry.id}
            onKeyDown={onKeyDown}
        >
            {thumbnailUrl && (
                <img
                    src={thumbnailUrl}
                    alt=""
                    loading="lazy"
                    style={{width: '100%', height: 90, objectFit: 'cover', borderRadius: 4}}
                />
            )}
            <Text size="xs" c="dimmed" mt={4}>
                {industryTitle} · {entry.level}
            </Text>
            <Text fw={600} truncate>
                {entry.name}
            </Text>
            <Text size="sm" c="dimmed" lineClamp={2}>
                {entry.description}
            </Text>
            <Text size="xs" c="dimmed" mt={4} truncate>
                {entry.features.slice(0, MAX_FEATURES).join(', ')}
                {extra > 0 && ` +${extra}`}
            </Text>
            <Group gap={4} mt={4} mih={20}>
                {status === 'in-workspace' && (
                    <Badge size="xs" color="green" variant="light">
                        ✓ In workspace
                    </Badge>
                )}
                {status === 'update-available' && (
                    <Badge size="xs" color="yellow" variant="light">
                        Update available
                    </Badge>
                )}
                {incompatible && (
                    <Badge size="xs" color="red" variant="light">
                        Needs engine {entry.engine}
                    </Badge>
                )}
            </Group>
            <Group gap="xs" mt="auto" pt="xs">
                <Button size="compact-sm" loading={busy} onClick={onCopyAndOpen}>
                    Copy and open
                </Button>
                <Button size="compact-sm" variant="default" onClick={onDetails}>
                    Details
                </Button>
            </Group>
        </Card>
    );
}
