import {describe, expect, it} from 'vitest';
import guideSource from '../../project/guide/guide-source.json';
import {GUIDE_PAGE_SIZE, createLanguageGuide, parseTopic} from '../../project/guide/languageGuide';
import {GUIDE_TEXTS, GUIDE_TOPICS, type GuideTopic} from '../../project/guide/topics';

const guide = createLanguageGuide();

describe('language guide', () => {
    it('has one topic for each copied reference file', () => {
        expect(GUIDE_TOPICS).toHaveLength(16);
        expect(guideSource.files).toHaveLength(GUIDE_TOPICS.length);
        expect(guideSource.commit).toMatch(/^[0-9a-f]{40}$/);
    });

    it.each(GUIDE_TOPICS.map((topic) => [topic] as const))('loads the topic %s with its sections', (topic) => {
        const first = guide.page({topic});
        if (!first.ok) throw new Error(first.error.message);
        expect(first.topic).toBe(topic);
        expect(first.text.length).toBeGreaterThan(0);
        expect(first.text.length).toBeLessThanOrEqual(GUIDE_PAGE_SIZE);
        expect(first.sections.length).toBeGreaterThan(0);
        for (const section of first.sections) {
            const page = guide.page({topic, section});
            expect(page.ok, `${topic}: ${section}`).toBe(true);
            if (page.ok) expect(page.text.startsWith(`## ${section}`)).toBe(true);
        }
    });

    it('pages a section longer than 6,000 characters and rebuilds it from its pages', () => {
        const body = Array.from({length: 700}, (_, index) => `line ${index} of a long section`).join('\n');
        const long = createLanguageGuide({
            ...GUIDE_TEXTS,
            dates: `intro\n\n## Long\n\n${body}\n\n## Short\n\nend`,
        });
        const section = {title: 'Long', text: `## Long\n\n${body}`};
        const topic = 'dates';
        let text = '';
        let offset: number | undefined = 0;
        let pages = 0;
        while (offset !== undefined) {
            const page = long.page({topic, section: section.title, offset});
            if (!page.ok) throw new Error(page.error.message);
            expect(page.text.length).toBeLessThanOrEqual(GUIDE_PAGE_SIZE);
            text += page.text;
            offset = page.nextOffset;
            pages += 1;
        }
        expect(pages).toBeGreaterThan(1);
        expect(text).toBe(section.text);
    });

    it('starts a topic without a preamble with its first section', () => {
        const annotations = guide.page({topic: 'annotations'});
        expect(annotations).toMatchObject({ok: true});
        if (annotations.ok) expect(annotations.text.startsWith('## ')).toBe(true);
    });

    it('fails with NotFound and the section titles for an unknown section', () => {
        const result = guide.page({topic: 'dates', section: 'No such section'});
        expect(result).toMatchObject({ok: false, error: {code: 'NotFound'}});
        if (!result.ok) expect(result.error.hint).toContain('Sections:');
    });

    it('fails with InvalidInput for an unknown topic and an offset past the end', () => {
        expect(guide.page({topic: 'nope' as GuideTopic})).toMatchObject({ok: false, error: {code: 'InvalidInput'}});
        expect(guide.page({topic: 'dates', offset: 1_000_000})).toMatchObject({
            ok: false,
            error: {code: 'InvalidInput'},
        });
    });

    it('does not take a heading inside a code fence for a section', () => {
        const parsed = parseTopic('intro\n\n```\n## not a heading\n```\n\n## Real\n\nbody');
        expect(parsed.sections.map((section) => section.title)).toEqual(['Real']);
        expect(parsed.introduction).toContain('## not a heading');
    });
});
