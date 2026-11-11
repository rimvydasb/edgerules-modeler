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

- [ ] Add the Playwright project `webmcp` to `playwright.config.ts`: Chromium with
      `launchOptions.args: ['--enable-features=WebMCP']` and `testMatch: 'webmcp/**'`
- [ ] Add `e2e/webmcp/webmcp.spec.ts`. It opens a Storybook Modeler project and uses `page.webmcp.tools()` and
      `page.webmcp.callTool()` of Playwright 1.64
- [ ] Cover these flows:
  - [ ] `tools()` lists every registered tool with its annotations
  - [ ] `callTool('edit-model')` breaks a test case, and the result has the case in `newlyFailing`
  - [ ] The Tests view shows the failure, and the toast shows the regression totals
  - [ ] "Undo" in the toast reverts the change, and the Tests view shows the case passing
  - [ ] `callTool('edit-model')` on the entry open in the Code view with typed text shows the conflict bar
  - [ ] A read-only project lists only the read tools and `open-in-editor`

Acceptance criteria:

- [ ] `npm run e2e` passes, including `webmcp.spec.ts`

## Verification

```sh
npm run e2e
```
