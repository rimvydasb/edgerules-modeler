# WebMCP Phase 1: foundation, regression monitor and feedback

This phase builds the layers, the WebMCP registration and the `RegressionMonitor`. It ends with the first tool,
`run-tests`.

| Attribute         | Value                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Story             | [webmcp-story.md](../webmcp-story.md)                                                                        |
| Recommended model | Opus. The phase sets the layers, the registry and the regression semantics that every later phase builds on. |
| Depends on        | Nothing                                                                                                      |

Read these sections of the main story before you start. Do not read the other phase files.

- [Component architecture](../webmcp-story.md#component-architecture)
- [Component folder layout](../webmcp-story.md#component-folder-layout)
- [Tool design rules](../webmcp-story.md#tool-design-rules)
- [Result envelope](../webmcp-story.md#result-envelope)
- [Shared input types](../webmcp-story.md#shared-input-types)
- [Tool catalog](../webmcp-story.md#tool-catalog)

## Technical Breakdown

### Tool registration lifecycle

- The host calls `registerProjectTools` after it opens a `ProjectSession`. It calls `dispose` before it closes the
  session.
- `registerProjectTools` does nothing and returns an inactive handle when `modelContext` is `undefined`.
- `ToolRegistry` registers every tool with one `AbortController`. `dispose` aborts it, so every tool unregisters.
- `ToolRegistry` selects the tools by `availability`: `write` needs not `readOnly`, `navigation` needs `navigation`, and
  `save` needs `allowSave` and not `readOnly`.
- `registerProjectTools` starts the first `RegressionMonitor.runAll()`. Its result is the first baseline.
- `setReadOnly` and `setAllowSave` re-register the affected tools. The browser fires `toolchange`.
- The host MUST NOT register tools from editor components. One registration point exists per open project.
- `ToolQueue` runs one tool call at a time, in arrival order. A write and its regression run end before the next call
  starts.

```typescript
// edgerules-react/webmcp: public API

// The structural subset of the WebMCP `ModelContext` that the component uses.
interface ModelContextLike {
  registerTool(tool: ModelContextToolLike, options?: {signal?: AbortSignal}): Promise<void>; // rejects on bad name
}

interface ModelContextToolLike {
  name: string; // kebab-case, at most 30 characters
  title: string; // label for a confirmation dialog
  description: string; // at most 500 characters
  inputSchema: object; // JSON Schema draft 2020-12, `type: 'object'`
  outputSchema: object; // JSON Schema of `ToolResult<T>`
  annotations: {readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean};
  execute(input: object, options: {signal: AbortSignal}): Promise<ToolResult<unknown>>; // never rejects for a domain error
}

// `document.modelContext` when the browser has it; `undefined` otherwise.
function getModelContext(doc?: Document): ModelContextLike | undefined;

interface ProjectToolsOptions {
  modelContext: ModelContextLike | undefined; // `getModelContext()`, or a polyfill of the host
  session: ProjectSession; // the open project
  navigation?: ProjectToolsNavigation; // enables `open-in-editor` and the `focus` of `get-project-overview`
  readOnly?: boolean; // registers only read tools; default false
  allowSave?: boolean; // registers `save-project`; default false
}

// Implemented by the host from its routes; the Shell path and view stay controlled by the host.
interface ProjectToolsNavigation {
  getFocus(): {path: string; view: ShellView}; // what the user looks at now
  open(path: string, view: ShellView): void; // the same navigation as a Project Explorer click
}

interface ProjectToolsHandle {
  readonly active: boolean; // false when `modelContext` is undefined
  readonly activity: AgentActivityLog; // every agent change of this registration
  setReadOnly(readOnly: boolean): void; // re-registers the write tools
  setAllowSave(allowSave: boolean): void; // registers or unregisters `save-project`
  dispose(): void; // unregisters every tool; the log keeps its entries
}

function registerProjectTools(options: ProjectToolsOptions): ProjectToolsHandle;
```

### Regression report

`RegressionMonitor` runs every authored test case of the project. It compares each run with the previous run, the
baseline.

Each model or test write, each undo and each `run-tests` call returns its report.

```typescript
interface RegressionReport {
  status: 'complete' | 'aborted'; // 'aborted': the agent aborted the call after the commit point
  passed: number; // passed cases in this run
  failed: number; // failed cases in this run
  newlyFailing: CaseFailure[]; // failed now; passed in the baseline or had no baseline result
  stillFailing: CaseRef[]; // failed in the baseline and now
  newlyPassing: CaseRef[]; // passed now; failed in the baseline
  truncated: boolean; // a list or a failure detail was trimmed to the output budget
}

interface CaseRef {
  subject: TestSubject;
  caseId: string;
  name: string;
}

interface CaseFailure extends CaseRef {
  runError?: string; // the case did not run: the `TestResultSet.error`, for example an `ExecutionError` message
  assertions: AssertionFailure[]; // at most 5 per case
}

interface AssertionFailure {
  path: string; // subject-relative, as in `list-tests`
  expected: string; // the authored assertion text
  actual?: string; // `formatValue` of the computed value; absent with `error` or `missing`
  error?: string; // the evaluation error of this path
  missing?: true; // the result has no value at this path
}
```

- `runAll` runs `createTestRunner(...).runAll()` for each test subject with cases, through `session.tests.forSubject`.
  So a mounted Tests view shows the same results.
- `runAll` builds `AssertionFailure` from the `TestResultSet` and the case assertions with `matches` and `formatValue`.
- The report lists `newlyFailing` in full first. It trims `stillFailing` and `newlyPassing` to fit 1,500 characters.
- A run of all subjects replaces the baseline. A run of one subject replaces the baseline entries of that subject.
- The baseline is the previous run, not the previous agent change. A user change between two runs also shows in it.

#### Regression monitor contract

```typescript
// project/regression/regressionMonitor.ts
interface RegressionMonitor {
  runAll(signal: AbortSignal): Promise<RegressionReport>; // every subject with cases; replaces the baseline
  runSubject(subject: TestSubject, signal: AbortSignal): Promise<RegressionReport>; // replaces its baseline entries
  lastTotals(): {passed: number; failed: number; ranAt?: number}; // for `get-project-overview`
}
```

### 5. `run-tests`

```text
Runs the authored test cases of one test subject, or of every subject, and returns the regression report: the cases
that fail with expected and actual values, and what changed since the previous run. Change tools run every test
already; use this tool after the user says they changed something.
```

```typescript
interface RunTestsInput {
  subject?: TestSubject; // default: every subject with test cases
}

interface RunTestsResult {
  regression: RegressionReport;
}
```

- The tool checks `signal` between test cases. An aborted run returns `status: 'aborted'` and keeps the baseline.

## Tasks

- [ ] Ensure project compiles and existing tests are passing
- [ ] Create the folder layout of [Component folder layout](../webmcp-story.md#component-folder-layout)
- [ ] Add the subpath export `edgerules-react/webmcp` to `package.json` and `tsdown.config.ts`
- [ ] Add the component allowlist and the five `webmcp-layer-*` dependency-cruiser rules
- [ ] Implement `core/`: `ToolResult`, `ToolError`, the `PortableError` mapping and the diagnostic line, column and
      excerpt
- [ ] Implement `protocol/`: `ToolDefinition`, schemas, `fitOutput` and the metadata limits
- [ ] Implement `platform/`: `getModelContext`, `ToolRegistry` and `ToolQueue`
- [ ] Implement `registerProjectTools`, the handle and `ProjectToolsContext`
- [ ] Add `tests-manager/internal.ts` and the `AssertionFailure` extraction next to `caseFailures`
- [ ] Implement `RegressionMonitor` with `runAll`, `runSubject`, the baseline and `RegressionReport`
- [ ] Implement `run-tests`
- [ ] Add `testing/recordingModelContext.ts` and `testing/toolsFixture.ts`
- [ ] Add tests for the code of this phase, with a real `@edgerules/node` session

Acceptance criteria:

- [ ] `npm test` passes, including `registerProjectTools.test.ts` and `regressionMonitor.test.ts`
- [ ] `regressionMonitor.test.ts` shows `newlyFailing` with `expected` and `actual` after a model change breaks a case
- [ ] `regressionMonitor.test.ts` shows `newlyPassing` after the fix, and `stillFailing` for an unrelated failing case
- [ ] `registerProjectTools.test.ts` shows that `dispose` aborts the signal of every tool
- [ ] `toolQueue.test.ts` shows that a second call starts after the first call and its regression run end
- [ ] `toolRegistry.test.ts` shows that a tool that throws returns `InternalError` and does not reject
- [ ] `npm run depcruise` passes, and a test import from `platform/` to `project/` fails the `webmcp-layer-platform`
      rule

## Verification

Run the commands of [Verification](../webmcp-story.md#verification) that this phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```
