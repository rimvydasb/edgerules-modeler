import {notifications} from '@mantine/notifications';
import type {TestCasesService} from '../../test-cases-service';
import {caseFailures} from './caseFailures';

// How long the "All tests passed" notification stays before it closes on its own.
export const ALL_PASSED_AUTO_CLOSE_MS = 3000;

/**
 * After a "Run all": shows a notification in the bottom-right corner when every test case of the subject passes, and
 * returns whether it did. The host mounts Mantine's `<Notifications />`; without it nothing shows.
 */
export function notifyAllPassed(testCasesService: TestCasesService): boolean {
    const testCases = testCasesService.listTestCases();
    if (testCases.length === 0) return false;
    if (testCases.some((testCase) => caseFailures(testCasesService, testCase.id).length > 0)) return false;
    const count = testCases.length;
    notifications.show({
        title: 'All tests passed',
        message: count === 1 ? '1 test case passed.' : `${count} test cases passed.`,
        color: 'teal',
        position: 'bottom-right',
        autoClose: ALL_PASSED_AUTO_CLOSE_MS,
        withBorder: true,
        'data-testid': 'all-tests-passed',
    });
    return true;
}
