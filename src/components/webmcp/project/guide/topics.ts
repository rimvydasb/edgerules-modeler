import annotations from './reference/annotations-story.md?raw';
import decisionLayers from './reference/decision-layers-reference.md?raw';
import dates from './reference/dates-reference.md?raw';
import explain from './reference/explain-reference.md?raw';
import financeFunctions from './reference/finance-functions-reference.md?raw';
import introduction from './reference/base-examples.md?raw';
import listFunctions from './reference/list-functions-reference.md?raw';
import loops from './reference/loop-reference.md?raw';
import numericFunctions from './reference/numeric-functions-reference.md?raw';
import optimise from './reference/optimise-reference.md?raw';
import optimiseExamples from './reference/optimise-examples.md?raw';
import exampleModel from './reference/playground.md?raw';
import rulesets from './reference/rulesets-reference.md?raw';
import stringFunctions from './reference/string-functions-reference.md?raw';
import userFunctions from './reference/user-functions-reference.md?raw';
import userTypes from './reference/user-types-reference.md?raw';

/** One topic for each Markdown file of `../edgerules/docs/reference/`. */
export type GuideTopic =
    | 'introduction' // base-examples.md: literals, operators, lists, filters, ranges, contexts, dates, special values
    | 'user-functions'
    | 'user-types'
    | 'rulesets'
    | 'loops'
    | 'optimise'
    | 'optimise-examples'
    | 'decision-layers' // `facts`, `decision`, `service`
    | 'annotations'
    | 'explain'
    | 'dates'
    | 'list-functions'
    | 'string-functions'
    | 'numeric-functions'
    | 'finance-functions'
    | 'example-model'; // playground.md: a complete loan origination model

/** The Markdown text of each topic. */
export const GUIDE_TEXTS: Readonly<Record<GuideTopic, string>> = {
    introduction,
    'user-functions': userFunctions,
    'user-types': userTypes,
    rulesets,
    loops,
    optimise,
    'optimise-examples': optimiseExamples,
    'decision-layers': decisionLayers,
    annotations,
    explain,
    dates,
    'list-functions': listFunctions,
    'string-functions': stringFunctions,
    'numeric-functions': numericFunctions,
    'finance-functions': financeFunctions,
    'example-model': exampleModel,
};

export const GUIDE_TOPICS = Object.keys(GUIDE_TEXTS) as GuideTopic[];
