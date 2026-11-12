import {IconArrowRight, IconArrowUp, IconBook2, IconLibrary, IconMathFunction, IconPlus} from '@tabler/icons-react';
import {useLayoutEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode} from 'react';
import {cx} from '#ui/cx';
import {KIND_COLORS} from '#ui/kindColors';
import {sheetClasses} from '#ui/sheet';
import {savedAgo} from '#lib/savedAgo';
import {MarkdownView} from '../../markdown-view';
import {CREATE_OPTIONS, CreateDialog} from '../../project-explorer/internal';
import type {ProjectOrigin} from '../../project-session';
import {README_FILE} from '../shell-path';
import type {TestsRunState, TestsSummary} from '../testsStatus';
import {RunAllButton, TestsBar, TestsCounts} from './TestsOverview';
import * as classes from '../shell.module.css';

/** One workbook of the model, as its panel shows it. */
export interface WorkbookSummary {
    path: string; // the field name of the workbook
    name?: string; // its `@Name` label
    description?: string; // from the documentation store
    inputs: number; // its `@InputNode` fields
    functions: number; // its `@FunctionNode` fields
}

/** One `service` declaration of the model, as its panel shows it. */
export interface ServiceSummary {
    path: string; // the fully qualified path of the function
    label: string; // `path(...)` when it has arguments, `path()` when it has none
    description?: string; // from the documentation store
    arguments: number;
}

/** One line of the model counts of the overview: "Types 3". */
export interface OverviewCount {
    label: string;
    count: number;
    color: string; // the kind color of its square
}

/** The project facts of the overview page: its header and its side column. */
export interface ProjectOverview {
    name: string; // the project name
    savedAt?: string; // ISO time of the last save
    origin?: ProjectOrigin; // the library example that the project is a copy of
    originStatus?: 'latest' | 'update-available';
    onShowOrigin?: (origin: ProjectOrigin) => void;
    counts: readonly OverviewCount[]; // the entities of the model by kind
    testSuites: number; // the test subjects that have tests
    tests?: TestsSummary; // the results of every test case, from the last run of each
    testsRun?: TestsRunState; // the run of all tests in progress
    onRunAllTests?: () => void; // "Run all" of the Tests card: runs every case of every subject in place
    onOpenTests?: () => void; // "All Tests" of the Tests card: the Tests Overview
}

export interface WorkbookPickerProps {
    overview?: ProjectOverview; // the header and the side column; without it the page is the panels only
    readme?: string; // the README Markdown; without it there is no README panel
    onOpenReadme?: () => void; // a click on the README panel
    onModelLink?: (path: string) => void; // a `model:` link of the README panel
    workbooks: readonly WorkbookSummary[];
    services: readonly ServiceSummary[];
    onSelect: (workbook: string) => void;
    onSelectService: (service: string) => void;
    // Creates a workbook of the name; an error message, or undefined on success. Without it there is no add panel.
    onCreate?: (name: string) => string | undefined;
    // Creates a service of the name; an error message, or undefined on success. Without it there is no add panel.
    onCreateService?: (name: string) => string | undefined;
    taken: ReadonlySet<string>; // the root names a new workbook or service must not take
}

const CREATE = {workbook: CREATE_OPTIONS.workbooks[0]!, service: CREATE_OPTIONS.services[0]!};
type Creating = keyof typeof CREATE;

/** The panel that creates a new entity: a dashed outline and a plus. */
function AddPanel({label, onClick, testId}: {label: string; onClick: () => void; testId: string}): ReactElement {
    return (
        <button type="button" className={classes.workbookAdd} onClick={onClick} aria-label={label} data-testid={testId}>
            <IconPlus aria-hidden="true" size={16} />
            {label}
        </button>
    );
}

function count(value: number, noun: string): string {
    return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

interface PanelProps {
    title: string;
    field?: string; // the field path under the title
    description?: string;
    icon: ReactNode;
    iconColor: string;
    footer: string;
    action: string;
    onClick: () => void;
    testId: string;
}

/** A workbook or a service method as a card: kind square, name, field name, description, and its counts in the footer. */
function Panel({
    title,
    field,
    description,
    icon,
    iconColor,
    footer,
    action,
    onClick,
    testId,
}: PanelProps): ReactElement {
    return (
        <button
            type="button"
            className={classes.workbookPanel}
            onClick={onClick}
            aria-label={title}
            aria-description={description}
            data-testid={testId}
        >
            <span className={classes.workbookHead}>
                <span className={classes.workbookIcon} style={{backgroundColor: iconColor}}>
                    {icon}
                </span>
                <span className={classes.workbookTitles}>
                    <span className={classes.workbookTitle}>{title}</span>
                    {field !== undefined && <code className={classes.workbookField}>{field}</code>}
                </span>
            </span>
            <span className={description ? classes.workbookDescription : classes.workbookNoDescription}>
                {description || 'No description'}
            </span>
            <span className={classes.workbookFooter}>
                <span>{footer}</span>
                <span className={classes.workbookOpen}>
                    {action}
                    <IconArrowRight aria-hidden="true" size={14} />
                </span>
            </span>
        </button>
    );
}

/**
 * The README panel: the README rendered, as wide as a row of three panels, at most two panels high. Content above the
 * maximum height is cut off with a fade. A click opens the README; a `model:` link in it opens its model path.
 */
function ReadmePanel({
    markdown,
    onOpen,
    onModelLink,
}: {
    markdown: string;
    onOpen?: () => void;
    onModelLink?: (path: string) => void;
}): ReactElement {
    const content = useRef<HTMLDivElement>(null);
    const [cut, setCut] = useState(false);
    // The fade shows only when the README is higher than the panel.
    useLayoutEffect(() => {
        const element = content.current;
        if (!element) return;
        const measure = () => setCut(element.scrollHeight > element.clientHeight + 1);
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        if (element.firstElementChild) observer.observe(element.firstElementChild);
        return () => observer.disconnect();
    }, [markdown]);
    // A link keeps its own action; any other click opens the README.
    const onClick = (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest('a')) return;
        onOpen?.();
    };
    return (
        <section className={classes.readmePanel} aria-label={README_FILE} data-testid="shell-readme-panel">
            {/* A pointer shortcut; the Open button is the keyboard action. */}
            <div
                ref={content}
                className={cx(classes.readmeContent, cut && classes.readmeContentCut)}
                onClick={onClick}
                data-cut={cut || undefined}
            >
                <MarkdownView markdown={markdown} onModelLink={onModelLink} />
            </div>
            <div className={classes.workbookFooter}>
                <span>{README_FILE}</span>
                <button type="button" className={classes.readmeOpen} onClick={onOpen}>
                    Read README
                    <IconArrowRight aria-hidden="true" size={14} />
                </button>
            </div>
        </section>
    );
}

/**
 * The overview page of the project, the Flow view of the model root: the project header, the README panel when the
 * model has a README, one card per service method and per workbook, each group with a card that creates a new one; the side column holds the model counts, the tests and the origin. A click on a card opens its flow.
 */
export function WorkbookPicker({
    overview,
    readme,
    onOpenReadme,
    onModelLink,
    workbooks,
    services,
    onSelect,
    onSelectService,
    onCreate,
    onCreateService,
    taken,
}: WorkbookPickerProps): ReactElement {
    const [creating, setCreating] = useState<Creating | undefined>();
    const create = creating === 'workbook' ? onCreate : creating === 'service' ? onCreateService : undefined;
    return (
        <div className={cx(sheetClasses.tokens, classes.workbooks)} data-testid="shell-workbook-picker">
            <div className={classes.overview}>
                {overview && (
                    <header className={classes.overviewHead}>
                        <div className={classes.overviewTitles}>
                            <div className={sheetClasses.eyebrow}>Project</div>
                            <h1 className={classes.overviewTitle}>{overview.name}</h1>
                            <div className={classes.overviewMeta}>
                                {overview.origin && (
                                    <button
                                        type="button"
                                        className={classes.overviewOrigin}
                                        disabled={!overview.onShowOrigin}
                                        onClick={() => overview.origin && overview.onShowOrigin?.(overview.origin)}
                                    >
                                        <IconLibrary aria-hidden="true" size={12} />
                                        from {overview.origin.id}@{overview.origin.version}
                                    </button>
                                )}
                                {!overview.origin && <span className={classes.overviewOrigin}>Own project</span>}
                                {overview.originStatus === 'update-available' && (
                                    <span className={classes.overviewUpdate}>
                                        <IconArrowUp aria-hidden="true" size={12} />
                                        Update available
                                    </span>
                                )}
                                {overview.savedAt && <span>{savedAgo(overview.savedAt)}</span>}
                            </div>
                        </div>
                    </header>
                )}
                <div className={overview ? classes.overviewGrid : undefined}>
                    <div className={classes.overviewMain}>
                        {readme !== undefined && (
                            <ReadmePanel markdown={readme} onOpen={onOpenReadme} onModelLink={onModelLink} />
                        )}
                        {(services.length > 0 || onCreateService) && (
                            <section className={classes.workbookGroup} aria-label="Service Methods">
                                <h2 className={classes.workbookGroupTitle}>
                                    Service Methods
                                    <span className={classes.workbookGroupCount}>{services.length}</span>
                                </h2>
                                <div className={classes.workbookPanels}>
                                    {services.map((service) => (
                                        <Panel
                                            key={service.path}
                                            title={service.label}
                                            description={service.description}
                                            icon={<IconMathFunction aria-hidden="true" size={18} color="#fff" />}
                                            iconColor={KIND_COLORS.service}
                                            footer={count(service.arguments, 'argument')}
                                            action="Open flow"
                                            onClick={() => onSelectService(service.path)}
                                            testId={`shell-service-${service.path}`}
                                        />
                                    ))}
                                    {onCreateService && (
                                        <AddPanel
                                            label="New service method"
                                            onClick={() => setCreating('service')}
                                            testId="shell-service-add"
                                        />
                                    )}
                                </div>
                            </section>
                        )}
                        {(workbooks.length > 0 || onCreate) && (
                            <section className={classes.workbookGroup} aria-label="Workbooks">
                                <h2 className={classes.workbookGroupTitle}>
                                    Workbooks
                                    <span className={classes.workbookGroupCount}>{workbooks.length}</span>
                                </h2>
                                <div className={classes.workbookPanels}>
                                    {workbooks.map((workbook) => (
                                        <Panel
                                            key={workbook.path}
                                            title={workbook.name ?? workbook.path}
                                            field={workbook.name !== undefined ? workbook.path : undefined}
                                            description={workbook.description}
                                            icon={<IconBook2 aria-hidden="true" size={18} color="#fff" />}
                                            iconColor={KIND_COLORS.model}
                                            footer={`${count(workbook.inputs, 'input')} · ${count(workbook.functions, 'function')}`}
                                            action="Open flow"
                                            onClick={() => onSelect(workbook.path)}
                                            testId={`shell-workbook-${workbook.path}`}
                                        />
                                    ))}
                                    {onCreate && (
                                        <AddPanel
                                            label="New workbook"
                                            onClick={() => setCreating('workbook')}
                                            testId="shell-workbook-add"
                                        />
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                    {overview && (
                        <aside className={classes.overviewSide} aria-label="Project facts">
                            <section className={classes.sideCard} aria-label="Tests" data-testid="shell-tests-card">
                                <div className={sheetClasses.eyebrow}>Tests</div>
                                <div className={classes.sideBig}>
                                    <b>{count(overview.testSuites, 'suite')}</b>
                                </div>
                                {overview.tests && overview.testsRun && overview.tests.total > 0 && (
                                    <>
                                        <TestsBar totals={overview.tests} run={overview.testsRun} />
                                        <TestsCounts totals={overview.tests} run={overview.testsRun} />
                                    </>
                                )}
                                {overview.testSuites > 0 && (overview.onRunAllTests || overview.onOpenTests) && (
                                    <div className={classes.sideActions}>
                                        {overview.onRunAllTests && overview.testsRun && (
                                            <RunAllButton run={overview.testsRun} onRunAll={overview.onRunAllTests} />
                                        )}
                                        {overview.onOpenTests && (
                                            <button
                                                type="button"
                                                className={classes.sideLink}
                                                onClick={overview.onOpenTests}
                                            >
                                                All Tests
                                                <IconArrowRight aria-hidden="true" size={13} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </section>
                            {overview.origin && (
                                <section className={classes.sideCard}>
                                    <div className={sheetClasses.eyebrow}>Origin</div>
                                    <code className={classes.sideOrigin}>
                                        {overview.origin.id}@{overview.origin.version}
                                    </code>
                                    {overview.originStatus && (
                                        <span
                                            className={
                                                overview.originStatus === 'latest'
                                                    ? classes.badgeOk
                                                    : classes.badgeAccent
                                            }
                                        >
                                            {overview.originStatus === 'latest' ? 'Up to date' : 'Update available'}
                                        </span>
                                    )}
                                    {overview.onShowOrigin && (
                                        <button
                                            type="button"
                                            className={classes.sideLink}
                                            onClick={() => overview.origin && overview.onShowOrigin?.(overview.origin)}
                                        >
                                            View original example
                                            <IconArrowRight aria-hidden="true" size={13} />
                                        </button>
                                    )}
                                </section>
                            )}
                            <section className={classes.sideCard}>
                                <div className={sheetClasses.eyebrow}>Model</div>
                                {overview.counts.map((item) => (
                                    <div key={item.label} className={classes.countRow}>
                                        <span className={classes.countIcon} style={{backgroundColor: item.color}} />
                                        <span>{item.label}</span>
                                        <b>{item.count}</b>
                                    </div>
                                ))}
                            </section>
                        </aside>
                    )}
                </div>
            </div>
            {creating && create && (
                <CreateDialog
                    option={CREATE[creating]}
                    taken={taken}
                    onCancel={() => setCreating(undefined)}
                    onCreate={(name) => {
                        const error = create(name);
                        if (error === undefined) setCreating(undefined);
                        return error;
                    }}
                />
            )}
        </div>
    );
}
