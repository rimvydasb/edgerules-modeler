import {addFunctionWithCases} from './addFunctionWithCases';
import {changeRulesetRow} from './changeRulesetRow';
import {linkErrorThenFix} from './linkErrorThenFix';
import {renameUsedCallable} from './renameUsedCallable';
import type {Scenario} from './scenario';
import {undoWrongChange} from './undoWrongChange';

export const SCENARIOS: Scenario[] = [
    changeRulesetRow,
    addFunctionWithCases,
    renameUsedCallable,
    linkErrorThenFix,
    undoWrongChange,
];
