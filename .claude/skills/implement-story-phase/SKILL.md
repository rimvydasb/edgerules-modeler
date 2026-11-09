---
name: implement-story-phase
description: Implement one phase of a story
argument-hint: '@docs/stories/<name>-story.md [phase]'
---

# Implement a story phase

Story document: `$ARGUMENTS`

## Implement

1. Find next phase that is not implemented (checkboxes are not checked). A phase name examples: `phase 2`, `Phase E2E`,
   `Phase X`.
2. Read the whole story
3. Check if there are no open questions or blockers defined in the document and tasks do not contradict each other
4. Do tasks by the logical order that makes sense
5. Review acceptance criteria
6. Write down necessary unit tests
7. Write down necessary e2e tests
8. Write down if necessary storybook stories

- Never silence a dependency-cruiser violation by editing the rules or the baseline. Fix the import.
- A task that is wrong or impossible: stop and ask the user. Do not change the story silently.

## Verify

Run the commands of the story's `## Verification` table that the phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```

Add `npm run build` for packaging changes and `npm run e2e` for the E2E phase. Fix failures; do not report a phase as
done while a command fails.

## Tick the checkboxes

Edit the story file. Change `- [ ]` to `- [x]` for every task and acceptance criterion of this phase that is done and
verified. Leave an item open when it is not done, and say why in the report. Do this in the same turn as the code; it is
part of the deliverable.

## Report

Short summary: what changed per task, the commands that passed, the checkboxes ticked, and any deviation from the story
or open item. Do not commit unless the user asks.
