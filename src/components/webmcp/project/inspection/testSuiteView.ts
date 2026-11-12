import {listCallables} from '#lib/callables';
import type {ProjectSession} from '../../../project-session';
import type {TestRow, TestSectionId, TestValuesByPath} from '../../../test-cases-service';
import {deriveRows, listTestSubjects} from '../../../tests-manager/internal';
import type {TestSubject} from '../../core/paths';
import {fail, ok, type ToolResult} from '../../core/toolResult';

export interface ListTestsInput {
    subject: TestSubject;
}

export interface TestSuiteView {
    subject: TestSubject;
    paths: {path: string; section: TestSectionId; type?: string}[]; // the present rows; '' for a scalar result
    cases: {
        id: string;
        name: string;
        inputs: TestValuesByPath; // raw test cell text: strings without quotes
        assertions: TestValuesByPath;
    }[];
}

const SECTION_ORDER: readonly TestSectionId[] = ['inputs', 'assertions', 'validations'];

/** The test subjects of the model: '*' and every typed callable, plus a subject that only has a stored suite. */
export function testSubjectIds(session: ProjectSession): string[] {
    const ids = listTestSubjects(session.engine).map((subject) => subject.id);
    for (const stored of Object.keys(session.tests.exportDocument().subjects)) {
        if (!ids.includes(stored)) ids.push(stored);
    }
    return ids;
}

export function testSuiteView(session: ProjectSession, input: ListTestsInput): ToolResult<TestSuiteView> {
    const {subject} = input;
    if (!testSubjectIds(session).includes(subject)) {
        return fail('NotFound', `The model has no test subject '${subject}'.`, {
            path: subject,
            hint: "Use '*' or the path of a function that list-model-entries shows.",
        });
    }
    const suite = session.tests.exportDocument().subjects[subject];
    const kind =
        subject === '*' ? 'model' : (listCallables(session.engine).find((c) => c.path === subject)?.kind ?? 'function');
    const derived = deriveRows(session.engine, {id: subject, kind, name: subject});
    const stored = (suite?.rows ?? []).filter((row) => row.present);
    const known = new Set(stored.map((row) => row.path));
    const rows: TestRow[] = [...stored, ...derived.filter((row) => !known.has(row.path))].sort(
        (a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.order - b.order,
    );
    return ok({
        subject,
        paths: rows.map((row) => ({
            path: row.path,
            section: row.section,
            ...(row.type !== undefined && {type: row.type}),
        })),
        cases: [...(suite?.cases ?? [])]
            .sort((a, b) => a.order - b.order)
            .map(({id, name, inputs, assertions}) => ({id, name, inputs: {...inputs}, assertions: {...assertions}})),
    });
}
