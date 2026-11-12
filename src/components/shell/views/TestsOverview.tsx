import {
    IconAlertTriangle,
    IconArrowRight,
    IconCircleCheckFilled,
    IconCircleDashed,
    IconCircleXFilled,
    IconFlask,
    IconLoader2,
    IconPlayerPlay,
} from '@tabler/icons-react';
import type {ReactElement} from 'react';
import {cx} from '#ui/cx';
import {sheetClasses} from '#ui/sheet';
import type {CaseStatus, CaseSummary, SubjectSummary, Totals, TestsRunState, TestsSummary} from '../testsStatus';
import * as classes from '../shell.module.css';

/** "ran 5 min ago" for an epoch time. */
export function ranAgo(ranAt: number, now: number = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - ranAt) / 1000));
    if (seconds < 60) return 'ran just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `ran ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `ran ${hours} h ago`;
    return `ran ${Math.floor(hours / 24)} d ago`;
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The stacked bar of the totals: passed (green), failed (red), not run (grey). While a run is in progress, the bar
 * shows its progress instead.
 */
export function TestsBar({totals, run}: {totals: Totals; run: TestsRunState}): ReactElement {
    if (run.running) {
        const share = run.total === 0 ? 0 : (run.done / run.total) * 100;
        return (
            <div
                className={classes.testsBar}
                role="progressbar"
                aria-label="Test run progress"
                aria-valuemin={0}
                aria-valuemax={run.total}
                aria-valuenow={run.done}
            >
                <span className={cx(classes.testsBarPart, classes.testsBarRunning)} style={{width: `${share}%`}} />
            </div>
        );
    }
    const share = (count: number) => (totals.total === 0 ? 0 : (count / totals.total) * 100);
    return (
        <div className={classes.testsBar} aria-hidden="true">
            <span
                className={cx(classes.testsBarPart, classes.testsBarPassed)}
                style={{width: `${share(totals.passed)}%`}}
            />
            <span
                className={cx(classes.testsBarPart, classes.testsBarFailed)}
                style={{width: `${share(totals.failed)}%`}}
            />
        </div>
    );
}

/** "12 passed · 1 failed · 3 not run", or the progress of a run. */
export function TestsCounts({totals, run}: {totals: Totals; run: TestsRunState}): ReactElement {
    if (run.running) {
        return (
            <div className={classes.testsCounts} data-testid="tests-run-progress">
                <IconLoader2 aria-hidden="true" size={14} className={classes.spin} />
                Running {run.done} of {run.total}
            </div>
        );
    }
    return (
        <div className={classes.testsCounts} data-testid="tests-totals">
            <span className={classes.testsCountPassed}>{totals.passed} passed</span>
            {totals.failed > 0 && <span className={classes.testsCountFailed}>{totals.failed} failed</span>}
            {totals.notRun > 0 && <span className={classes.testsCountMuted}>{totals.notRun} not run</span>}
        </div>
    );
}

/** The "Run all" button: a spinner and disabled while the tests run. */
export function RunAllButton({
    run,
    onRunAll,
    primary,
}: {
    run: TestsRunState;
    onRunAll: () => void;
    primary?: boolean;
}): ReactElement {
    return (
        <button
            type="button"
            className={cx(classes.overviewButton, primary && classes.overviewButtonPrimary)}
            onClick={onRunAll}
            disabled={run.running}
            aria-busy={run.running || undefined}
        >
            {run.running ? (
                <IconLoader2 aria-hidden="true" size={14} className={classes.spin} />
            ) : (
                <IconPlayerPlay aria-hidden="true" size={14} />
            )}
            {run.running ? 'Running…' : 'Run all'}
        </button>
    );
}

const STATUS_LABEL: Record<CaseStatus, string> = {
    passed: 'Passed',
    failed: 'Failed',
    error: 'Error',
    'not-run': 'Not run',
};

function StatusIcon({status}: {status: CaseStatus}): ReactElement {
    const label = STATUS_LABEL[status];
    switch (status) {
        case 'passed':
            return <IconCircleCheckFilled aria-label={label} size={16} className={classes.testsStatusPassed} />;
        case 'failed':
            return <IconCircleXFilled aria-label={label} size={16} className={classes.testsStatusFailed} />;
        case 'error':
            return <IconAlertTriangle aria-label={label} size={16} className={classes.testsStatusFailed} />;
        default:
            return <IconCircleDashed aria-label={label} size={16} className={classes.testsStatusMuted} />;
    }
}

function CaseLine({item}: {item: CaseSummary}): ReactElement {
    return (
        <li className={classes.testsCase} data-status={item.status}>
            <StatusIcon status={item.status} />
            <span className={classes.testsCaseName}>{item.name}</span>
            {item.detail && (
                <span className={classes.testsCaseDetail} title={item.detail}>
                    {item.detail}
                </span>
            )}
            {item.stale && (
                <span className={classes.testsStale} title="The model changed after this run">
                    outdated
                </span>
            )}
        </li>
    );
}

function subjectLabel(subject: string, modelLabel: string): string {
    return subject === '*' ? modelLabel : `${subject}(...)`;
}

function SubjectCard({
    entry,
    modelLabel,
    onOpen,
}: {
    entry: SubjectSummary;
    modelLabel: string;
    onOpen: () => void;
}): ReactElement {
    const label = subjectLabel(entry.subject, modelLabel);
    const state = entry.failed > 0 ? 'failed' : entry.notRun > 0 ? 'not-run' : 'passed';
    return (
        <section className={classes.testsSubject} aria-label={label} data-testid={`tests-subject-${entry.subject}`}>
            <header className={classes.testsSubjectHead}>
                <span className={classes.testsSubjectIcon} aria-hidden="true">
                    <IconFlask size={15} color="#fff" />
                </span>
                <span className={classes.testsSubjectName}>{label}</span>
                <span
                    className={
                        state === 'passed'
                            ? classes.badgeOk
                            : state === 'failed'
                              ? classes.badgeDanger
                              : classes.badgeMuted
                    }
                >
                    {entry.passed}/{entry.total} passed
                </span>
                <button
                    type="button"
                    className={classes.sideLink}
                    onClick={onOpen}
                    aria-label={`Open tests of ${label}`}
                >
                    Open
                    <IconArrowRight aria-hidden="true" size={13} />
                </button>
            </header>
            <ul className={classes.testsCases}>
                {entry.cases.map((item) => (
                    <CaseLine key={item.id} item={item} />
                ))}
            </ul>
        </section>
    );
}

export interface TestsOverviewProps {
    modelLabel: string; // the label of the model subject '*'
    summary: TestsSummary;
    run: TestsRunState;
    onRunAll: () => void;
    onOpenSubject: (subject: string) => void; // the Tests view of the subject
}

/**
 * The Tests Overview page: the results of every test case of the project, grouped by test subject, from the last run
 * of each case. "Run all" runs every case of every subject.
 */
export function TestsOverview({modelLabel, summary, run, onRunAll, onOpenSubject}: TestsOverviewProps): ReactElement {
    const empty = summary.subjects.length === 0;
    return (
        <div className={cx(sheetClasses.tokens, classes.workbooks)} data-testid="shell-tests-overview">
            <div className={classes.overview}>
                <header className={classes.overviewHead}>
                    <div className={classes.overviewTitles}>
                        <div className={sheetClasses.eyebrow}>Project</div>
                        <h1 className={classes.overviewTitle}>Tests Overview</h1>
                        <div className={classes.overviewMeta}>
                            <span>
                                {plural(summary.subjects.length, 'suite')} · {plural(summary.total, 'case')}
                            </span>
                            {summary.ranAt !== undefined && <span>{ranAgo(summary.ranAt)}</span>}
                        </div>
                    </div>
                    {!empty && (
                        <div className={classes.overviewActions}>
                            <RunAllButton run={run} onRunAll={onRunAll} primary />
                        </div>
                    )}
                </header>
                {empty ? (
                    <div className={classes.testsEmpty}>
                        <IconFlask aria-hidden="true" size={28} />
                        <b>No tests yet</b>
                        <span>Open a function or the model and pick the Tests view to create test cases.</span>
                    </div>
                ) : (
                    <>
                        <section className={classes.testsSummary} aria-label="Totals">
                            <TestsBar totals={summary} run={run} />
                            <TestsCounts totals={summary} run={run} />
                        </section>
                        <div className={classes.testsSubjects}>
                            {summary.subjects.map((entry) => (
                                <SubjectCard
                                    key={entry.subject}
                                    entry={entry}
                                    modelLabel={modelLabel}
                                    onOpen={() => onOpenSubject(entry.subject)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
