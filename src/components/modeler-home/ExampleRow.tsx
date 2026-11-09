import {Alert, SimpleGrid} from '@mantine/core';
import {useState, type ReactElement} from 'react';
import type {ProjectOrigin} from '../project-session';
import type {ExampleCoordinates, LibraryClient, LibraryEntry, LoadedExample} from '../example-library';
import {ExamplePanel, satisfiesEngine, workspaceStatus, type SearchIndex} from '../example-library/internal';

export interface ExampleRowProps {
    client: LibraryClient;
    search: SearchIndex;
    entries: LibraryEntry[];
    engineVersion?: string;
    workspaceOrigins?: ProjectOrigin[];
    onCopy: (example: LoadedExample, open: boolean) => void;
    onShowDetails: (coordinates: ExampleCoordinates) => void;
}

/** A short grid of example panels, for the sections of the Home page that the gallery does not cover. */
export function ExampleRow({
    client,
    search,
    entries,
    engineVersion,
    workspaceOrigins,
    onCopy,
    onShowDetails,
}: ExampleRowProps): ReactElement {
    const [busyId, setBusyId] = useState<string>();
    const [error, setError] = useState<string>();
    const titles = new Map(search.index.industries.map((industry) => [industry.id, industry.title]));

    const copyAndOpen = async (entry: LibraryEntry) => {
        setBusyId(entry.id);
        setError(undefined);
        try {
            onCopy(await client.loadExample(entry, entry.versions[0].version), true);
        } catch (failure) {
            setError(`${entry.name}: ${failure instanceof Error ? failure.message : String(failure)}`);
        } finally {
            setBusyId(undefined);
        }
    };

    return (
        <>
            {error && (
                <Alert color="red" role="alert" mb="xs" withCloseButton onClose={() => setError(undefined)}>
                    {error}
                </Alert>
            )}
            <SimpleGrid cols={{base: 1, sm: 2, lg: 3}}>
                {entries.map((entry) => (
                    <ExamplePanel
                        key={entry.id}
                        entry={entry}
                        industryTitle={titles.get(entry.industry) ?? entry.industry}
                        status={workspaceStatus(entry, workspaceOrigins)}
                        incompatible={engineVersion !== undefined && !satisfiesEngine(engineVersion, entry.engine)}
                        thumbnailUrl={
                            entry.thumbnail
                                ? client.resolveFileUrl(entry, entry.versions[0].version, entry.thumbnail)
                                : undefined
                        }
                        busy={busyId === entry.id}
                        onCopyAndOpen={() => void copyAndOpen(entry)}
                        onDetails={() => onShowDetails({id: entry.id, version: entry.versions[0].version})}
                    />
                ))}
            </SimpleGrid>
        </>
    );
}
