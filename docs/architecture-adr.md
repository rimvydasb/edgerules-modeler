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
