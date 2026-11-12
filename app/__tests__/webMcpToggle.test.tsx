import {afterEach, describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {WEBMCP_FLAG, WebMcpToggle} from '../../stories/support/modeler/WebMcpToggle';

// jsdom has no `document.modelContext`: these tests show the toggle in a browser without the Chrome flag.
describe('WebMcpToggle without WebMCP in the browser', () => {
    afterEach(() => window.localStorage.clear());

    it('disables the switch and leaves it off', () => {
        render(<WebMcpToggle />);
        const toggle = screen.getByRole('switch', {name: 'WebMCP'});
        expect(toggle).toBeDisabled();
        expect(toggle).not.toBeChecked();
        expect(screen.queryByTestId('agent-tools-hint')).not.toBeInTheDocument();
    });

    it('shows a warning that explains how to turn on the Chrome flag', async () => {
        const user = userEvent.setup();
        render(<WebMcpToggle />);
        await user.click(screen.getByRole('button', {name: 'WebMCP is off in this browser'}));
        const warning = screen.getByTestId('webmcp-warning');
        expect(warning).toHaveTextContent(WEBMCP_FLAG);
        expect(warning).toHaveTextContent('Restart Chrome');
        expect(screen.getByTestId('webmcp-help-panel')).toHaveTextContent('experimental');
    });
});
