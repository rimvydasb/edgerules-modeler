---
name: implement-story-phase
description: Implement one phase of a story
argument-hint: '@docs/stories/<name>-story.md [phase] | @docs/stories/<name>-story/<phase file>'
---

# Implement a story phase

Story document: `$ARGUMENTS`

## Find the phase and load only its context

A story has one of two layouts. Load as little of it as the layout allows.

**Single-file story** (`docs/stories/<name>-story.md` has a `## Tasks` section with the phases):

1. Find the phase: the one the arguments name, else the first phase with an unchecked box. Phase names look like
   `Phase 2`, `Phase E2E`, `Phase X`.
2. Read the whole story.

**Split story** (`docs/stories/<name>-story.md` has a `## Phases` table, and `docs/stories/<name>-story/` holds one file
per phase):

1. Find the phase file:
   - The arguments name a phase file: use it.
   - The arguments name the main story and a phase: use the file of that row in the `## Phases` table.
   - The arguments name only the main story: use the first row whose file has an unchecked box and whose `Depends on`
     phases have every box checked. Read only the `## Phases` section of the main story for this. Find it with
     `grep -n '^## ' <main story>`, then read that line range.
2. Read the whole phase file.
3. Read only the main-story sections that the phase file lists under "Read these sections". Find each one with
   `grep -n '^##' <main story>` and read only its line range (`Read` with `offset` and `limit`). Do not read the whole
   main story, and do not read other phase files.
4. Read the `## Verification` section of the main story the same way.
5. Code that earlier phases built is the source of truth for their contracts. To find that code, read only the
   `## Implementation notes` section of each phase file in the `Depends on` column (find it with `grep -n '^## '`). Then
   read the code that the notes point to. Do not read the rest of those phase files.

**Recommended model:** a phase file names one in its header table. If the current model differs, tell the user in one
line before you start (they switch models in the app; you cannot). Then continue.

## Implement

1. Check that the loaded text has no open questions or blockers, and that the tasks do not contradict each other.
2. Do the tasks in a logical order.
3. Review the acceptance criteria.
4. Write the necessary unit tests.
5. Write the necessary e2e tests.
6. Write Storybook stories where necessary.

- Never silence a dependency-cruiser violation by editing the rules or the baseline. Fix the import.
- A task that is wrong or impossible: stop and ask the user. Do not change the story silently.
- A task needs a main-story section that the phase file does not list: read that one section, and say so in the report
  so the phase file can list it.

## Verify

Run the commands of the story's `## Verification` table that the phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```

Add `npm run build` for packaging changes and `npm run e2e` for the E2E phase. Fix failures; do not report a phase as
done while a command fails.

## Tick the checkboxes

Edit the file that holds the phase: the story file for a single-file story, the phase file for a split story. Change
`- [ ]` to `- [x]` for every task and acceptance criterion of this phase that is done and verified. Leave an item open
when it is not done, and say why in the report. Do this in the same turn as the code; it is part of the deliverable.

## Write the handoff

For a split story, append an `## Implementation notes` section to the end of the phase file. Later phases read this
section instead of searching the code. Keep it to 5–15 lines:

- **Entry points:** the files and exported symbols that later phases use, as `path` — `Symbol`: one-line purpose.
- **Contracts:** decisions that are not obvious from the story, such as names, signatures or semantics that differ from
  the story, and invariants that later code must keep.
- **Deviations and open items:** what differs from the phase file, and why.

Write only facts that a later phase needs. Do not repeat the story or describe how you did the work. If the section
already exists because the phase was continued, update it. For a single-file story, skip this step.

## Report

Short summary: what changed per task, the commands that passed, the checkboxes ticked, and any deviation from the story
or open item. Do not commit unless the user asks.
