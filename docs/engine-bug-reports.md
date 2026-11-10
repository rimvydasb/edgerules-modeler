# EdgeRules Engine Bug Reports

Each entry has a label:

- **[VALID]** — the defect is still open and reproduces on the version named in the entry.
- **[NOT A BUG]** — the behaviour is by design. The entry stays so that nobody files it again.

Delete a [VALID] entry when the engine fixes it.

All entries were last re-verified against `@edgerules/node` and `@edgerules/web` **`0.2.7-alpha.202611081915`** on
**2026-11-08** with throwaway Node scripts — no React, no mocks. Every [VALID] entry still reproduces on that version.

Entry format: a heading with the label and the problem name, then **What is wrong**, then **Expected behaviour** (for
[VALID]) or **Why it is not a bug** (for [NOT A BUG]).

## [VALID] Built-in function signatures are only available as lossy completion `detail` strings

**What is wrong:** the only API that lists built-in functions is the static
`MutableDecisionService.completions(code, pos)`. Options with `type: 'function'` carry the signature as a free-text
`detail` string. There is no structured built-in catalog. The `detail` string loses information that a GUI needs:

1. **No parameter names.** `round | (number, number) -> number` — the Flow Editor `FunctionNode` cannot label its input
   pins and shows `#1`, `#2`.
2. **Overloads collapse to one signature.** `substring` has a 2-argument form and a 3-argument form (`doc/reference`),
   but completions report only `(string, number, number) -> string`. The GUI cannot tell that the third argument is
   optional.
3. **Variadic functions look unary.** `coalesce | (any) -> any`.
4. **User callables report no return type.** `monthly | (amount: number)` — no `-> …` part.

```ts
const doc = '{\n  x: \n}';
MutableDecisionService.completions(doc, doc.indexOf('x: ') + 3)
  .options.filter((o) => o.type === 'function')
  .map((o) => `${o.label} | ${o.detail}`);
// [..., 'round | (number, number) -> number', 'substring | (string, number, number) -> string',
//  'coalesce | (any) -> any', ...]
```

Still reproduces on `0.2.7-alpha.202611081915`: the statics are still only `fromCode`, `fromPortable`, `diagnostics` and
`completions`, with the same `detail` strings.

**Expected behaviour:** a structured built-in catalog, for example a static `builtins()`. It returns
`PortableMethodInterface`-shaped entries with named `parameters`, optional/variadic markers per parameter (or one entry
per overload), and `return`. `get('*', Kinds.INVOCABLE_INTERFACES)` already covers user callables.

## [VALID] `rename()` does not return the paths whose references it rewrote

**What is wrong:** `rename(oldPath, newPath)` returns `void`. A callable rename also rewrites every call site in the
model, but the caller cannot learn which entries changed. A host must compare `getCode` of every entry before and after.
This is a missing capability: `api-spec.md` specifies the `void` return.

**Expected behaviour:** `rename()` returns the paths of the entries whose code it rewrote, and an empty list when it
rewrote nothing. `edit-model` of the WebMCP story reports these paths in `changed`
([webmcp-story.md](stories/webmcp-story.md)).

**Issue:** https://github.com/rimvydasb/edgerules/issues/68

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
