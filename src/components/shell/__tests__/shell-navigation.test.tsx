import 'fake-indexeddb/auto';
import {MutableDecisionService} from '@edgerules/node/mutable';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {ProjectProvider, type ProjectDescriptor, type ProjectOrigin} from '../../project-session';
import {openFixtureProject} from '../../project-session/testing/sessionFixture';
import {Shell} from '../Shell';
import type {ShellNavigation} from '../shell-types';

const ORIGIN: ProjectOrigin = {library: 'https://example.test/library.json', id: 'loan-repayment', version: '1.2.0'};

function recent(name: string, projectId: string): ProjectDescriptor {
    return {
        projectId,
        name,
        tags: [],
        locator: {provider: 'indexeddb', resource: 'db', projectPath: projectId},
        headRevision: '1',
        savedAt: new Date().toISOString(),
    };
}

async function renderNavigated(options: {origin?: ProjectOrigin} = {}, navigation: Partial<ShellNavigation> = {}) {
    const opened = await openFixtureProject({name: 'Loan repayment', origin: options.origin});
    const handlers = {
        onBrowseExamples: vi.fn(),
        onOpenProject: vi.fn(),
        onShowOrigin: vi.fn(),
        ...navigation,
    };
    render(
        <ProjectProvider session={opened.session}>
            <div style={{width: 1000, height: 700}}>
                <Shell languageService={MutableDecisionService} navigation={handlers} />
            </div>
        </ProjectProvider>,
    );
    return {...opened, handlers};
}

describe('Shell navigation', () => {
    it('has no way back to the Workspace: neither a crumb nor a menu item leaves the project', async () => {
        const user = userEvent.setup();
        await renderNavigated();
        const nav = screen.getByRole('navigation', {name: 'Model path'});
        expect(within(nav).queryByRole('button', {name: 'Workspace'})).toBeNull();
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await screen.findByRole('menuitem', {name: 'Browse examples'});
        expect(screen.queryByRole('menuitem', {name: /workspace/i})).toBeNull();
    });

    it('shows the origin chip and "View original example" for a copy', async () => {
        const user = userEvent.setup();
        const {handlers} = await renderNavigated(
            {origin: ORIGIN},
            {originStatus: 'update-available', onDuplicate: vi.fn()},
        );
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));

        const chip = await screen.findByTestId('shell-origin-chip');
        expect(chip.textContent).toContain('from loan-repayment@1.2.0');
        expect(chip.textContent).toContain('Update available');
        expect(screen.getByTestId('shell-project-menu-header').textContent).toContain('saved');
        await user.click(chip);
        expect(handlers.onShowOrigin).toHaveBeenCalledWith(ORIGIN);

        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await user.click(await screen.findByRole('menuitem', {name: 'View original example'}));
        expect(handlers.onShowOrigin).toHaveBeenCalledTimes(2);
    });

    it('has no origin chip for an own project', async () => {
        const user = userEvent.setup();
        await renderNavigated();
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await screen.findByRole('menuitem', {name: 'Browse examples'});
        expect(screen.queryByTestId('shell-origin-chip')).toBeNull();
        expect(screen.queryByRole('menuitem', {name: 'View original example'})).toBeNull();
        expect(screen.queryByRole('menuitem', {name: 'Duplicate'})).toBeNull();
    });

    it('lists up to 5 recent projects without the open one, and runs the menu actions', async () => {
        const user = userEvent.setup();
        const opened = await openFixtureProject({name: 'Loan repayment'});
        const others = Array.from({length: 6}, (_, i) => recent(`Other ${i}`, `id-${i}`));
        const handlers = {
            onBrowseExamples: vi.fn(),
            onOpenProject: vi.fn(),
            onDuplicate: vi.fn(),
            recentProjects: [recent('Loan repayment', opened.session.projectId), ...others],
        };
        render(
            <ProjectProvider session={opened.session}>
                <Shell languageService={MutableDecisionService} navigation={handlers} />
            </ProjectProvider>,
        );
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
        expect(items.filter((text) => text?.startsWith('Other'))).toHaveLength(5);
        expect(items).not.toContain('Loan repayment');

        await user.click(screen.getByRole('menuitem', {name: 'Other 0'}));
        expect(handlers.onOpenProject).toHaveBeenCalledWith(others[0].locator);

        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await user.click(await screen.findByRole('menuitem', {name: 'Browse examples'}));
        expect(handlers.onBrowseExamples).toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await user.click(await screen.findByRole('menuitem', {name: 'Duplicate'}));
        expect(handlers.onDuplicate).toHaveBeenCalled();
    });

    it('opens the README preview from the menu', async () => {
        const user = userEvent.setup();
        await renderNavigated();
        await user.click(screen.getByRole('button', {name: 'Project menu: Loan repayment'}));
        await user.click(await screen.findByRole('menuitem', {name: 'Open README'}));
        const nav = screen.getByRole('navigation', {name: 'Model path'});
        expect(await within(nav).findByText('README.md')).toBeTruthy();
    });

    it('leaves the Shell bar unchanged without navigation', async () => {
        const opened = await openFixtureProject({name: 'Loan repayment'});
        render(
            <ProjectProvider session={opened.session}>
                <Shell languageService={MutableDecisionService} />
            </ProjectProvider>,
        );
        const nav = screen.getByRole('navigation', {name: 'Model path'});
        expect(within(nav).queryByRole('button', {name: 'Workspace'})).toBeNull();
        expect(screen.queryByRole('button', {name: /Project menu/})).toBeNull();
    });
});
