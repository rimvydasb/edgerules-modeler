# WebMCP Phase 3: orient and inspect tools

This phase adds the read-only tools: the two orient tools and the five inspect tools.

| Attribute         | Value                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Story             | [webmcp-story.md](../webmcp-story.md)                                                    |
| Recommended model | Sonnet. The tools are read-only adapters over existing APIs, with fixed contracts below. |
| Depends on        | Phase 1                                                                                  |

Read these sections of the main story before you start. Do not read the other phase files.

- [Component architecture](../webmcp-story.md#component-architecture)
- [Component folder layout](../webmcp-story.md#component-folder-layout)
- [Tool design rules](../webmcp-story.md#tool-design-rules)
- [Result envelope](../webmcp-story.md#result-envelope)
- [Shared input types](../webmcp-story.md#shared-input-types)
- [Tool catalog](../webmcp-story.md#tool-catalog)

## Technical Breakdown

`RegressionMonitor.lastTotals()` from Phase 1 supplies the `tests` member of `get-project-overview`.

### Inspector contract

```typescript
// project/inspection/projectInspector.ts: read-only use cases.
interface ProjectInspector {
  overview(): ProjectOverview;
  outline(input: ListModelEntriesInput): ToolResult<ModelEntriesPage>;
  source(input: ReadSourceInput): ToolResult<SourcePage>;
  search(input: SearchModelInput): ToolResult<SearchResult>;
  testSuite(input: ListTestsInput): ToolResult<TestSuiteView>;
  evaluate(input: EvaluateModelInput, signal: AbortSignal): Promise<ToolResult<EvaluationResult>>;
}
```

### 6. `get-project-overview`

```text
Returns the state of the EdgeRules project open in this page: project and model name, save state, DSL validity, the
number of entries per section, the test totals of the last run, the entry the user is looking at, and the current
version. Call it at the start of a session.
```

```typescript
interface GetProjectOverviewInput {} // no members

interface ProjectOverview {
  project: {name: string; description?: string; origin?: string}; // `origin` as `<id>@<version>`
  model: {name?: string; version?: string}; // `ModelMetadata`
  version: number; // `ProjectSessionSnapshot.localVersion`
  phase: ProjectSessionPhase;
  unsavedSlices: ProjectSlice[]; // `dirtySlices`; empty when everything is saved
  savedAt?: string; // ISO time of the last save
  dslValid: boolean; // false when the last `commitDsl` failed
  dslError?: string; // the message of `DslValidity` when `dslValid` is false
  draftPending: boolean; // `hasDslDraft`: the user has uncommitted DSL in the Code view; writes still apply
  counts: Record<ModelSection, number> & {testSubjects: number; testCases: number};
  tests: {passed: number; failed: number; ranAt?: number}; // the last regression run; `ranAt` in epoch ms
  focus?: {path: SourcePath; view: ShellView}; // only with `navigation`
  readOnly: boolean;
  canSave: boolean; // `save-project` is registered
}
```

### 7. `get-language-guide`

```text
Returns the EdgeRules language reference for one topic, with valid examples and their outputs. Without a section, it
returns the introduction of the topic and its section titles. Read the introduction topic before you write EdgeRules
code for the first time, and the topic of each construct you use.
```

```typescript
// One topic for each Markdown file of `../edgerules/docs/reference/`.
type GuideTopic =
  | 'introduction' // base-examples.md: literals, operators, lists, filters, ranges, contexts, dates, special values
  | 'user-functions' // user-functions-reference.md
  | 'user-types' // user-types-reference.md
  | 'rulesets' // rulesets-reference.md
  | 'loops' // loop-reference.md
  | 'optimise' // optimise-reference.md
  | 'optimise-examples' // optimise-examples.md
  | 'decision-layers' // decision-layers-reference.md: `facts`, `decision`, `service`
  | 'annotations' // annotations-story.md
  | 'explain' // explain-reference.md
  | 'dates' // dates-reference.md
  | 'list-functions' // list-functions-reference.md
  | 'string-functions' // string-functions-reference.md
  | 'numeric-functions' // numeric-functions-reference.md
  | 'finance-functions' // finance-functions-reference.md
  | 'example-model'; // playground.md: a complete loan origination model

interface GetLanguageGuideInput {
  topic: GuideTopic;
  section?: string; // a `##` heading title from `sections`; omit for the introduction of the topic
  offset?: number; // from `nextOffset` of the previous page
}

interface GuidePage {
  topic: GuideTopic;
  section?: string;
  text: string; // Markdown: without `section`, the text before the first `##` heading
  sections: string[]; // every `##` heading title of the topic
  nextOffset?: number; // present when the text continues; a page has at most 6,000 characters
}
```

- The guide text is a copy of `../edgerules/docs/reference/`. The engine repository owns it.
- `scripts/sync-language-guide.mjs` copies the topic files to `src/components/webmcp/guide/reference/`. It also writes
  `guide-source.json` with the commit of `../edgerules` and the file list. The copy is checked in, so CI does not need
  the sibling repository.
- The component imports each file with `?raw`. The engine CI backtests every example of the reference.
- `_reference.md` (authoring rules) and `optimise-solver-hosting.md` (host wiring, not DSL) are not topics.
- An unknown `section` fails with `NotFound`. `hint` lists the section titles.

### 8. `list-model-entries`

```text
Lists the entries of the EdgeRules model as a flat outline: path, kind, signature or type, the first line of the
documentation and the number of test cases. Use it to find the path of an entry, for example before a change to an
entry you have not seen. Filter by Project Explorer section or list only the entries below one context.
```

```typescript
interface ListModelEntriesInput {
  sections?: ModelSection[]; // default: every section
  under?: ModelPath; // only entries at or below this context; default '*'
  offset?: number; // from `nextOffset` of the previous page
  limit?: number;
}

interface ModelEntriesPage {
  entries: OutlineEntry[]; // in Project Explorer order: section, then name
  total: number;
  nextOffset?: number; // present when more entries exist
}

interface OutlineEntry {
  path: ModelPath;
  section: ModelSection;
  kind: ExplorerEntryKind; // the Project Explorer kind, for example 'function' or 'ruleset'
  signature?: string; // a callable: '(amount: number, rate: number): number'; a field or type: its type
  doc?: string; // the first line of the documentation, at most 120 characters
  testCases?: number; // only when the entry is a test subject with cases
}
```

### 9. `read-source`

```text
Returns the source text of one project element: EdgeRules DSL for a model path, the whole model for '*', or Markdown
for doc:README.md. A model path also returns its documentation. Long text comes in pages; continue with nextOffset.
Use it to troubleshoot, or before you change an entry you have not seen.
```

```typescript
interface ReadSourceInput {
  path: SourcePath;
  offset?: number; // character offset; default 0
}

interface SourcePage {
  path: SourcePath;
  language: 'edgerules' | 'markdown';
  text: string; // `engine.getCode(path)` or the README Markdown, from `offset`; at most 4,000 characters
  offset: number;
  totalChars: number;
  nextOffset?: number;
  documentation?: string; // the description of a model path, when one exists
}
```

- A page ends at a line break when one exists in the last 20% of the page.
- The text is the committed model, also while `draftPending` is true.

### 10. `search-model`

```text
Finds text in the model DSL, entry names and documentation, without regard to case. Returns the path of each
matching entry with a short excerpt and line. Use it to find where a name occurs. It matches text, so a result can
be a comment or a string.
```

```typescript
interface SearchModelInput {
  query: string;
  scope?: ('code' | 'names' | 'documentation')[]; // default: all three
  limit?: number;
}

interface SearchResult {
  matches: {path: ModelPath; scope: 'code' | 'names' | 'documentation'; line?: number; excerpt: string}[];
  truncated: boolean; // more matches exist than `limit`
}
```

- The tool searches the `getCode` text of each top-level declaration. An excerpt has at most 120 characters.

### 11. `list-tests`

```text
Returns the authored test cases of one test subject, the whole model ('*') or a callable path. Each case has its id,
name, input values and assertion values, keyed by paths relative to the subject. Also returns the paths that cases
can use. Use it before edit-tests on a subject you have not seen.
```

```typescript
interface ListTestsInput {
  subject: TestSubject;
}

interface TestSuiteView {
  subject: TestSubject;
  paths: {path: string; section: TestSectionId; type?: string}[]; // the present rows; '' for a scalar result
  cases: {
    id: string;
    name: string;
    inputs: TestValuesByPath; // raw EdgeRules literal text
    assertions: TestValuesByPath;
  }[];
}
```

- The tool derives the rows with `deriveRows` and `listTestSubjects` of `tests-manager/internal.ts`. A subject with no
  stored suite returns its derived paths and no cases.

### 12. `evaluate-model`

```text
Runs the whole model, or one function, decision or service, with an input object and returns the result value.
Nothing in the project changes. Use it to probe an assumption with one concrete case.
```

```typescript
interface EvaluateModelInput {
  target: ModelPath; // '*' evaluates the whole model
  input?: Record<string, unknown>; // the parameters of a callable, or the placeholder values of the model
}

interface EvaluationResult {
  result: unknown; // the value of `engine.execute(target, input)`
  truncated: boolean; // the JSON of `result` exceeded 6,000 characters and was trimmed
}
```

- The tool fails with `SolverRequired` when `engine.requiresSolver()` is true and no `solverHandler` is set.

## Tasks

- [ ] Add `scripts/sync-language-guide.mjs` and run it to copy `../edgerules/docs/reference/`
- [ ] Implement `LanguageGuide` and `get-language-guide`
- [ ] Implement `ProjectInspector` with `project/inspection/*`
- [ ] Build the outline from `buildSections` of `project-explorer/internal.ts` and `get('*', kinds)` interface kinds
- [ ] Implement `get-project-overview`, `list-model-entries`, `read-source`, `search-model`, `list-tests` and
      `evaluate-model`
- [ ] Add tests for the code of this phase

Acceptance criteria:

- [ ] `npm test` passes, including `orientTools.test.ts`, `inspectTools.test.ts` and `languageGuide.test.ts`
- [ ] `languageGuide.test.ts` loads every topic, lists its sections, and pages a section longer than 6,000 characters
- [ ] `node scripts/sync-language-guide.mjs` copies the reference and leaves `git status` clean on a second run
- [ ] `toolMetadata.test.ts` checks the name, description and parameter limits of every registered tool

## Verification

Run the commands of [Verification](../webmcp-story.md#verification) that this phase touches. At minimum:

```sh
npm run typecheck && npm run lint && npm run depcruise && npm test && npm run format:check
```
