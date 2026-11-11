import {fail, ok, type ToolResult} from '../../core/toolResult';
import {pageOf} from '../../core/textPage';
import {GUIDE_TEXTS, GUIDE_TOPICS, type GuideTopic} from './topics';

export type {GuideTopic};

export const GUIDE_PAGE_SIZE = 6_000;

export interface GetLanguageGuideInput {
    topic: GuideTopic;
    section?: string; // a `##` heading title from `sections`; omit for the introduction of the topic
    offset?: number; // from `nextOffset` of the previous page
}

export interface GuidePage {
    topic: GuideTopic;
    section?: string;
    text: string; // Markdown: without `section`, the text before the first `##` heading
    sections: string[]; // every `##` heading title of the topic
    nextOffset?: number; // present when the text continues; a page has at most 6,000 characters
}

export interface LanguageGuide {
    topics(): readonly GuideTopic[];
    page(input: GetLanguageGuideInput): ToolResult<GuidePage>;
}

interface ParsedTopic {
    introduction: string; // the text before the first `##` heading; empty when the file starts with one
    sections: {title: string; text: string}[];
}

/** Splits Markdown at its `## ` headings; a line inside a code fence is never a heading. */
export function parseTopic(markdown: string): ParsedTopic {
    const introduction: string[] = [];
    const sections: {title: string; lines: string[]}[] = [];
    let fence = false;
    for (const line of markdown.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) fence = !fence;
        const heading = !fence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
        if (heading) sections.push({title: heading[1], lines: [line]});
        else (sections.length > 0 ? sections[sections.length - 1].lines : introduction).push(line);
    }
    return {
        introduction: introduction.join('\n').trim(),
        sections: sections.map(({title, lines}) => ({title, text: lines.join('\n').trim()})),
    };
}

export function createLanguageGuide(texts: Readonly<Record<GuideTopic, string>> = GUIDE_TEXTS): LanguageGuide {
    const parsed = new Map<GuideTopic, ParsedTopic>();
    const parse = (topic: GuideTopic): ParsedTopic => {
        let result = parsed.get(topic);
        if (!result) parsed.set(topic, (result = parseTopic(texts[topic])));
        return result;
    };

    return {
        topics: () => GUIDE_TOPICS,

        page({topic, section, offset = 0}) {
            if (!GUIDE_TOPICS.includes(topic)) {
                return fail('InvalidInput', `Unknown topic '${String(topic)}'.`, {
                    hint: `Topics: ${GUIDE_TOPICS.join(', ')}.`,
                });
            }
            if (!Number.isInteger(offset) || offset < 0) {
                return fail('InvalidInput', `'offset' must be a non-negative integer; got ${JSON.stringify(offset)}.`);
            }
            const {introduction, sections} = parse(topic);
            const titles = sections.map((entry) => entry.title);
            // A topic without text before its first `##` heading starts with that first section.
            let source = introduction === '' ? (sections[0]?.text ?? '') : introduction;
            if (section !== undefined) {
                const found = sections.find((entry) => entry.title === section);
                if (!found) {
                    return fail('NotFound', `The topic '${topic}' has no section '${section}'.`, {
                        hint: `Sections: ${titles.join('; ')}.`,
                    });
                }
                source = found.text;
            }
            if (offset > source.length) {
                return fail('InvalidInput', `'offset' ${offset} is past the end of the text (${source.length}).`);
            }
            const page = pageOf(source, offset, GUIDE_PAGE_SIZE);
            return ok({
                topic,
                ...(section !== undefined && {section}),
                text: page.text,
                sections: titles,
                ...(page.nextOffset !== undefined && {nextOffset: page.nextOffset}),
            });
        },
    };
}
