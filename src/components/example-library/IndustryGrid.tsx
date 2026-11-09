import {Alert, Button, Loader, SimpleGrid, Text, UnstyledButton} from '@mantine/core';
import type {ReactElement} from 'react';
import {IndustryIcon} from './industryIcon';
import {countByIndustry} from './libraryQuery';
import type {LibraryClient} from './types';
import {useLibraryIndex} from './useLibraryIndex';

export interface IndustryGridProps {
    client: LibraryClient; // from createLibraryClient(source)
    onSelectIndustry: (industry: string) => void; // the host navigates to /examples/<industry>
}

/** One tile per industry of the index: icon, title, description and example count. */
export function IndustryGrid({client, onSelectIndustry}: IndustryGridProps): ReactElement {
    const {search, error, retry} = useLibraryIndex(client);
    if (error) {
        return (
            <Alert color="red" role="alert">
                {error}{' '}
                <Button size="compact-xs" onClick={retry}>
                    Retry
                </Button>
            </Alert>
        );
    }
    if (!search) return <Loader size="sm" aria-label="Loading industries" />;
    const counts = countByIndustry(search.index);
    return (
        <SimpleGrid cols={{base: 1, sm: 2, md: 3, lg: 4}} data-testid="industry-grid">
            {search.index.industries.map((industry) => (
                <UnstyledButton
                    key={industry.id}
                    onClick={() => onSelectIndustry(industry.id)}
                    aria-label={`${industry.title}, ${counts.get(industry.id) ?? 0} examples`}
                    style={{border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, padding: 12}}
                >
                    <IndustryIcon name={industry.icon ?? industry.id} />
                    <Text fw={600}>{industry.title}</Text>
                    {industry.description && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                            {industry.description}
                        </Text>
                    )}
                    <Text size="sm" mt={4}>
                        {counts.get(industry.id) ?? 0}
                    </Text>
                </UnstyledButton>
            ))}
        </SimpleGrid>
    );
}
