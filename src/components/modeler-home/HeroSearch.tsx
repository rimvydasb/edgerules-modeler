import {Loader, Text, TextInput} from '@mantine/core';
import {IconBooks, IconSearch, IconSitemap} from '@tabler/icons-react';
import {cx} from '#ui/cx';
import {KIND_COLORS} from '#ui/kindColors';
import {useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement} from 'react';
import type {Suggestion} from './homeModel';
import * as classes from './modelerHome.module.css';

export interface HeroSearchProps {
    suggestions: (query: string) => Suggestion[];
    placeholder: string;
    loading?: boolean;
    onSearch: (query: string) => void;
    onPick: (suggestion: Suggestion) => void;
}

/** The hero search box: a dropdown of example and project suggestions in two groups. `/` focuses it. */
export function HeroSearch({suggestions, placeholder, loading, onSearch, onPick}: HeroSearchProps): ReactElement {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(-1);
    const [open, setOpen] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const listId = useId();

    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.key !== '/' || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            event.preventDefault();
            input.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const items = open ? suggestions(query) : [];
    const groups = [
        {title: 'Examples', kind: 'example' as const},
        {title: 'Your projects', kind: 'project' as const},
    ];

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (items.length === 0) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((active + step + items.length) % items.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const picked = items[active];
            if (picked) onPick(picked);
            else if (query.trim()) onSearch(query.trim());
            setOpen(false);
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className={classes.search}>
            <TextInput
                ref={input}
                size="md"
                leftSection={<IconSearch size={16} />}
                placeholder={placeholder}
                aria-label="Search examples and projects"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                rightSection={loading ? <Loader size="xs" /> : undefined}
                value={query}
                onChange={(event) => {
                    setQuery(event.currentTarget.value);
                    setActive(-1);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
            />
            {items.length > 0 && (
                <div id={listId} role="listbox" className={classes.suggestions}>
                    {groups.map(({title, kind}) => {
                        const group = items.filter((item) => item.kind === kind);
                        if (group.length === 0) return null;
                        return (
                            <div key={kind} role="group" aria-label={title} className={classes.group}>
                                <div className={classes.groupLabel}>{title}</div>
                                {group.map((item) => {
                                    const index = items.indexOf(item);
                                    return (
                                        <div
                                            key={item.key}
                                            id={`${listId}-${index}`}
                                            role="option"
                                            aria-selected={index === active}
                                            className={cx(classes.option, index === active && classes.optionActive)}
                                            // mousedown fires before the input blur closes the list
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                onPick(item);
                                                setOpen(false);
                                            }}
                                        >
                                            <span
                                                className={classes.optionIcon}
                                                style={{
                                                    backgroundColor:
                                                        kind === 'example' ? KIND_COLORS.function : KIND_COLORS.model,
                                                }}
                                                aria-hidden="true"
                                            >
                                                {kind === 'example' ? (
                                                    <IconBooks size={15} />
                                                ) : (
                                                    <IconSitemap size={15} />
                                                )}
                                            </span>
                                            <span className={classes.optionText}>
                                                <Text size="sm" fw={500} truncate>
                                                    {item.label}
                                                </Text>
                                                <Text size="xs" c="dimmed" truncate>
                                                    {item.detail}
                                                </Text>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
