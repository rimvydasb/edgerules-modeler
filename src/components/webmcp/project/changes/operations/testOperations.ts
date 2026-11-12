import type {TestCase, TestCasesService, TestCellKind} from '../../../../test-cases-service';
import type {TestSubject} from '../../../core/paths';
import {fail} from '../../../core/toolResult';
import {OperationFailure, type AppliedOperation, type OperationApplier} from './appliedOperation';

/** Test cell text by path, relative to the test subject: strings without quotes, lists and objects as JSON. */
export type TestValues = Record<string, string>;

export type TestOperation =
    | {op: 'add'; name: string; inputs?: TestValues; assertions?: TestValues}
    // Merges `inputs` and `assertions` into the case; a member with '' removes that value.
    | {op: 'update'; caseId: string; name?: string; inputs?: TestValues; assertions?: TestValues}
    | {op: 'remove'; caseId: string};

/** The applier of `edit-tests` for one subject, and the ids of the cases that its `add` operations created. */
export interface TestOperationApplier extends OperationApplier<TestOperation> {
    readonly addedCaseIds: string[];
}

const KINDS: ReadonlyArray<[TestCellKind, 'inputs' | 'assertions']> = [
    ['input', 'inputs'],
    ['assertion', 'assertions'],
];

/**
 * The appliers of `edit-tests` on `service`, the tests of `subject`. Each operation targets one case, as
 * `<subject>#<caseId>`; its state is the whole `TestCase`, or `null` when the case does not exist.
 */
export function createTestOperations(service: TestCasesService, subject: TestSubject): TestOperationApplier {
    const addedCaseIds: string[] = [];
    const targetOf = (caseId: string) => `${subject}#${caseId}`;
    const readCase = (caseId: string): TestCase | null => service.getTestCase(caseId) ?? null;

    function existing(caseId: string): TestCase {
        const found = service.getTestCase(caseId);
        if (found) return found;
        throw new OperationFailure(
            fail('NotFound', `The test subject '${subject}' has no test case '${caseId}'.`, {
                path: subject,
                hint: 'Call list-tests to see the test cases and their ids.',
            }).error,
        );
    }

    function record(caseId: string, inverse: () => AppliedOperation, summary: string): AppliedOperation {
        return {
            target: targetOf(caseId),
            stateAfter: readCase(caseId),
            readState: () => readCase(caseId),
            inverse,
            changed: [subject],
            summary,
        };
    }

    // Each input path to set MUST be a present `inputs` row; each assertion path a present `assertions` or `validations` row.
    function checkPaths(values: {inputs?: TestValues; assertions?: TestValues}): void {
        const rows = service.listRows().filter((row) => row.present);
        for (const [, member] of KINDS) {
            const sections = member === 'inputs' ? ['inputs'] : ['assertions', 'validations'];
            for (const [path, text] of Object.entries(values[member] ?? {})) {
                if (text === '') continue; // removing a value is always allowed, also of a row the model dropped
                if (rows.some((row) => row.path === path && sections.includes(row.section))) continue;
                const where = member === 'inputs' ? 'an input' : 'an assertion or validation';
                throw new OperationFailure(
                    fail('InvalidInput', `'${member}.${path}' is not ${where} path of the test subject '${subject}'.`, {
                        path: subject,
                        hint: 'Call list-tests to see the input and assertion paths of the subject.',
                    }).error,
                );
            }
        }
    }

    function writeValues(caseId: string, values: {inputs?: TestValues; assertions?: TestValues}): void {
        for (const [kind, member] of KINDS) {
            for (const [path, text] of Object.entries(values[member] ?? {})) service.setCell(caseId, path, kind, text);
        }
    }

    function add(name: string, values: {inputs?: TestValues; assertions?: TestValues}): AppliedOperation {
        checkPaths(values);
        const created = service.addTestCase(name);
        // `addTestCase` copies the inputs of the previous case; an agent's case holds only the values it sent.
        for (const path of Object.keys(created.inputs)) service.setCell(created.id, path, 'input', '');
        writeValues(created.id, values);
        addedCaseIds.push(created.id);
        return record(created.id, () => remove(created.id), `added test case '${name}' of ${subject}`);
    }

    // Makes the case equal to `target`: its name and both value maps. The inverse of `update`.
    function replace(target: TestCase): AppliedOperation {
        const before = existing(target.id);
        if (before.name !== target.name) service.renameTestCase(target.id, target.name);
        for (const [kind, member] of KINDS) {
            for (const path of new Set([...Object.keys(before[member]), ...Object.keys(target[member])])) {
                const text = target[member][path] ?? '';
                if ((before[member][path] ?? '') !== text) service.setCell(target.id, path, kind, text);
            }
        }
        return record(target.id, () => replace(before), `updated test case '${target.name}' of ${subject}`);
    }

    function update(operation: Extract<TestOperation, {op: 'update'}>): AppliedOperation {
        const before = existing(operation.caseId);
        checkPaths(operation);
        if (operation.name !== undefined && operation.name !== before.name) {
            service.renameTestCase(before.id, operation.name);
        }
        writeValues(before.id, operation);
        const name = operation.name ?? before.name;
        return record(before.id, () => replace(before), `updated test case '${name}' of ${subject}`);
    }

    function remove(caseId: string): AppliedOperation {
        const before = existing(caseId);
        service.removeTestCase(caseId);
        return record(caseId, () => restore(before), `removed test case '${before.name}' of ${subject}`);
    }

    function restore(testCase: TestCase): AppliedOperation {
        service.restoreTestCase(testCase);
        return record(testCase.id, () => remove(testCase.id), `restored test case '${testCase.name}' of ${subject}`);
    }

    return {
        addedCaseIds,
        apply(operation) {
            switch (operation.op) {
                case 'add':
                    return add(operation.name, operation);
                case 'update':
                    return update(operation);
                case 'remove':
                    return remove(operation.caseId);
            }
        },
    };
}
