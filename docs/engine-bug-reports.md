# EdgeRules Engine Bug Reports

Each entry has a label:

- **[VALID]** — the defect is still open and reproduces on the version named in the entry.
- **[NOT A BUG]** — the behaviour is by design. The entry stays so that nobody files it again.

Delete a [VALID] entry when the engine fixes it.

All entries were last re-verified against `@edgerules/node` and `@edgerules/web` **`0.2.5-alpha.202611072026`** on
**2026-11-07** with throwaway Node scripts — no React, no mocks. Every [VALID] entry still reproduces on that version.

Entry format: a heading with the label and the problem name, then **What is wrong**, then **Expected behaviour** (for
[VALID]) or **Why it is not a bug** (for [NOT A BUG]).

## [VALID] Root `set('*', …)` drops root metadata (`@model-name`, `@model-version`)

> KNOWN ISSUE. IGNORE IT. This issue is well known and will be revisited in future stories.

**Issue:** https://github.com/rimvydasb/edgerules/issues/62

**What is wrong:** `MutableDecisionService.fromPortable({'@model-version': '1.4.0', ...})` keeps `@model-version`
(`API_SPEC.md` "Limitations" #3: only `@model-version` round-trips; `@model-name` is accepted on parse but not
persisted). A root `set('*', …)` on a service that already exists drops **both** keys. The rest of the write commits. So
a mutable service can set `@model-version` at construction, but it can never change it or set it later.

```ts
const service = MutableDecisionService.fromCode('{ amount: 10 }');
service.set('*', {...service.toPortable(), '@model-version': '2.0'});
service.toPortable();
// { '@kind': 'context', amount: 10 }  — '@model-version' is missing; 'amount' did commit
```

The DSL has no syntax for either key, so `getCode('*')` drops both as well. The `Shell` settings dialog
(`docs/specs/shell-spec.md`) works around it: the project manifest keeps `model.name` and `model.version`, and the
session engine adds them to the model root as `@model-name` and `@model-version`.

Still reproduces on `0.2.5-alpha.202611072026`.

**Expected behaviour:** a root `set('*', …)` persists `@model-version` exactly as `fromPortable` does. For
`@model-name`, it persists the key or rejects the write (the sibling gap in `API_SPEC.md`).

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

Still reproduces on `0.2.5-alpha.202611072026`: the statics are still only `fromCode`, `fromPortable`, `diagnostics` and
`completions`, with the same `detail` strings.

**Expected behaviour:** a structured built-in catalog, for example `get('*', 'BUILTIN_DEFINITIONS')` or a static
`builtins()`. It returns `PortableFunctionSchema`-shaped entries with named `@parameters`, optional/variadic markers per
parameter (or one entry per overload), and `@return`. `get('*', 'ALL')` + `get('*', 'EXTERNAL_DEFINITIONS')` already
cover user callables.

## [VALID] A `facts` declaration has no path, and `getCode(type)` leaves out its facts

**What is wrong:** the authored model keeps a `facts` declaration under the `@facts` key of its type definition
(`PortableTypeDefinition['@facts']`), but no API addresses it on its own:

1. `get`, `set`, `getCode` and `remove` reject `Applicant.@facts` (`EntryNotFound` / `WrongFieldPath`).
2. `getCode('Applicant')` returns the type without its facts.

`set(type, …)` writes a changed `@facts`, and `remove(type)` removes the facts with the type. A definition without
`@facts` keeps the declared facts (by design), so the only ways to remove a facts declaration are a root `set('*', …)`
or a removal of the type.

```ts
const service = MutableDecisionService.fromCode('{ type A: {age: <number>}\n facts A(a: A): { old: a.age > 60 } }');
service.get('A.@facts'); // { '@kind': 'error', type: 'EntryNotFound', message: 'entry not found: A.@facts' }
service.getCode('A'); // "type A: {\n    age: <number>\n}"  — no facts
```

`#lib/factsPaths` works around it: it addresses facts as `<Type>.@facts`, removes them with a root `set('*', …)`, and
cuts their code from `getCode('*')`.

Reproduces on `0.2.5-alpha.202611072026`.

**Expected behaviour:** `getCode(type)` returns the facts with the type, or the engine offers a path for the facts
declaration (`get`, `getCode`, `remove`).

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
