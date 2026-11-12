import {describe, expect, it} from 'vitest';
import {
    buildSearchIndex,
    featuredExamples,
    newestExamples,
    relatedExamples,
    searchExamples,
    workspaceStatus,
} from '../libraryQuery';
import {satisfiesEngine} from '../semver';
import {fixtureIndex} from '../testing/fixtureLibrary';
import type {LibraryEntry, LibraryIndex} from '../types';

const ids = (entries: LibraryEntry[]) => entries.map((entry) => entry.id);

describe('searchExamples', () => {
    const search = buildSearchIndex(fixtureIndex());

    it('matches name, description, tags, features, id and the industry title', () => {
        expect(ids(searchExamples(search, {query: 'repayment'}))).toContain('loan-repayment');
        expect(ids(searchExamples(search, {query: 'optimisation'}))).toEqual(['client-outreach']);
        expect(ids(searchExamples(search, {query: 'FINANCIAL'}))).toHaveLength(3);
        expect(ids(searchExamples(search, {query: 'loan repayment'}))).toEqual(['loan-repayment']);
        expect(searchExamples(search, {query: 'zzzz'})).toEqual([]);
    });

    it('filters by level and by all selected features', () => {
        expect(ids(searchExamples(search, {level: 'advanced'}))).toEqual(['client-outreach']);
        expect(ids(searchExamples(search, {features: ['optimise', 'workbook']}))).toEqual(['client-outreach']);
        expect(searchExamples(search, {features: ['optimise', 'chart']})).toEqual([]);
    });

    it('filters by engine compatibility', () => {
        expect(searchExamples(search, {compatibleWith: '0.2.8-alpha'})).toHaveLength(3);
        expect(searchExamples(search, {compatibleWith: '0.1.0'})).toEqual([]);
    });

    it('sorts by name and by last release, and ranks a name match first', () => {
        expect(ids(searchExamples(search, {sort: 'name'}))).toEqual([
            'client-outreach',
            'loan-origination',
            'loan-repayment',
        ]);
        expect(ids(searchExamples(search, {sort: 'release'}))[0]).toBe('loan-repayment'); // 1.3.0 is newer
        expect(ids(searchExamples(search, {query: 'origination'}))[0]).toBe('loan-origination');
    });

    it('finds a match among 5 000 generated entries in less than 50 ms', () => {
        const base = fixtureIndex().examples[0];
        const generated: LibraryIndex = {
            ...fixtureIndex(),
            examples: Array.from({length: 5000}, (_, i) => ({
                ...base,
                id: `example-${i}`,
                name: `Example ${i} ${i === 4321 ? 'zebra' : 'plain'}`,
                tags: ['tag', `t${i}`],
            })),
        };
        const big = buildSearchIndex(generated);
        const started = performance.now();
        const found = searchExamples(big, {query: 'zebra'});
        const elapsed = performance.now() - started;
        expect(ids(found)).toEqual(['example-4321']);
        expect(elapsed).toBeLessThan(50);
    });
});

describe('library helpers', () => {
    const index = fixtureIndex();

    it('lists the featured examples in order, and the newest releases first', () => {
        expect(ids(featuredExamples(index))).toEqual(index.featured);
        expect(ids(newestExamples(index, 1))).toEqual(['loan-repayment']);
    });

    it('orders related examples of one industry by shared features, without the example itself', () => {
        const entry = index.examples.find((candidate) => candidate.id === 'loan-repayment')!;
        const related = relatedExamples(index, entry);
        expect(ids(related)).not.toContain('loan-repayment');
        expect(related).toHaveLength(2);
    });

    it('tells what the workspace holds of an example', () => {
        const entry = index.examples.find((candidate) => candidate.id === 'loan-repayment')!;
        const origin = (version: string) => ({library: 'x', id: 'loan-repayment', version});
        expect(workspaceStatus(entry, [])).toBe('none');
        expect(workspaceStatus(entry, [origin('1.3.0')])).toBe('in-workspace');
        expect(workspaceStatus(entry, [origin('1.2.0')])).toBe('update-available');
        expect(workspaceStatus(entry, [origin('1.2.0'), origin('1.3.0')])).toBe('in-workspace');
    });
});

describe('satisfiesEngine', () => {
    it('compares versions with prerelease tags', () => {
        expect(satisfiesEngine('0.2.7-alpha', '>=0.2.7-alpha')).toBe(true);
        expect(satisfiesEngine('0.2.6-alpha.202611081809', '>=0.2.7-alpha')).toBe(false);
        expect(satisfiesEngine('0.2.7', '>=0.2.7-alpha')).toBe(true);
        expect(satisfiesEngine('0.3.0', '>=0.2.7-alpha <0.3.0')).toBe(false);
        expect(satisfiesEngine('weird', '>=1.0.0')).toBe(true);
    });
});
