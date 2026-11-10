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

- [ ] Update `docs/architecture.md` with the changes from `## Architecture Changes`
- [ ] Add the four ADR entries to `docs/architecture-adr.md`
- [ ] Add the `webmcp` component to `README.md`
- [ ] Review the implementation against this story and the project conventions

Acceptance criteria:

- [ ] Every command in `## Verification` passes
- [ ] The application starts with `npm run dev`, and Chrome with `#enable-webmcp-testing` lists the tools
