# WebMCP Phase 2: change tools and undo

This phase adds the four change tools. Each change returns its outcome, and each change can be undone.

| Attribute         | Value                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Story             | [webmcp-story.md](../webmcp-story.md)                                                           |
| Recommended model | Opus. Transactions, inverse operations and undo target checks need exact reasoning about state. |
| Depends on        | Phase 1                                                                                         |

Read these sections of the main story before you start. Do not read the other phase files.

- [Component architecture](../webmcp-story.md#component-architecture)
- [Component folder layout](../webmcp-story.md#component-folder-layout)
- [Tool design rules](../webmcp-story.md#tool-design-rules)
- [Result envelope](../webmcp-story.md#result-envelope)
- [Shared input types](../webmcp-story.md#shared-input-types)
- [Tool catalog](../webmcp-story.md#tool-catalog)

## Technical Breakdown

`RegressionReport` and `RegressionMonitor` exist from Phase 1 in `project/regression/`.

### `edit-model` sequence

The `edit-model` tool changes the model in one session transaction and then runs every test case:

```mermaid
sequenceDiagram
  participant A as Agent
  participant T as edit-model
  participant S as ProjectSession
  participant E as ProjectEngine
  participant L as AgentActivityLog
  participant R as RegressionMonitor

  A->>T: execute(operations, baseVersion?)
  T->>T: validate input
  alt baseVersion is set and differs from localVersion
    T-->>A: ok false, VersionConflict, current version
  else no conflict
    T->>S: transaction(work)
    loop each operation
      S->>E: setCode, rename or remove
      S->>S: record the inverse operation
    end
    S->>E: link()
    alt an operation or link fails
      S-->>T: error, every slice rolled back
      T-->>A: ok false, errors with operation index and diagnostics
    else model links
      S-->>T: ok
      T->>L: record change with inverse operations
      T->>R: runAll()
      R->>E: execute each test case
      R-->>T: regression report against the baseline
      T-->>A: ok true, version, changeId, changed, regression
    end
  end
```

### Change service contracts

```typescript
// project/changes/projectChangeService.ts: apply, record the inverse operations, run the regression.
interface ProjectChangeService {
  editModel(input: EditModelInput, signal: AbortSignal): Promise<ToolResult<ChangeResult>>;
  editTests(input: EditTestsInput, signal: AbortSignal): Promise<ToolResult<TestsChangeResult>>;
  setDocumentation(input: SetDocumentationInput): ToolResult<DocumentationChangeResult>;
  undo(changeId: string, signal: AbortSignal): Promise<ToolResult<UndoResult>>;
  readonly activity: AgentActivityLog;
}

// project/changes/operations/*.ts: one applier for each operation family.
interface OperationApplier<Op> {
  apply(operation: Op): AppliedOperation; // runs inside the transaction of `ProjectChangeService`; throws to roll back
}

interface AppliedOperation {
  target: SourcePath; // the undo target; a test case as `<subject>#<caseId>`
  stateAfter: unknown; // the target state that a later undo compares with
  inverse: () => AppliedOperation; // applies the inverse operation and returns its own record
  changed: SourcePath[]; // the target, and the paths that a rename rewrote
}
```

### 1. `edit-model`

```text
Changes the EdgeRules model in one atomic step: set the DSL of an entry (creates it when new), rename or remove. If
the model does not parse or link after the last operation, nothing changes and the exact errors return. Otherwise
every test case of the project runs, and the result lists the cases that now fail with expected and actual values.
You do not need to read the model back to check the change.
```

```typescript
interface EditModelInput {
  operations: ModelOperation[];
  baseVersion?: number; // `version` from a previous result; omit to apply on the current state
  dryRun?: boolean; // check and test the change on `session.fork()`; the project does not change
}

type ModelOperation =
  // One declaration or one field. `engine.setCode(path, code)`.
  | {op: 'set'; path: ModelPath; code: string}
  // `session.execute({type: 'renamePath', path, newName})`. `newName` is one segment.
  | {op: 'rename'; path: ModelPath; newName: string}
  // `engine.remove(path)`. Also removes the documentation of the path and of each nested path.
  | {op: 'remove'; path: ModelPath};

interface ChangeResult {
  version: number; // `localVersion` after the change
  changeId: string;
  changed: ModelPath[]; // the target paths, and each path whose references a rename rewrote
  regression: RegressionReport;
}

// The result of a dry run: nothing was recorded, so there is no `changeId`; `version` is the current one.
type DryRunResult<R extends ChangeResult = ChangeResult> = Omit<R, 'changeId'> & {dryRun: true};
```

- `path: '*'` is `InvalidInput` for every operation. Set each top-level entry with its own operation.
- The tool runs all operations in one `session.transaction` and calls `engine.link()` at the end. A throw rolls back.
- A failed operation returns its index in `error.operation`. A link failure returns up to 20 `diagnostics`.
- With `dryRun: true`, the operations run in one transaction of `session.fork()`, a detached copy with its own engine. A
  parse or link error returns as without `dryRun`. Otherwise `RegressionMonitor.preview(fork)` runs every test case of
  the fork against the current baseline. The session, the activity log and the baseline do not change, and the fork is
  disposed. `edit-tests` takes `dryRun` the same way.
- `changed` of a rename comes from the rewritten paths that the engine returns. See
  [Engine prerequisite](#engine-prerequisite).

### 2. `edit-tests`

```text
Adds, changes or removes test cases of one test subject in one atomic step. Values are EdgeRules literal text, keyed
by paths relative to the subject; inputs feed the run and assertions are the expected results. An empty value text
removes that value. After the change every test case of the project runs, and the result lists the cases that now
fail with expected and actual values.
```

```typescript
interface EditTestsInput {
  subject: TestSubject;
  operations: TestOperation[];
  baseVersion?: number;
}

type TestOperation =
  | {op: 'add'; name: string; inputs?: TestValuesByPath; assertions?: TestValuesByPath}
  // Merges `inputs` and `assertions` into the case; a member with '' removes that value.
  | {op: 'update'; caseId: string; name?: string; inputs?: TestValuesByPath; assertions?: TestValuesByPath}
  | {op: 'remove'; caseId: string};

interface TestsChangeResult extends ChangeResult {
  addedCaseIds: string[]; // in the order of the `add` operations
}
```

- The tool calls `syncRows(deriveRows(...))` before it writes, so the paths exist without a mounted Tests view.
- A path that is not a present row fails with `InvalidInput`. `hint` names `list-tests`.
- An input path MUST be an `inputs` row. An assertion path MUST be an `assertions` or `validations` row.

### 3. `set-documentation`

```text
Sets the documentation of model entries or the project README. Each item replaces the whole Markdown text of one
path; an empty text removes the documentation of a model entry. The editors show the documentation next to its
entry. Documentation does not change test results, so no tests run.
```

```typescript
interface SetDocumentationInput {
  items: {path: SourcePath; text: string}[]; // 'doc:README.md' sets the README; it MUST NOT be empty
  baseVersion?: number;
}

interface DocumentationChangeResult {
  version: number;
  changeId: string;
}
```

- A model path that does not exist fails with `NotFound`. Nothing changes.
- The tool writes in one `session.transaction` through `session.documentation` and `session.readme`.

### 4. `undo-agent-change`

```text
Reverts one change that a tool of this page made, with its changeId, by its inverse operations. The undo is a new
change: it has its own changeId, and the result reports link errors and the regression like edit-model. It fails
when the user or another agent change edited a target of that change later.
```

```typescript
interface UndoAgentChangeInput {
  changeId: string;
}

interface UndoResult extends ChangeResult {
  reverted: string; // the `changeId` of the reverted change
}
```

- The tool calls `AgentActivityLog.undo`. See [Agent activity and undo](#agent-activity-and-undo).

### Agent activity and undo

`AgentActivityLog` records each agent change as its operations and their inverse operations. An undo replays the inverse
operations in reverse order, in one transaction.

| Operation                  | Recorded at apply time                                  | Inverse operation                                   | Undo target        |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------- | ------------------ |
| `set` of an existing entry | `getCode(path)` before and after                        | `set` with the code before                          | `path`             |
| `set` of a new entry       | `getCode(path)` after                                   | `remove`                                            | `path`             |
| `rename`                   | The old path, the new path and `getCode` of the new one | `rename` of the new path back to the old name       | The new path       |
| `remove`                   | `getCode(path)` and the removed documentation entries   | `set` with the removed code, then the documentation | The absent `path`  |
| `set-documentation` item   | The text before and after                               | The text before                                     | The documentation  |
| `edit-tests` `add`         | The new case                                            | `remove` of the case                                | The case           |
| `edit-tests` `update`      | The case before and after                               | `update` with the values before                     | The case           |
| `edit-tests` `remove`      | The removed `TestCase`                                  | `restoreTestCase` with the same id and order        | The absent case id |

- Each inverse operation checks only its undo target: the current state MUST equal the recorded state after the change.
  A difference fails the undo with `UndoBlocked` and names the target in `conflicts`.
- The engine moves the references back on the inverse rename. The undo does not check the rewritten paths.
- An undo is an agent change with its own `changeId` and inverse operations. So an undo of an undo is a redo.
- Removed tests of a removed callable stay in the tests slice as absent rows. The inverse `set` makes them present.

The undo of one agent change follows this sequence:

```mermaid
sequenceDiagram
  participant U as Agent or Shell Undo
  participant L as AgentActivityLog
  participant S as ProjectSession
  participant E as ProjectEngine
  participant R as RegressionMonitor

  U->>L: undo(changeId)
  L->>S: read the state of each undo target
  alt a target differs from its recorded state
    L-->>U: ok false, UndoBlocked, conflicts
  else every target matches
    L->>S: transaction(inverse operations in reverse order)
    S->>E: link()
    alt link fails
      S-->>L: error, every slice rolled back
      L-->>U: ok false, LinkError, diagnostics
    else model links
      L->>L: record the undo as a new change
      L->>R: runAll()
      R-->>L: regression report
      L-->>U: ok true, version, changeId, reverted, regression
    end
  end
```

```typescript
interface AgentChange {
  changeId: string; // `ac-<n>`, unique within the log
  tool: 'edit-model' | 'edit-tests' | 'set-documentation' | 'undo-agent-change';
  summary: string; // for example "Set risk.score, renamed limit to maxLimit"
  targets: SourcePath[]; // the undo targets; a test case as `<subject>#<caseId>`
  at: number; // epoch ms
  reverts?: string; // the `changeId` that this undo reverted
  regression?: {passed: number; failed: number; newlyFailing: number}; // the totals of its regression run
}

interface AgentActivityLog {
  list(): readonly AgentChange[]; // newest first; at most 50 changes
  canUndo(changeId: string): boolean; // every undo target matches its recorded state
  undo(changeId: string): Promise<ToolResult<UndoResult>>; // the logic of `undo-agent-change`
  subscribe(listener: () => void): Unsubscribe;
}
```

### Engine prerequisite

The engine `rename(path, newName)` returns the paths whose code it rewrote. `edit-model` reports them in `changed`.

```typescript
interface EngineService {
  rename(path: string, newName: string): string[] | PortableError; // the paths whose references the rename rewrote
}
```

- `ProjectSession.execute({type: 'renamePath', ...})` returns `{ok: true; rewritten: string[]}`.

## Tasks

- [x] Add `restoreTestCase(testCase: TestCase): void` to `TestCasesService`
- [x] Implement the operation appliers of `project/changes/operations/` with their inverse operations
- [x] Implement `ProjectChangeService`: version check, transaction, activity record and regression run
- [x] Implement `AgentActivityLog` with target checks and a limit of 50 changes
- [x] Implement `edit-model`, `edit-tests`, `set-documentation` and `undo-agent-change`
- [x] File the engine feature request: [rimvydasb/edgerules#68](https://github.com/rimvydasb/edgerules/issues/68)
- [ ] Update `EngineService`, `renamePath` and `CommandResult` when the engine ships rimvydasb/edgerules#68
- [x] Add tests for the code of this phase

Acceptance criteria:

- [x] `npm test` passes, including `editModel.test.ts`, `editTests.test.ts` and `undoAgentChange.test.ts`
- [x] `editModel.test.ts` shows that a batch with a link error leaves the DSL and every slice unchanged
- [x] `editModel.test.ts` shows that a successful change returns a regression report of every subject
- [x] `editModel.test.ts` shows `VersionConflict` for a stale `baseVersion` and success without `baseVersion`
- [x] `editModel.test.ts` shows that a write with a DSL draft succeeds and keeps the draft
- [x] `undoAgentChange.test.ts` shows that undo of `set`, `rename` and `remove` restores the code, references and
      documentation
- [x] `undoAgentChange.test.ts` shows `UndoBlocked` with `conflicts` after a user edit of the same entry
- [x] `undoAgentChange.test.ts` shows a successful undo after a user edit of another entry
- [x] `undoAgentChange.test.ts` shows that an undo of an undo restores the change
- [x] `editTests.test.ts` shows that the undo of a case removal restores the case id and order

## Verification

Run the commands of [Verification](../webmcp-story.md#verification) that this phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```

## Implementation notes

- **Entry points:** `project/changes/projectChangeService.ts` — `createProjectChangeService(session, regression)`, the
  input and result types; `context.changes` holds it. `project/changes/agentActivityLog.ts` — `AgentActivityLog`,
  `AgentChange`, `UndoResult`; the handle exposes it as `ProjectToolsHandle.activity` (absent when inactive), the
  Shell's `ShellAgentActivity` (Phase 4) should match it. `project/changes/operations/` — the appliers. `tools/change/`
  — the four tools; `changeInput.ts` holds the shared batch/`baseVersion`/text validators. `protocol/schemas.ts` —
  `baseVersionSchema`, `changeResultProperties`, `changeResultRequired`, `testValuesSchema`.
- **Contracts:** `AppliedOperation` also has `readState()` and `summary`; `stateAfter` is re-read when the transaction
  commits. `AgentActivityLog.undo(changeId, signal?)` takes an optional signal; the Shell undo does not go through
  `ToolQueue` yet (Phase 4). `version` in a change result is read after the regression run, because a run can add
  `discovered` rows (a tests-slice change). Every change, including a `set-documentation` undo, runs `runAll`.
  `edit-tests` `add` clears the inputs that `addTestCase` copies from the previous case. Removing a value (`''`) skips
  the row check. New derived rows of a computed path land in `validations`, which counts as an assertion path.
  `set-documentation` rejects `'*'`. `tests-manager/internal.ts` now exports `deriveRows`.
- **Deviations and open items:** rimvydasb/edgerules#68 is still open on `0.2.7-alpha.202611081915`, so `rename` derives
  the rewritten paths by comparing `getCode` of every non-context entry before and after (`codeIndex` in
  `modelOperations.ts`); replace it when the engine ships. A field rename still fails with `LinkError` when other
  entries reference the field (the engine moves references only for callables) — set the referencing entries first in
  the same batch. Undoing a `remove` appends the entry at the end of its context, so the DSL order can change. A link
  error has one diagnostic and no `path`: the engine throws only the first error and names a node id.
