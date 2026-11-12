# Architecture Decision Records

## ADR-001: Mantine for UI, plain elements for grid cells

**Status:** accepted.

### Context

The grids render thousands of cells. MUI `TextField` with `sx` was the main cost, and MUI's table borders produced
double lines in nested grids.

Benchmark for 5000 grid cells (median ms, production build, headless Chromium):

| Variant                   | Mount | Rerender |
| ------------------------- | ----- | -------- |
| MUI `TextField` with `sx` | 1113  | 413      |
| Mantine `TextInput`       | 331   | 183      |
| Plain `<input>` with CSS  | 59    | 33       |

### Decision

- Use Mantine (`@mantine/core`, `@mantine/hooks`) for dialogs, menus, tooltips, selects, alerts, buttons and the Project
  Explorer tree. Use `@tabler/icons-react` for icons.
- Use plain elements with CSS Modules for grid rows, cells, in-cell inputs and layout wrappers. CSS Modules use Mantine
  CSS variables so themes apply.
- A cell MUST NOT use a UI library component. A library component MAY sit in a cell only as an overlay.
- Drop `@mui/*` and `@emotion/*` peer dependencies. Public `sx` props become `style`.
- The build bundles CSS Modules into the JS and injects them at runtime (`tsdown.config.ts`), so consumers import only
  `@mantine/core/styles.css`.

### Consequences

- Hosts MUST render a `MantineProvider`.
- Screenshot baselines in `e2e/visual` depend on OS and browser build; create them in one environment.

## ADR-002: A FunctionNode with an unbound required argument stays an editor draft

**Status:** accepted.

### Context

The engine rejects the whole model with `E113` when one invocation misses a required argument. No field of the model
evaluates until the argument is bound.

### Decision

- `FlowEditorService` keeps a node with an unbound required argument in memory only. `getFunctionNode` returns the draft
  over the committed field, and the node shows a "draft" badge.
- The service writes the invocation, with `@node: 'FunctionNode'`, when the last required argument is bound.
- Every write is link-checked. A failed link reverts the write and sets `error.parameter` on the node.

### Consequences

- A draft is lost when the editor closes. The model never contains an invalid invocation.
- Hosts MUST NOT assume that every node on the canvas exists in the model.

## ADR-003: The manifest keeps the library `origin` of a copy

**Status:** accepted.

### Context

`global-project-management.md` §5.3 put fork provenance in the cloud or catalog relationship and kept it out of the
project manifest. The Local Workspace has neither a cloud database nor a catalog: a copy of a library example lives only
in IndexedDB. The Library needs the example coordinates of each copy for the "In workspace" and "Update available"
badges, and the Shell needs them for the origin chip.

### Decision

- `ProjectManifest.origin` stores `{library, id, version}`: the `indexUrl` of the `LibrarySource` that resolved the
  example, the example id and the released version.
- A copy gets `origin` from `LoadedExample.project`. A duplicate keeps the same `origin`.
- The field is optional. An own project has none.
- `ProjectDescriptor` exposes `origin` and `savedAt` for the workspace list and the badges.

### Consequences

- A copied project directory carries the coordinates of its example. The field holds no user or tenant identity, so rule
  1 of §5.3 still holds.
- A cloud store MAY still keep its own fork relationship. `origin` is the merge base for a future three-way merge.
- The `origin` of a copy never changes automatically: a newer example version is a new copy.

## ADR-004: A change tool returns its outcome

**Status:** accepted.

### Context

A companion agent changes the model and needs to know whether the change worked. Reading the project back after each
write costs context and calls.

### Decision

- Each change tool links the model and runs every test case of the project, then returns the outcome: the link
  diagnostics (entry, line, engine code), or a regression report with `newlyFailing` (expected and actual values),
  `stillFailing` and `newlyPassing`.
- The agent does not read the project back to verify a change. The read tools serve troubleshooting only.

### Consequences

- A change result is larger than a bare acknowledgement, so the report is fitted to 1,500 characters.
- A link error changes nothing, so the agent never has to repair a half-applied change.

## ADR-005: Tools return an error envelope and do not reject

**Status:** accepted.

### Context

WebMCP `execute` may reject, but a rejection gives the agent an opaque error.

### Decision

- Every tool resolves to `{ok: true, ...}` or `{ok: false, error: {code, message, hint?}}`.
- A domain error (`InvalidInput`, `ParseError`, `LinkError`, `UndoBlocked`, `VersionConflict`) never rejects. The
  registry turns an abort into `Aborted` and any other throw into `InternalError`.

### Consequences

- The agent reads one shape and acts on `error.code`.
- A tool never throws for a bad input, so a test can assert each error without a try block.

## ADR-006: One atomic `edit-model` with operations

**Status:** accepted.

### Context

The agent changes several entries for one task. One tool call for each operation links the model after each step and
fails on intermediate states, for example a rename before the references that use it.

### Decision

- `edit-model` takes an ordered list of `set`, `rename` and `remove` operations and applies them in one transaction.
- The model is parsed and linked after the last operation only. On failure nothing changes.

### Consequences

- A batch can pass through states that do not link.
- The tool count stays small, and each description stays under 500 characters.

## ADR-007: An undo replays recorded inverse operations

**Status:** accepted.

### Context

The agent and the user must be able to revert an agent change after the user edited other entries. A snapshot comparison
reverts the user's edits too.

### Decision

- Each change records the inverse of each operation and the state of each touched entry after the change.
- `undo-agent-change` replays the inverse operations. When a user edit touched an entry of the change, it returns
  `UndoBlocked` with the conflicting paths and changes nothing.
- An undo is itself a change: it runs every test case and can be undone.

### Consequences

- A user edit of another entry survives an undo.
- Undoing a `remove` appends the entry at the end of its context, so the DSL order can change.
