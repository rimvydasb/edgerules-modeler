import 'fake-indexeddb/auto';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {Notifications, notifications} from '@mantine/notifications';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it} from 'vitest';
import {TestsManager} from '../TestsManager';

function uniqueModelName(): string {
    return `model-${Math.random().toString(36).slice(2)}`;
}

const MODEL = `{
    total: 1 + 2
}`;

// Renders the manager with a `Notifications` host and turns the computed `total` row into an assertion of `expected`.
async function renderWithAssertion(expected: string): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    const service = MutableDecisionService.fromCode(MODEL);
    render(
        <>
            <Notifications />
            <TestsManager service={service} modelName={uniqueModelName()} />
        </>,
    );
    await waitFor(() => expect(screen.getByTestId('validation-total')).toHaveTextContent('3'));
    await user.click(screen.getByLabelText('row menu total'));
    await user.click(screen.getByRole('menuitem', {name: 'Move to Assertions'}));
    const assertion = await screen.findByLabelText('assertion total');
    await user.clear(assertion);
    await user.type(assertion, expected);
    await user.click(document.body);
    return user;
}

describe('TestsManager "All tests passed" notification', () => {
    afterEach(() => {
        act(() => notifications.clean());
    });

    it('shows after Run all when every test case passes', async () => {
        const user = await renderWithAssertion('3');
        expect(screen.queryByText('All tests passed')).toBeNull();

        await user.click(screen.getByRole('button', {name: 'Run all'}));

        expect(await screen.findByText('All tests passed')).toBeInTheDocument();
        expect(screen.getByText('1 test case passed.')).toBeInTheDocument();
    });

    it('does not show after Run all when a test case fails', async () => {
        const user = await renderWithAssertion('4');
        await waitFor(() => expect(screen.getByLabelText('assertion total')).toHaveAttribute('data-mismatch', 'true'));

        await user.click(screen.getByRole('button', {name: 'Run all'}));
        await waitFor(() => expect(screen.getByRole('button', {name: 'Run all'})).not.toHaveAttribute('aria-busy'));

        expect(screen.queryByText('All tests passed')).toBeNull();
    });

    it('does not show when the cases run on their own rather than through Run all', async () => {
        await renderWithAssertion('3');
        await waitFor(() => expect(screen.getByLabelText('assertion total')).toHaveAttribute('data-mismatch', 'false'));

        expect(screen.queryByText('All tests passed')).toBeNull();
    });
});
