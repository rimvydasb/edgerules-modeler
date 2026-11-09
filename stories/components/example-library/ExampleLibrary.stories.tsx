import {useEffect, useRef, useState, type ReactElement} from 'react';
import {Stack, Text} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {
    ExampleDetails,
    ExampleGallery,
    IndustryGrid,
    type ExampleCoordinates,
    type LoadedExample,
} from '../../../src/components/example-library';
import {LocalWorkspace, type LocalWorkspaceHandle} from '../../../src/components/local-workspace';
import type {ProjectDescriptor} from '../../../src/components/project-session';
import {createExamplesClient, EXAMPLES_REPOSITORY_URL, EXAMPLES_SOURCE} from '../../support/examplesSource';
import {openStoryWorkspace} from '../../support/workspaceStory';

const client = createExamplesClient();

type Loaded = Awaited<ReturnType<typeof openStoryWorkspace>>;

/** A gallery over the published repository with a `LocalWorkspace` next to it: a copy lands in the workspace. */
function GalleryWithWorkspace({repository, factory}: Loaded): ReactElement {
    const workspace = useRef<LocalWorkspaceHandle>(null);
    const [projects, setProjects] = useState<ProjectDescriptor[]>([]);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        void repository.list().then(setProjects);
    }, [repository, version]);

    const copy = async (example: LoadedExample) => {
        await workspace.current?.addProject(example.project);
        setVersion((value) => value + 1);
    };

    return (
        <Stack gap="xl">
            <ExampleGallery
                client={client}
                workspaceOrigins={projects.flatMap((project) => (project.origin ? [project.origin] : []))}
                onCopy={(example) => void copy(example)}
                onShowDetails={fn()}
            />
            <Text fw={600}>Local workspace</Text>
            <LocalWorkspace ref={workspace} repository={repository} factory={factory} library={client} onOpen={fn()} />
        </Stack>
    );
}

const meta: Meta = {
    title: 'Components/Example Library',
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Read-only browsing of the published `rimvydasb/edgerules-examples` repository through jsDelivr. ' +
                    'The stories read the live index, so they need network access.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

export const GalleryNextToWorkspace: Story = {
    loaders: [async () => openStoryWorkspace()],
    render: (_args, {loaded}) => <GalleryWithWorkspace {...(loaded as Loaded)} />,
};

export const FeaturedRow: Story = {
    render: () => <ExampleGallery client={client} featured onCopy={fn()} onShowDetails={fn()} />,
};

export const Details: Story = {
    render: () => {
        const Details = () => {
            const [example, setExample] = useState<ExampleCoordinates>({id: 'loan-repayment', version: '1.2.0'});
            return (
                <ExampleDetails
                    client={client}
                    example={example}
                    onVersionChange={setExample}
                    onShowDetails={setExample}
                    onCopy={fn()}
                    shareUrl={({id, version}) => `https://modeler.example/examples/financial/${id}@${version}`}
                    repositoryUrl={(entry, ref) => EXAMPLES_REPOSITORY_URL(entry.path, ref)}
                />
            );
        };
        return <Details />;
    },
};

export const Industries: Story = {
    render: () => <IndustryGrid client={client} onSelectIndustry={fn()} />,
};

export const IndexFailure: Story = {
    name: 'Index failure with retry',
    render: () => {
        const broken = createExamplesClient();
        const failing = {
            ...broken,
            loadIndex: () => Promise.reject(new Error(`library.json: HTTP 503 (${EXAMPLES_SOURCE.indexUrl})`)),
        };
        return <ExampleGallery client={failing} onCopy={fn()} onShowDetails={fn()} />;
    },
};
