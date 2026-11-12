import {KIND_COLORS} from '#ui/kindColors';
import type {ExampleLevel} from '../project-session';

/** The fill of the icon square of an example: one kind color per level, so the level reads at a glance. */
export const LEVEL_COLORS: Record<ExampleLevel, string> = {
    beginner: KIND_COLORS.decision,
    intermediate: KIND_COLORS.function,
    advanced: KIND_COLORS.ruleset,
};

export const LEVEL_LABELS: Record<ExampleLevel, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};
