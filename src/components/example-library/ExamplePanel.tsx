import {IconCopy, IconExternalLink, IconInfoCircle, IconPlayerPlay} from '@tabler/icons-react';
import type {KeyboardEvent, ReactElement} from 'react';
import {
    SheetAction,
    SheetActions,
    SheetBody,
    SheetChip,
    SheetDescription,
    SheetMeta,
    SheetPanel,
    SheetPanelHeader,
    SheetTokens,
    sheetClasses,
} from '#ui/sheet';
import {IndustryIcon} from './industryIcon';
import {LEVEL_COLORS, LEVEL_LABELS} from './levels';
import type {WorkspaceStatus} from './libraryQuery';
import type {LibraryEntry} from './types';

const MAX_FEATURES = 3;

export interface ExamplePanelProps {
    entry: LibraryEntry;
    industryTitle: string;
    industryIcon?: string;
    status: WorkspaceStatus;
    copies?: number; // the number of workspace copies of the example
    incompatible?: boolean; // the loaded engine is outside the engine range of the example
    thumbnailUrl?: string;
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
    industryIcon,
    status,
    copies,
    incompatible,
    thumbnailUrl,
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
                icon={<IndustryIcon name={industryIcon ?? entry.industry} size={19} />}
                iconColor={LEVEL_COLORS[entry.level]}
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
                <SheetTokens items={entry.features} max={MAX_FEATURES} />
                <SheetMeta>
                    <span>{industryTitle}</span>
                    <span>{LEVEL_LABELS[entry.level]}</span>
                    {newest && <span>v{newest}</span>}
                    {entry.stats?.tests !== undefined && <span>{entry.stats.tests} tests</span>}
                    {incompatible && <SheetChip tone="red">Needs engine {entry.engine}</SheetChip>}
                </SheetMeta>
            </SheetBody>
            <SheetActions>
                {inWorkspace ? (
                    <>
                        <SheetAction primary icon={<IconExternalLink size={14} />} onClick={onOpenCopy}>
                            Open copy
                        </SheetAction>
                        <SheetAction busy={busy} icon={<IconCopy size={14} />} onClick={onCopyAndOpen}>
                            {status === 'update-available' ? 'Copy newest' : 'Copy again'}
                        </SheetAction>
                    </>
                ) : (
                    <SheetAction primary busy={busy} icon={<IconPlayerPlay size={14} />} onClick={onCopyAndOpen}>
                        Copy and open
                    </SheetAction>
                )}
                <SheetAction
                    iconOnly={inWorkspace}
                    icon={<IconInfoCircle size={inWorkspace ? 16 : 14} />}
                    onClick={onDetails}
                >
                    Details
                </SheetAction>
            </SheetActions>
        </SheetPanel>
    );
}
