import {Loader} from '@mantine/core';
import {Fragment, type ButtonHTMLAttributes, type HTMLAttributes, type ReactElement, type ReactNode} from 'react';
import {projectInitials} from '#lib/projectInitials';
import {cx} from '../cx';
import * as classes from './sheet.module.css';

/*
 * Primitives of the ruled sheet that the page-level components share (Library, Workspace, Home). They follow the
 * Shell header and the Boxed Editor: 40px header rows on a muted fill, a colored icon square per kind, 1px lines and
 * one cell per action.
 */

export {classes as sheetClasses};

type DivProps = HTMLAttributes<HTMLDivElement> & {[data: `data-${string}`]: string | undefined};

/** A colored icon square: white glyph on the kind color, or a muted glyph without one. */
export function SheetIcon({color, children}: {color?: string; children: ReactNode}): ReactElement {
    return (
        <span
            className={cx(classes.icon, !color && classes.iconMuted)}
            style={color ? {backgroundColor: color} : undefined}
            aria-hidden="true"
        >
            {children}
        </span>
    );
}

/** A bordered panel: a header row, an optional body and a row of action cells. */
export function SheetPanel({className, children, ...rest}: DivProps): ReactElement {
    return (
        <div {...rest} className={cx(classes.panel, className)}>
            {children}
        </div>
    );
}

export interface SheetPanelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    [data: `data-${string}`]: string | undefined;
}

/** A panel that is one button as a whole: a recent project, an industry tile. */
export function SheetPanelButton({className, children, ...rest}: SheetPanelButtonProps): ReactElement {
    return (
        <button type="button" {...rest} className={cx(classes.panel, classes.panelButton, className)}>
            {children}
        </button>
    );
}

export interface SheetPanelHeaderProps {
    icon?: ReactNode; // the glyph of the icon square
    iconColor?: string; // the kind color of the icon square; muted without it
    eyebrow?: ReactNode; // the monospace label above the title: the industry of an example
    title: ReactNode;
    aside?: ReactNode; // chips, counts or a menu at the right end of the row
    only?: boolean; // the panel is this header row only: a compact tile
}

export function SheetPanelHeader({icon, iconColor, eyebrow, title, aside, only}: SheetPanelHeaderProps): ReactElement {
    return (
        <div className={cx(classes.panelHeader, only && classes.panelHeaderOnly)}>
            {icon && <SheetIcon color={iconColor}>{icon}</SheetIcon>}
            {eyebrow !== undefined && <span className={classes.eyebrow}>{eyebrow}</span>}
            {eyebrow !== undefined && aside && <div className={classes.aside}>{aside}</div>}
            <div className={classes.title}>
                {typeof title === 'string' ? <span className={classes.titleText}>{title}</span> : title}
            </div>
            {eyebrow === undefined && aside && <div className={classes.aside}>{aside}</div>}
        </div>
    );
}

/** The short mark of a project (its initials) in place of an icon. */
export function SheetProjectMark({name, size = 'md'}: {name: string; size?: 'xs' | 'sm' | 'md'}): ReactElement {
    return (
        <span
            className={cx(classes.projectMark, size !== 'md' && classes[`projectMark_${size}`])}
            data-initials={projectInitials(name)}
            aria-hidden="true"
        />
    );
}

export function SheetBody({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.body}>{children}</div>;
}

export function SheetDescription({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.description}>{children}</div>;
}

export function SheetMeta({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.meta}>{children}</div>;
}

/** The footer row of a card: the metadata on the left, the actions (shown on hover) on the right. */
export function SheetFooter({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.footer}>{children}</div>;
}

/** Monospace tokens: features of an example, `id@version` coordinates. Shows `+N` past `max`. */
export function SheetTokens({items, max}: {items: readonly string[]; max?: number}): ReactElement {
    const shown = max === undefined ? items : items.slice(0, max);
    const extra = items.length - shown.length;
    return (
        <div className={classes.tags}>
            {shown.map((item) => (
                <span key={item} className={classes.token}>
                    {item}
                </span>
            ))}
            {extra > 0 && <span className={cx(classes.token, classes.tokenMore)}>+{extra}</span>}
        </div>
    );
}

export function SheetToken({children}: {children: ReactNode}): ReactElement {
    return <span className={classes.token}>{children}</span>;
}

export type SheetChipTone = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

const CHIP_TONES: Record<SheetChipTone, string> = {
    green: classes.chipGreen,
    yellow: classes.chipYellow,
    orange: classes.chipOrange,
    red: classes.chipRed,
    gray: classes.chipGray,
};

/** A small status chip: "✓ In workspace", "Update available". */
export function SheetChip({tone, children}: {tone: SheetChipTone; children: ReactNode}): ReactElement {
    return <span className={cx(classes.chip, CHIP_TONES[tone])}>{children}</span>;
}

/** The row of action cells at the bottom of a panel. */
export function SheetActions({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.actions}>{children}</div>;
}

export interface SheetActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    primary?: boolean;
    busy?: boolean; // shows a loader and blocks a second click
    icon?: ReactNode;
    iconOnly?: boolean; // a 40px square with the icon; the label is the accessible name and the tooltip
}

/** One action cell. */
export function SheetAction({
    primary,
    busy,
    icon,
    iconOnly,
    children,
    className,
    disabled,
    ...rest
}: SheetActionProps): ReactElement {
    const label = iconOnly && typeof children === 'string' ? children : undefined;
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            {...rest}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
            className={cx(
                classes.action,
                primary && classes.actionPrimary,
                iconOnly && classes.actionIconOnly,
                className,
            )}
        >
            {busy ? <Loader size={12} /> : icon}
            {!iconOnly && <span className={classes.actionLabel}>{children}</span>}
        </button>
    );
}

export interface SheetPageHeaderProps {
    icon?: ReactNode;
    iconColor?: string;
    title: ReactNode;
    subtitle?: ReactNode;
    aside?: ReactNode; // right end of the title row
    eyebrow?: ReactNode; // the monospace label above the title
    children?: ReactNode; // rows under the title row: a SheetToolbar or SheetPageActions
}

/** The header block of a page: a title row with the kind icon square, then a toolbar or a row of page actions. */
export function SheetPageHeader({
    icon,
    iconColor,
    title,
    subtitle,
    aside,
    eyebrow,
    children,
}: SheetPageHeaderProps): ReactElement {
    return (
        <header className={classes.pageHeader}>
            <div className={classes.pageHeaderRow}>
                {icon && <SheetIcon color={iconColor}>{icon}</SheetIcon>}
                <div className={classes.pageTitle}>
                    {eyebrow !== undefined && <div className={classes.eyebrow}>{eyebrow}</div>}
                    <h2 className={classes.pageTitleText}>{title}</h2>
                    {subtitle && <div className={classes.pageSubtitle}>{subtitle}</div>}
                </div>
                {aside && <div className={classes.pageAside}>{aside}</div>}
            </div>
            {children}
        </header>
    );
}

export function SheetToolbar({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.toolbar}>{children}</div>;
}

export function SheetPageActions({children}: {children: ReactNode}): ReactElement {
    return <div className={classes.pageActions}>{children}</div>;
}

export interface SheetSectionProps {
    label: string;
    count?: number;
    actions?: ReactNode;
    children: ReactNode;
    'aria-label'?: string; // the region name; defaults to the label
    'data-testid'?: string;
}

/** A page section: an uppercase label with a count, like the sections of the Project Explorer. */
export function SheetSection({
    label,
    count,
    actions,
    children,
    'aria-label': ariaLabel,
    'data-testid': testId,
}: SheetSectionProps): ReactElement {
    return (
        <section className={classes.section} aria-label={ariaLabel ?? label} data-testid={testId}>
            <div className={classes.sectionHeader}>
                <h3 className={classes.sectionLabel}>{label}</h3>
                {count !== undefined && <span className={classes.sectionCount}>{count}</span>}
                {actions && <div className={classes.sectionActions}>{actions}</div>}
            </div>
            {children}
        </section>
    );
}

export function SheetLinkButton({className, ...rest}: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
    return <button type="button" {...rest} className={cx(classes.linkButton, className)} />;
}

/** Label and value rows on the ruled sheet: the metadata of an example. */
export function SheetKeyValues({
    rows,
    'aria-label': ariaLabel,
}: {
    rows: readonly (readonly [string, ReactNode])[];
    'aria-label'?: string;
}): ReactElement {
    return (
        <dl className={classes.keyValues} aria-label={ariaLabel}>
            {rows.map(([label, value]) => (
                <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </Fragment>
            ))}
        </dl>
    );
}

/** A grid of panels. `fourUp` keeps four columns on a wide screen, so a row of four never leaves an orphan. */
export function SheetGrid({
    compact,
    fourUp,
    children,
    className,
    ...rest
}: DivProps & {compact?: boolean; fourUp?: boolean}): ReactElement {
    return (
        <div
            {...rest}
            className={cx(classes.grid, compact && classes.gridCompact, fourUp && classes.gridFour, className)}
        >
            {children}
        </div>
    );
}

export function SheetEmpty({children, ...rest}: DivProps): ReactElement {
    return (
        <div {...rest} className={classes.empty}>
            {children}
        </div>
    );
}
