# WebMCP Phase E2E: Playwright WebMCP flows

This phase tests the tools in a real Chromium through the Playwright WebMCP API.

| Attribute         | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Story             | [webmcp-story.md](../webmcp-story.md)                              |
| Recommended model | Sonnet. The phase writes browser tests against a finished feature. |
| Depends on        | Phase 4                                                            |

Read these sections of the main story before you start. Do not read the other phase files.

- [WebMCP platform contract](../webmcp-story.md#webmcp-platform-contract)
- [Tool catalog](../webmcp-story.md#tool-catalog)

## Technical Breakdown

- Playwright 1.64 has `page.webmcp.tools()` and `page.webmcp.callTool(name, input)`.
- Chromium enables WebMCP with the launch argument `--enable-features=WebMCP`.
- `tools()` reports annotations as `readOnly`, `untrustedContent` and `consequential`.
- `callTool` returns the fulfilled value of `execute`. It throws when the tool is not registered.
- The Storybook server of `playwright.config.ts` serves `http://localhost`, which is a secure context.

## Tasks

- [x] Add the Playwright project `webmcp` to `playwright.config.ts`: Chromium with
      `launchOptions.args: ['--enable-features=WebMCP']` and `testMatch: 'webmcp/**'`
- [x] Add `e2e/webmcp/webmcp.spec.ts`. It opens a Storybook Modeler project and uses `page.webmcp.tools()` and
      `page.webmcp.callTool()` of Playwright 1.64
- [x] Cover these flows:
  - [x] `tools()` lists every registered tool with its annotations
  - [x] `callTool('edit-model')` breaks a test case, and the result has the case in `newlyFailing`
  - [x] The Tests view shows the failure, and the toast shows the regression totals
  - [x] "Undo" in the toast reverts the change, and the Tests view shows the case passing
  - [x] `callTool('edit-model')` on the entry open in the Code view with typed text shows the conflict bar
  - [x] A read-only project lists only the read tools and `open-in-editor`

Acceptance criteria:

- [x] `npm run e2e` passes, including `webmcp.spec.ts`

## Verification

```sh
npm run e2e
```

## Implementation notes

- **Entry points:** `playwright.config.ts` — projects: an unnamed one (`testIgnore: 'webmcp/**'`, so the visual snapshot
  names keep no project suffix) and `webmcp` (Chromium, `--enable-features=WebMCP`). `e2e/webmcp/webmcp.spec.ts` — four
  flows over the story `modeler--loan-repayment-project-tests`, which registers the tools on the real
  `document.modelContext`.
- **Contracts:** Chromium reports only the hints that are true: `tools()` gives `annotations` of `{}`/absent for change
  tools and `open-in-editor`. The read-only flow uses the story `services-webmcp-tools--read-only`, because that story
  registers on a recording context, not on `document.modelContext`; it checks the tool picker options.
- **Deviations and open items:** `npm run e2e` has 27 failures outside this phase: 26 `e2e/visual/grids.spec.ts`
  screenshots and `flow-editor/object-input-node.spec.ts:69`. The `webmcp` project passes (4 tests).
