import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ExampleDetails} from '..';
import {FIXTURE_SOURCE, NEWEST_REF, OLDEST_REF, createFixtureClient} from '../testing/fixtureLibrary';

function setup(props: Partial<React.ComponentProps<typeof ExampleDetails>> = {}) {
    const handlers = {onCopy: vi.fn(), onShowDetails: vi.fn(), onVersionChange: vi.fn()};
    const client = createFixtureClient();
    render(
        <ExampleDetails client={client} example={{id: 'loan-repayment', version: '1.3.0'}} {...handlers} {...props} />,
    );
    return {...handlers, client};
}

describe('ExampleDetails', () => {
    it('offers "Open copy" for an example in the workspace, and leads back to the gallery by its crumbs', async () => {
        const user = userEvent.setup();
        const onOpenCopy = vi.fn();
        const onShowIndustry = vi.fn();
        setup({
            onOpenCopy,
            onShowIndustry,
            workspaceOrigins: [{library: FIXTURE_SOURCE.indexUrl, id: 'loan-repayment', version: '1.3.0'}],
        });
        await screen.findByRole('heading', {name: 'Loan repayment'});
        expect(screen.getAllByText('✓ In workspace').length).toBeGreaterThan(0);
        await user.click(screen.getAllByRole('button', {name: 'Open copy'})[0]);
        expect(onOpenCopy).toHaveBeenCalledWith('loan-repayment');

        const crumbs = screen.getByRole('navigation', {name: 'Library path'});
        await user.click(within(crumbs).getByRole('button', {name: 'Financial'}));
        expect(onShowIndustry).toHaveBeenLastCalledWith('financial');
        await user.click(within(crumbs).getByRole('button', {name: 'Examples'}));
        expect(onShowIndustry).toHaveBeenLastCalledWith(undefined);
    });

    it('shows the rendered README, the metadata and related examples of the same industry', async () => {
        setup({repositoryUrl: (entry, ref) => `https://github.test/${entry.path}?ref=${ref}`});
        expect(await screen.findByRole('heading', {name: 'Loan repayment'})).toBeTruthy();
        await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(1));
        const meta = screen.getByRole('complementary', {name: 'Example metadata'});
        const value = (label: string) => within(meta).getByText(label).nextElementSibling?.textContent;
        expect(value('Level')).toBe('Beginner');
        expect(value('Released')).toBe('2026-11-10');
        expect(
            within(meta)
                .getByRole('link', {name: /View on GitHub/})
                .getAttribute('href'),
        ).toContain(NEWEST_REF);
        expect(screen.getByText('Related examples')).toBeTruthy();
        expect(
            screen
                .getAllByTestId('example-panel')
                .map((p) => p.dataset.exampleId)
                .sort(),
        ).toEqual(['client-outreach', 'loan-origination']);
    });

    it('lists the versions and reports a version change, loading the README at its ref', async () => {
        const user = userEvent.setup();
        const {onVersionChange, client} = setup({example: {id: 'loan-repayment', version: '1.2.0'}});
        await screen.findByRole('heading', {name: 'Loan repayment'});
        await waitFor(() =>
            expect(client.requests.some((url) => url.includes(`${OLDEST_REF}/`) && url.endsWith('README.md'))).toBe(
                true,
            ),
        );
        await user.click(screen.getByRole('combobox', {name: 'Version'}));
        const options = await screen.findAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['1.3.0 (latest)', '1.2.0']);
        await user.click(options[0]);
        expect(onVersionChange).toHaveBeenCalledWith({id: 'loan-repayment', version: '1.3.0'});
    });

    it('copies and opens, or only copies', async () => {
        const user = userEvent.setup();
        const {onCopy} = setup();
        await screen.findByRole('heading', {name: 'Loan repayment'});
        await user.click(screen.getAllByRole('button', {name: 'Copy and open'})[0]);
        await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
        expect(onCopy.mock.calls[0][1]).toBe(true);
        expect(onCopy.mock.calls[0][0].project.origin.version).toBe('1.3.0');

        await user.click(screen.getByRole('button', {name: 'Copy to workspace'}));
        await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(2));
        expect(onCopy.mock.calls[1][1]).toBe(false);
    });

    it('is read-only: it has no edit action', async () => {
        setup();
        await screen.findByRole('heading', {name: 'Loan repayment'});
        expect(screen.queryByRole('button', {name: /edit/i})).toBeNull();
    });

    it('shows the share and repository actions only when the host gives their URLs', async () => {
        setup();
        await screen.findByRole('heading', {name: 'Loan repayment'});
        expect(screen.queryByRole('button', {name: 'Share link'})).toBeNull();
        expect(screen.queryByRole('link', {name: /View on GitHub/})).toBeNull();
    });

    it('copies the share URL to the clipboard', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        try {
            const user = userEvent.setup();
            vi.stubGlobal('navigator', {...navigator, clipboard: {writeText}});
            setup({shareUrl: ({id, version}) => `https://modeler.test/examples/financial/${id}@${version}`});
            await user.click(await screen.findByRole('button', {name: 'Share link'}));
            await waitFor(() =>
                expect(writeText).toHaveBeenCalledWith('https://modeler.test/examples/financial/loan-repayment@1.3.0'),
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('warns about an engine outside the range, and keeps copy available', async () => {
        setup({engineVersion: '0.2.6-alpha.1'});
        expect(await screen.findByText(/This example needs the engine/)).toBeTruthy();
        expect((screen.getAllByRole('button', {name: 'Copy and open'})[0] as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows "Example not found" for an unknown id or version', async () => {
        setup({example: {id: 'loan-repayment', version: '9.9.9'}});
        expect(await screen.findByText('Example not found')).toBeTruthy();
    });

    it('shows the update badge when only an older version is in the workspace', async () => {
        setup({workspaceOrigins: [{library: FIXTURE_SOURCE.indexUrl, id: 'loan-repayment', version: '1.2.0'}]});
        expect((await screen.findAllByText('Update available')).length).toBeGreaterThan(0);
    });

    it('names README.md when its file fails', async () => {
        setup({example: {id: 'client-outreach', version: '1.0.0'}});
        expect((await screen.findByRole('alert')).textContent).toContain('README.md: README.md: HTTP 404');
    });
});
