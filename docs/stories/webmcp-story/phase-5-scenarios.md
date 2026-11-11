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

- [x] Add scenario fixtures in `src/components/webmcp/__tests__/scenarios/`: a task, the tool calls and the expected
      regression reports
- [x] Cover these change-and-react scenarios:
  - [x] Change a ruleset row, get one newly failing case, fix the row, get it newly passing
  - [x] Add a function and its test cases, get every case passing
  - [x] Rename a callable that a ruleset uses, get `changed` with the rewritten paths and no newly failing case
  - [x] Send a change with a link error, get the diagnostics, send the fixed change
  - [x] Undo a wrong change, get the failing cases newly passing
- [x] Replay each fixture through `execute` of the registered tools and compare each regression report

Acceptance criteria:

- [x] `npm test` passes, including `scenarios.test.ts`

## Verification

Run the commands of [Verification](../webmcp-story.md#verification) that this phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```

## Implementation notes

- **Entry points:** `webmcp/__tests__/scenarios/scenario.ts` — `Scenario`, `ScenarioStep`, `RULESET_MODEL`,
  `RULESET_TESTS`, `changeIdOf`. `scenarios/index.ts` — `SCENARIOS` (five fixtures, one file each).
  `__tests__/scenarios.test.ts` — the replay through `openToolsFixture().call`.
- **Contracts:** A step expects `{ok: true, regression, changed?}` or `{ok: false, code, diagnostics?}`. Case lists are
  case names. `input` may be a function of the earlier results (used for the `changeId` of an undo).
- **Deviations and open items:** `changed` of a rename lists the new name (`riskLevel`), not the old one. The ruleset
  scenarios use a first-match `risk` ruleset with two rows. `npm run build` was not run.
