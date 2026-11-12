import {MutableDecisionService} from '@edgerules/node/mutable';
import {render} from '@testing-library/react';
import {vi} from 'vitest';
import {ProjectProvider} from '../../project-session';
import {LOAN_TESTS, openToolsFixture} from '../../webmcp/testing/toolsFixture';
import {Shell} from '../Shell';
import type {ShellProps} from '../shell-types';

/**
 * The loan project of the WebMCP tools fixture in a Shell, with the tools registered on a recording model context and
 * their activity passed as `agentActivity`. `call` runs a tool as the agent does.
 */
export async function renderAgentShell(props: Partial<ShellProps> = {}) {
    const fixture = await openToolsFixture({tests: LOAN_TESTS});
    const onPathChange = vi.fn<(path: string) => void>();
    const onViewChange = vi.fn<(view: string) => void>();
    const result = render(
        <ProjectProvider session={fixture.session}>
            <div style={{width: 1000, height: 700}}>
                <Shell
                    languageService={MutableDecisionService}
                    agentActivity={fixture.handle.activity}
                    onPathChange={onPathChange}
                    onViewChange={onViewChange}
                    {...props}
                />
            </div>
        </ProjectProvider>,
    );
    return {...fixture, onPathChange, onViewChange, ...result};
}
