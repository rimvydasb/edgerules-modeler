# WebMCP Phase X: documentation and review

This phase moves the story decisions into the project documents and reviews the implementation.

| Attribute         | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Story             | [webmcp-story.md](../webmcp-story.md)                          |
| Recommended model | Sonnet. The phase updates documents and reviews finished code. |
| Depends on        | Phases 5 and E2E                                               |

Read these sections of the main story before you start. Do not read the other phase files.

- [Architecture Changes](../webmcp-story.md#architecture-changes)
- [Verification](../webmcp-story.md#verification)

## Tasks

- [x] Update `docs/architecture.md` with the changes from `## Architecture Changes`
- [x] Add the four ADR entries to `docs/architecture-adr.md`
- [x] Add the `webmcp` component to `README.md`
- [ ] Review the implementation against this story and the project conventions

Acceptance criteria:

- [ ] Every command in `## Verification` passes
- [ ] The application starts with `npm run dev`, and Chrome with `#enable-webmcp-testing` lists the tools

## Implementation notes

- **Entry points:** `docs/architecture.md` — component table row, `webmcp-layer-*` and `webmcp` allowlist rows, section
  "WebMCP tools go through the open session". `docs/architecture-adr.md` — ADR-004 to ADR-007. `README.md` — the
  `webmcp` entry.
- **Deviations and open items:** The review task is open: only the dependency-cruiser config and the story allowlist
  were compared (they match); the code was not reviewed line by line. `npm run e2e` has 27 failures outside this story
  (26 `visual/grids` screenshots, `flow-editor/object-input-node.spec.ts:69`). `npm run dev` starts; the tool list in
  Chrome with `#enable-webmcp-testing` was not checked by hand (the `webmcp` Playwright project covers it on the Modeler
  story). The story's `protocol/outputBudget.ts` layout is outdated: it lives in `core/outputBudget.ts`.
