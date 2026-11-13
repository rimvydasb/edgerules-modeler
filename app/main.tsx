import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import {StrictMode, useEffect, useState, type ReactElement} from 'react';
import {createRoot} from 'react-dom/client';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {RouterProvider} from '@tanstack/react-router';
import {init, MutableDecisionService} from '@edgerules/web/mutable';
import {SodasLoader} from '../src/ui/SodasLoader';
import {createLocalProjectRepository, createProjectFactory} from '../src/components/project-session';
import {initAnalytics} from './analytics';
import {createModelerRouter} from './router';
import {modelerTheme} from './theme';

/**
 * The local Modeler: a single-page app whose URL is the route (TanStack Router). The workspace is kept in the
 * IndexedDB of the browser, so a reload keeps the projects; a URL opens a page, an example or an element of a project.
 */
function App(): ReactElement {
    const [router, setRouter] = useState<ReturnType<typeof createModelerRouter>>();
    useEffect(() => {
        void init().then(() =>
            setRouter(
                createModelerRouter({
                    repository: createLocalProjectRepository({dbName: 'edgerules-modeler-dev'}),
                    factory: createProjectFactory({engine: MutableDecisionService}),
                }),
            ),
        );
    }, []);
    return router ? (
        <RouterProvider router={router} />
    ) : (
        <div style={{display: 'flex', justifyContent: 'center', padding: 48}}>
            <SodasLoader label="Loading the engine" />
        </div>
    );
}

initAnalytics();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <MantineProvider theme={modelerTheme}>
            <Notifications position="bottom-right" />
            <App />
        </MantineProvider>
    </StrictMode>,
);
