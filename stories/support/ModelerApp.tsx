import {useCallback, useState, type ReactElement} from 'react';
import {ModelerFrame, ModelerPage, ModelerProvider, type ModelerWorkspace} from './modeler/ModelerHost';
import {routePath, type ModelerRoute} from './modeler/routes';

export type {ModelerRoute};
export {routePath};
export type StoryWorkspace = ModelerWorkspace;

/**
 * The hosted Modeler as `edgerules-modeler` composes it, with the route in React state: Storybook has no address bar.
 * The local app (`npm run dev`, `app/`) composes the same pages under a URL router.
 */
export function ModelerApp({
    repository,
    factory,
    initialRoute = {page: 'home'},
}: StoryWorkspace & {initialRoute?: ModelerRoute}): ReactElement {
    const [route, setRoute] = useState<ModelerRoute>(initialRoute);
    const navigate = useCallback((next: ModelerRoute) => setRoute(next), []);
    return (
        <ModelerProvider repository={repository} factory={factory} navigate={navigate} route={route}>
            <ModelerFrame route={route}>
                <ModelerPage route={route} />
            </ModelerFrame>
        </ModelerProvider>
    );
}
