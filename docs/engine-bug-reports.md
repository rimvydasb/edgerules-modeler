# EdgeRules Engine Bug Reports

Each entry has a label:

- **[VALID]** — the defect is still open and reproduces on the version named in the entry.
- **[NOT A BUG]** — the behaviour is by design. The entry stays so that nobody files it again.

Delete a [VALID] entry when the engine fixes it.

All entries were last re-verified against `@edgerules/node` and `@edgerules/web` **`0.2.10-alpha.202611171702`** on
**2026-11-17** with throwaway Node scripts — no React, no mocks. Every [VALID] entry still reproduces on that version.

Entry format: a heading with the label and the problem name, then **What is wrong**, then **Expected behaviour** (for
[VALID]) or **Why it is not a bug** (for [NOT A BUG]).

## [NOT A BUG] `getCode('*')` drops source comments

**What happens:** `fromCode` followed by `getCode('*')` returns the code without its comments. (Output formatting is
multi-line since `0.0.8-alpha.202610231845`.)

```ts
MutableDecisionService.fromCode('{\n  // keep me\n  a: 1\n  b: a + 1\n}').getCode('*');
// "{\n    a: 1\n    b: a + 1\n}"
```

**Why it is not a bug:** the engine intentionally does not keep comments. Comments can be large, and keeping them would
fill the WASM cache with text that the engine does not use. Documentation belongs to the documentation service, not to
the engine. A host that must keep authored comments stores the source text itself and does not persist from
`getCode('*')`.

## [NOT A BUG] `rename()` migrates references only for callables

**What happens:** `rename()` updates references for some entry kinds and leaves them dangling for others:

| Renamed entry                                                  | References migrated?                                                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `func` / `ruleset` / `loop`, and their own declared parameters | **Yes** — call sites and references relink, including a ruleset's cell-map `when` keys, boolean-expression `when` rows, and named-argument call sites |
| Plain field / context key / `type`                             | **No** — only the key changes; expressions that use the old name stay byte-identical and dangle                                                       |

Neither case throws for a linking reason.

**Why it is not a bug:** ruled by design upstream and documented since `0.0.6-alpha.202607291629` (the `rename` doc
comment in `dist/_core/mutable-service.d.ts`; `remove()` has the same caveat). The engine does not offer full
refactoring — `link()` exists to check the model after any mutation. A host that renames anything outside the first row
must call `link()` and show the error. `DecisionTableEditor` renames only a ruleset or its parameters — the migrating
case. `createBoxedEditorService.rename` renames arbitrary rows and deliberately skips the link check (Resolved Decision
#12, `phase-08-quality-gate.md`). That is an editor-side gap: `docs/qa/current-bugs.md` Bug 10 option 3.

## [VALID] `set('*', …)` rejects the model root of a model with a workbook

**What is wrong:** writing the model root back unchanged fails as soon as the model has a `workbook`. The error says
workbooks are allowed only at the model root, but the target is the model root:

```ts
const service = MutableDecisionService.fromCode(
  '{\n func f(x: number): x + 1\n workbook book: {\n  n: f(x: 2)\n }\n}',
  {
    link: true,
  },
);
service.set('*', service.toPortable());
// {"@kind":"error","type":"WrongFieldPath","message":"invalid portable structure: workbook declarations are allowed only at the model root"}
```

The same model without the workbook round-trips. `set('book', toPortable().fields.book)` and `set` of any other root
field succeed. Still reproduces on `0.2.9-alpha.202611161953` and `0.2.10-alpha.202611171702` (2026-11-17).

**Impact in this package:** the Boxed Editor migrates the references of a renamed field (the engine migrates them for
callables only, see below) by writing the rewritten root back. In every published example with a workbook that write
failed, and its rollback (`set('*', previousRoot)`) failed too: the rename stayed applied without its references, while
the editor reported an error. `createBoxedEditorService` now writes only the changed root fields, one `set` each.

**Expected behaviour:** `set('*', root)` accepts a root context that holds workbook declarations, as `fromPortable`
does.
