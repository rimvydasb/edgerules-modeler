import {IconArrowRight, IconBook2, IconMathFunction, IconPlus} from '@tabler/icons-react';
import {useLayoutEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode} from 'react';
import {cx} from '#ui/cx';
import {KIND_COLORS} from '#ui/kindColors';
import {MarkdownView} from '../../markdown-view';
import {CREATE_OPTIONS, CreateDialog} from '../../project-explorer/internal';
import {README_FILE} from '../shell-path';
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

export interface WorkbookPickerProps {
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
            <span className={classes.workbookAddIcon}>
                <IconPlus aria-hidden="true" size={24} />
            </span>
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
                    Open
                    <IconArrowRight aria-hidden="true" size={14} />
                </button>
            </div>
        </section>
    );
}

/**
 * The Flow view of the model root when the model has workbooks or services: the README panel when the model has a
 * README, then one panel per workbook with its name, its field name,
 * its description and its node counts, and a panel that creates a new workbook. A click opens its flow. Below, one
 * panel per `service` declaration of the model, and a panel that creates a new service; a click opens it.
 */
export function WorkbookPicker({
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
        <div className={classes.workbooks} data-testid="shell-workbook-picker">
            {readme !== undefined && <ReadmePanel markdown={readme} onOpen={onOpenReadme} onModelLink={onModelLink} />}
            {(workbooks.length > 0 || onCreate) && (
                <section className={classes.workbookGroup} aria-label="Workbooks">
                    <h2 className={classes.workbookGroupTitle}>Workbooks</h2>
                    <div className={classes.workbookPanels}>
                        {workbooks.map((workbook) => (
                            <Panel
                                key={workbook.path}
                                title={workbook.name ?? workbook.path}
                                field={workbook.name !== undefined ? workbook.path : undefined}
                                description={workbook.description}
                                icon={<IconBook2 aria-hidden="true" size={20} color="#fff" />}
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
            {(services.length > 0 || onCreateService) && (
                <section className={classes.workbookGroup} aria-label="Service Methods">
                    <h2 className={classes.workbookGroupTitle}>Service Methods</h2>
                    <div className={classes.workbookPanels}>
                        {services.map((service) => (
                            <Panel
                                key={service.path}
                                title={service.label}
                                description={service.description}
                                icon={<IconMathFunction aria-hidden="true" size={20} color="#fff" />}
                                iconColor={KIND_COLORS.service}
                                footer={count(service.arguments, 'argument')}
                                action="Open"
                                onClick={() => onSelectService(service.path)}
                                testId={`shell-service-${service.path}`}
                            />
                        ))}
                        {onCreateService && (
                            <AddPanel
                                label="New service"
                                onClick={() => setCreating('service')}
                                testId="shell-service-add"
                            />
                        )}
                    </div>
                </section>
            )}
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
