import {Alert, Button} from '@mantine/core';
import type {ReactElement} from 'react';
import {KIND_COLORS} from '#ui/kindColors';
import {SheetBody, SheetDescription, SheetGrid, SheetPanelButton, SheetPanelHeader} from '#ui/sheet';
import {IndustryIcon} from './industryIcon';
import {countByIndustry} from './libraryQuery';
import type {LibraryClient} from './types';
import {useLibraryIndex} from './useLibraryIndex';
import {SodasLoader} from '#ui/SodasLoader';

export interface IndustryGridProps {
    client: LibraryClient; // from createLibraryClient(source)
    onSelectIndustry: (industry: string) => void; // the host navigates to /examples/<industry>
}

/** One tile per industry of the index: icon square, title, example count and description. */
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
    if (!search) return <SodasLoader label="Loading industries" />;
    const counts = countByIndustry(search.index);
    return (
        <SheetGrid compact data-testid="industry-grid">
            {search.index.industries.map((industry) => {
                const count = counts.get(industry.id) ?? 0;
                return (
                    <SheetPanelButton
                        key={industry.id}
                        onClick={() => onSelectIndustry(industry.id)}
                        aria-label={`${industry.title}, ${count} examples`}
                    >
                        <SheetPanelHeader
                            icon={<IndustryIcon name={industry.icon ?? industry.id} size={19} />}
                            iconColor={KIND_COLORS.model}
                            title={industry.title}
                            aside={<span>{count}</span>}
                            only={!industry.description}
                        />
                        {industry.description && (
                            <SheetBody>
                                <SheetDescription>{industry.description}</SheetDescription>
                            </SheetBody>
                        )}
                    </SheetPanelButton>
                );
            })}
        </SheetGrid>
    );
}
