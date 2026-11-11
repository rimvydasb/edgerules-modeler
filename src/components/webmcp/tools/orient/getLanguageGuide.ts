import {validateInputMembers} from '../../core/paths';
import {fail} from '../../core/toolResult';
import type {GetLanguageGuideInput, GuidePage, GuideTopic} from '../../project/guide/languageGuide';
import {GUIDE_TOPICS} from '../../project/guide/topics';
import {inputSchema, resultSchema} from '../../protocol/schemas';
import type {ProjectTool} from '../projectTool';
import {validateOffset} from '../inspect/inspectInput';

export const getLanguageGuide: ProjectTool<GetLanguageGuideInput, GuidePage> = {
    name: 'get-language-guide',
    title: 'Get language guide',
    description:
        'Returns the EdgeRules language reference for one topic, with valid examples and their outputs. Without a ' +
        'section, it returns the introduction of the topic and its section titles. Read the introduction topic before ' +
        'you write EdgeRules code for the first time, and the topic of each construct you use.',
    inputSchema: inputSchema(
        {
            topic: {enum: [...GUIDE_TOPICS], description: 'The reference topic.'},
            section: {type: 'string', description: 'A section title from `sections`; omit for the introduction.'},
            offset: {type: 'integer', description: '`nextOffset` of the previous page.'},
        },
        ['topic'],
    ),
    outputSchema: resultSchema(
        {
            topic: {type: 'string'},
            section: {type: 'string'},
            text: {type: 'string'},
            sections: {type: 'array', items: {type: 'string'}},
            nextOffset: {type: 'integer'},
        },
        ['topic', 'text', 'sections'],
    ),
    annotations: {readOnlyHint: true, untrustedContentHint: false, consequentialHint: false},
    availability: 'always',

    async run(input, context) {
        const invalid = validateInputMembers(input, ['topic', 'section', 'offset']) ?? validateOffset(input.offset);
        if (invalid) return {ok: false, error: invalid};
        if (!GUIDE_TOPICS.includes(input.topic as GuideTopic)) {
            return fail('InvalidInput', `Unknown topic ${JSON.stringify(input.topic)}.`, {
                hint: `Topics: ${GUIDE_TOPICS.join(', ')}.`,
            });
        }
        if (input.section !== undefined && typeof input.section !== 'string') {
            return fail('InvalidInput', "'section' must be a string.");
        }
        return context.guide.page(input);
    },
};
