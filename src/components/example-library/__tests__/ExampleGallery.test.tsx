import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createLibraryClient} from '../createLibraryClient';
import {ExampleGallery, IndustryGrid} from '..';
import {FIXTURE_SOURCE, NEWEST_REF, createFixtureClient, createFixtureFetch} from '../testing/fixtureLibrary';

const callbacks = () => ({onCopy: vi.fn(), onShowDetails: vi.fn()});

function panelNames(): string[] {
    return screen.queryAllByTestId('example-panel').map((panel) => panel.getAttribute('aria-label')!);
}

describe('ExampleGallery', () => {
    it('shows one panel per example, with industry tabs and counts', async () => {
        render(<ExampleGallery client={createFixtureClient()} {...callbacks()} />);
        await waitFor(() => expect(panelNames()).toHaveLength(3));
        expect(panelNames()).toEqual(['Client outreach', 'Loan origination', 'Loan repayment']);
        expect(screen.getByRole('tab', {name: 'All (3)'})).toBeTruthy();
        expect(screen.getByRole('tab', {name: 'Financial (3)'})).toBeTruthy();
    });

    it('searches as the user types and reports the query', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        render(
            <ExampleGallery client={createFixtureClient()} {...callbacks()} query="" onQueryChange={onQueryChange} />,
        );
        await waitFor(() => expect(panelNames()).toHaveLength(3));
        await user.type(screen.getByLabelText('Search examples'), 'x');
        expect(onQueryChange).toHaveBeenLastCalledWith('x');
    });

    it('filters by a controlled query and level', async () => {
        const client = createFixtureClient();
        const {rerender} = render(<ExampleGallery client={client} {...callbacks()} query="optimisation" />);
        await waitFor(() => expect(panelNames()).toEqual(['Client outreach']));
        rerender(<ExampleGallery client={client} {...callbacks()} query="" />);
        await waitFor(() => expect(panelNames()).toHaveLength(3));
    });

    it('filters by level through the facet', async () => {
        const user = userEvent.setup();
        render(<ExampleGallery client={createFixtureClient()} {...callbacks()} />);
        await waitFor(() => expect(panelNames()).toHaveLength(3));
        await user.click(screen.getByRole('combobox', {name: 'Level'}));
        await user.click(await screen.findByRole('option', {name: 'Advanced'}));
        expect(panelNames()).toEqual(['Client outreach']);
        expect(screen.getByRole('status').textContent).toBe('1 example');
    });

    it('reports the industry tab', async () => {
        const user = userEvent.setup();
        const onIndustryChange = vi.fn();
        render(
            <ExampleGallery
                client={createFixtureClient()}
                {...callbacks()}
                industry={undefined}
                onIndustryChange={onIndustryChange}
            />,
        );
        await user.click(await screen.findByRole('tab', {name: 'Financial (3)'}));
        expect(onIndustryChange).toHaveBeenCalledWith('financial');
    });

    it('shows only index.featured in featured mode, up to the limit, without tabs or facets', async () => {
        render(<ExampleGallery client={createFixtureClient()} {...callbacks()} featured limit={2} />);
        await waitFor(() => expect(panelNames()).toHaveLength(2));
        expect(screen.queryByRole('tab')).toBeNull();
        expect(screen.queryByLabelText('Search examples')).toBeNull();
    });

    it('opens the details of the newest version', async () => {
        const user = userEvent.setup();
        const handlers = callbacks();
        render(<ExampleGallery client={createFixtureClient()} {...handlers} />);
        const panel = (await screen.findAllByTestId('example-panel')).find(
            (p) => p.dataset.exampleId === 'loan-repayment',
        )!;
        await user.click(within(panel).getByRole('button', {name: 'Details'}));
        expect(handlers.onShowDetails).toHaveBeenCalledWith({id: 'loan-repayment', version: '1.3.0'});
    });

    it('copies and opens: loads the files of the newest version and calls onCopy with open = true', async () => {
        const user = userEvent.setup();
        const handlers = callbacks();
        const client = createFixtureClient();
        render(<ExampleGallery client={client} {...handlers} />);
        const panel = (await screen.findAllByTestId('example-panel')).find(
            (p) => p.dataset.exampleId === 'loan-repayment',
        )!;
        await user.click(within(panel).getByRole('button', {name: 'Copy and open'}));

        await waitFor(() => expect(handlers.onCopy).toHaveBeenCalledTimes(1));
        const [example, open] = handlers.onCopy.mock.calls[0];
        expect(open).toBe(true);
        expect(example.ref).toBe(NEWEST_REF);
        expect(example.project.origin).toMatchObject({id: 'loan-repayment', version: '1.3.0'});
    });

    it('shows an error for a file that failed, and keeps the gallery', async () => {
        const user = userEvent.setup();
        const handlers = callbacks();
        render(<ExampleGallery client={createFixtureClient()} {...handlers} />);
        const panel = (await screen.findAllByTestId('example-panel')).find(
            (p) => p.dataset.exampleId === 'client-outreach',
        )!;
        await user.click(within(panel).getByRole('button', {name: 'Copy and open'}));
        expect((await screen.findByRole('alert')).textContent).toContain('edgerules.project.json: HTTP 404');
        expect(handlers.onCopy).not.toHaveBeenCalled();
        expect(panelNames()).toHaveLength(3);
    });

    it('shows workspace badges: in workspace for the newest copy, update available for an older one', async () => {
        const origin = (id: string, version: string) => ({library: FIXTURE_SOURCE.indexUrl, id, version});
        render(
            <ExampleGallery
                client={createFixtureClient()}
                {...callbacks()}
                workspaceOrigins={[origin('loan-repayment', '1.2.0'), origin('loan-origination', '2.0.0')]}
            />,
        );
        const byId = async (id: string) =>
            (await screen.findAllByTestId('example-panel')).find((p) => p.dataset.exampleId === id)!;
        expect(within(await byId('loan-repayment')).getByText('Update available')).toBeTruthy();
        expect(within(await byId('loan-origination')).getByText('✓ In workspace')).toBeTruthy();
        expect(within(await byId('client-outreach')).queryByText(/workspace|Update/)).toBeNull();
    });

    it('marks an example whose engine range excludes the loaded engine', async () => {
        render(<ExampleGallery client={createFixtureClient()} {...callbacks()} engineVersion="0.2.6-alpha.1" />);
        expect((await screen.findAllByText(/Needs engine/)).length).toBe(3);
    });

    it('focuses the search box on "/" and moves between panels with the arrow keys', async () => {
        render(<ExampleGallery client={createFixtureClient()} {...callbacks()} />);
        const panels = await screen.findAllByTestId('example-panel');
        fireEvent.keyDown(document.body, {key: '/'});
        expect(document.activeElement).toBe(screen.getByLabelText('Search examples'));

        panels[0].focus();
        fireEvent.keyDown(panels[0], {key: 'ArrowRight'});
        await waitFor(() => expect(document.activeElement).toBe(panels[1]));
    });

    it('opens the details with Enter on a panel', async () => {
        const handlers = callbacks();
        render(<ExampleGallery client={createFixtureClient()} {...handlers} />);
        const [panel] = await screen.findAllByTestId('example-panel');
        fireEvent.keyDown(panel, {key: 'Enter'});
        expect(handlers.onShowDetails).toHaveBeenCalledTimes(1);
    });

    it('shows a retry panel when the index fails, and recovers', async () => {
        const user = userEvent.setup();
        let fail = true;
        const {fetch} = createFixtureFetch();
        const client = createLibraryClient(FIXTURE_SOURCE, {
            fetch: (input) => (fail ? Promise.resolve(new Response('', {status: 503})) : fetch(input)),
        });
        render(<ExampleGallery client={client} {...callbacks()} />);
        expect((await screen.findByRole('alert')).textContent).toContain('HTTP 503');
        fail = false;
        await user.click(screen.getByRole('button', {name: 'Retry'}));
        await waitFor(() => expect(panelNames()).toHaveLength(3));
    });
});

describe('IndustryGrid', () => {
    it('shows a tile per industry with its count and reports a click', async () => {
        const user = userEvent.setup();
        const onSelectIndustry = vi.fn();
        render(<IndustryGrid client={createFixtureClient()} onSelectIndustry={onSelectIndustry} />);
        const tile = await screen.findByRole('button', {name: 'Financial, 3 examples'});
        await user.click(tile);
        expect(onSelectIndustry).toHaveBeenCalledWith('financial');
    });
});
