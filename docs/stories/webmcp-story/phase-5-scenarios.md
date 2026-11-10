# WebMCP Phase 5: agent scenarios

This phase replays the change-and-react loop as fixed scenarios through the registered tools.

| Attribute         | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Story             | [webmcp-story.md](../webmcp-story.md)                          |
| Recommended model | Sonnet. The phase writes test fixtures against finished tools. |
| Depends on        | Phase 4                                                        |

Read these sections of the main story before you start. Do not read the other phase files.

- [The agent works in a change-and-react loop](../webmcp-story.md#the-agent-works-in-a-change-and-react-loop)
- [Tool catalog](../webmcp-story.md#tool-catalog)

## Technical Breakdown

- A scenario is a fixture: a task text, the tool calls in order, and the expected result of each call.
- The replay uses `testing/toolsFixture.ts` and `testing/recordingModelContext.ts` from Phase 1.
- A scenario compares each `regression` report: `newlyFailing`, `newlyPassing` and the totals.

## Tasks

- [ ] Add scenario fixtures in `src/components/webmcp/__tests__/scenarios/`: a task, the tool calls and the expected
      regression reports
- [ ] Cover these change-and-react scenarios:
  - [ ] Change a ruleset row, get one newly failing case, fix the row, get it newly passing
  - [ ] Add a function and its test cases, get every case passing
  - [ ] Rename a callable that a ruleset uses, get `changed` with the rewritten paths and no newly failing case
  - [ ] Send a change with a link error, get the diagnostics, send the fixed change
  - [ ] Undo a wrong change, get the failing cases newly passing
- [ ] Replay each fixture through `execute` of the registered tools and compare each regression report

Acceptance criteria:

- [ ] `npm test` passes, including `scenarios.test.ts`

## Verification

Run the commands of [Verification](../webmcp-story.md#verification) that this phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```
