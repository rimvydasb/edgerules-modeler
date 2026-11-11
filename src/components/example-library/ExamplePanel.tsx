import {IconCopy, IconExternalLink, IconInfoCircle} from '@tabler/icons-react';
import type {KeyboardEvent, ReactElement} from 'react';
import {
    SheetAction,
    SheetActions,
    SheetBody,
    SheetChip,
    SheetDescription,
    SheetFooter,
    SheetMeta,
    SheetPanel,
    SheetPanelHeader,
    SheetTokens,
    sheetClasses,
} from '#ui/sheet';
import type {WorkspaceStatus} from './libraryQuery';
import type {LibraryEntry} from './types';

const MAX_FEATURES = 3; // the default number of feature tags on a card

export interface ExamplePanelProps {
    entry: LibraryEntry;
    industryTitle: string;
    industryIcon?: string; // kept for the hosts; the card shows the industry as a text label
    status: WorkspaceStatus;
    copies?: number; // the number of workspace copies of the example
    incompatible?: boolean; // the loaded engine is outside the engine range of the example
    thumbnailUrl?: string;
    maxTags?: number; // feature tags shown before "+N"; default 3
    busy?: boolean; // "Copy and open" is loading the files
    tabIndex?: 0 | -1;
    onCopyAndOpen: () => void;
    onOpenCopy?: () => void; // opens the newest workspace copy; shown when the workspace holds one
    onDetails: () => void;
}

/** The workspace status chip of an example: "✓ In workspace" or "Update available". */
export function WorkspaceChip({status, copies}: {status: WorkspaceStatus; copies?: number}): ReactElement | null {
    const count = copies !== undefined && copies > 1 ? ` · ${copies}` : '';
    if (status === 'in-workspace') return <SheetChip tone="green">✓ In workspace{count}</SheetChip>;
    if (status === 'update-available') return <SheetChip tone="yellow">Update available{count}</SheetChip>;
    return null;
}

/**
 * One example in the gallery: the industry icon square on the level color, name and workspace status in the header
 * row; description, features and metadata in the body; one action cell per action. An example that the workspace
 * holds offers "Open copy" first, so a second copy is a deliberate "Copy again".
 */
export function ExamplePanel({
    entry,
    industryTitle,
    status,
    copies,
    incompatible,
    thumbnailUrl,
    maxTags = MAX_FEATURES,
    busy,
    tabIndex = 0,
    onCopyAndOpen,
    onOpenCopy,
    onDetails,
}: ExamplePanelProps): ReactElement {
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        // Enter on the panel itself opens the details; Enter on a button inside it keeps its own action.
        if (event.key === 'Enter' && event.target === event.currentTarget) onDetails();
    };
    const inWorkspace = status !== 'none' && onOpenCopy !== undefined;
    const newest = entry.versions[0]?.version;

    return (
        <SheetPanel
            tabIndex={tabIndex}
            aria-label={entry.name}
            data-testid="example-panel"
            data-example-id={entry.id}
            data-workspace-status={status}
            onKeyDown={onKeyDown}
        >
            <SheetPanelHeader
                eyebrow={industryTitle}
                title={
                    <button type="button" role="link" className={sheetClasses.titleLink} onClick={onDetails}>
                        <span className={sheetClasses.titleText}>{entry.name}</span>
                    </button>
                }
                aside={<WorkspaceChip status={status} copies={copies} />}
            />
            {thumbnailUrl && <img className={sheetClasses.thumbnail} src={thumbnailUrl} alt="" loading="lazy" />}
            <SheetBody>
                <SheetDescription>{entry.description}</SheetDescription>
                <SheetTokens items={entry.features} max={maxTags} />
            </SheetBody>
            <SheetFooter>
                <SheetMeta>
                    {newest && <span>v{newest}</span>}
                    {entry.stats?.tests !== undefined && <span>{entry.stats.tests} tests</span>}
                    {incompatible && <SheetChip tone="red">Needs engine {entry.engine}</SheetChip>}
                </SheetMeta>
                <SheetActions>
                    {inWorkspace ? (
                        <>
                            <SheetAction icon={<IconExternalLink size={13} />} onClick={onOpenCopy}>
                                Open copy
                            </SheetAction>
                            <SheetAction busy={busy} iconOnly icon={<IconCopy size={14} />} onClick={onCopyAndOpen}>
                                {status === 'update-available' ? 'Copy newest' : 'Copy again'}
                            </SheetAction>
                        </>
                    ) : (
                        <SheetAction primary busy={busy} icon={<IconCopy size={13} />} onClick={onCopyAndOpen}>
                            Copy and open
                        </SheetAction>
                    )}
                    <SheetAction iconOnly icon={<IconInfoCircle size={15} />} onClick={onDetails}>
                        Details
                    </SheetAction>
                </SheetActions>
            </SheetFooter>
        </SheetPanel>
    );
}
