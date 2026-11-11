# explain() Reference

Every EdgeRules special value (`Missing`, `NotApplicable`, `Invalid`) carries metadata — the type it stands in for and a
human-readable origin — that normally propagates silently. `explain(value)` lifts that hidden metadata into an ordinary
record that rules, callers, and the GUI can read, branch on, log, or return. It is the bridge from "the engine knows
why" to "the user sees why".

```text
explain(value) → { status, type, value? | origin? }
```

| Field    | Present for         | Meaning                                                           |
| -------- | ------------------- | ----------------------------------------------------------------- |
| `status` | always              | `"ok"`, `"missing"`, `"notApplicable"`, or `"invalid"`            |
| `type`   | always              | the value's type (for specials: the type the value stands in for) |
| `value`  | `status = "ok"`     | the value itself                                                  |
| `origin` | special values only | where/why the special value was produced                          |

`explain` is the one built-in that **inspects** special values instead of propagating them.

## A normal value reports health

```edgerules
{
    why: explain(2 + 2)
}
```

**output:**

```json
{
  "why": {"status": "ok", "type": "number", "value": 4}
}
```

## A missing input reports its origin

```edgerules
{
    salary: <number>                   // not provided in the request
    bonus: salary * 0.1
    why: explain(bonus)
}
```

**output:**

```json
{
  "salary": "Missing('salary')",
  "bonus": "Missing('salary')",
  "why": {"status": "missing", "type": "number", "origin": "salary"}
}
```

## Explaining a ruleset miss

When a ruleset has no `default` and no rule matches, the result is a typed `Missing` whose origin `explain()`
surfaces directly (see [rulesets-reference.md](rulesets-reference.md)):

```edgerules
{
    ruleset classify(age: number): {
        hitPolicy: "first-match"
        rules: [ { when: { age: 18..25 }, then: { level: "high" } } ]
    }
    risk: classify(age: 99)
    why: explain(risk)
}
```

**output (`why`):**

```json
{
  "status": "missing",
  "type": "{level: string}",
  "origin": "no rule matched in 'risk'"
}
```

## Branching on the result

The lifted record is an ordinary value, so rules can branch on it:

```edgerules
{
    salary: <number>
    bonus: salary * 0.1
    safeBonus: if explain(bonus).status = "ok" then bonus else 0
}
```

## Totality and link-time typing

- The result type is a statically known record, so `explain(x).status` is link-checked — a typo like `explain(x).reason`
  is a **link error**, not a runtime surprise.
- `value` and `origin` are mutually exclusive at run time; reading the absent one yields a typed `Missing`
  (`field 'origin' not found`), so expressions over the result stay total.
- `Invalid` values report `status: "invalid"` with the domain-error origin, e.g. `explain(sqrt(0 - 1))` →
  `{ status: "invalid", type: "number", origin: "sqrt of a negative number" }`.

Tests mirroring this document: `tests/wasm/builtins/explain.test.mjs`, `crates/runtime/tests/eval_explain_tests.rs`, and
the `meta_explain_*` cases in `crates/builtins/tests/builtin_functions_tests.rs`.

## coalesce / firstNonNull

`coalesce(...values)` (alias `firstNonNull`) is the companion built-in for _recovering_ from special values instead of
inspecting them: it returns the first argument that is not `missing` / `notApplicable` / `invalid`. When every argument
is special, the last one is returned, so its metadata keeps propagating and `explain` can still report why.

```edgerules
{
    salary: <number>                      // not provided in the request
    bonus: coalesce(salary * 0.1, 0)      // -> 0 instead of a propagated Missing
    fallback: firstNonNull(salary, 1500)  // alias of coalesce
}
```

**output:**

```json
{
  "salary": "Missing('salary')",
  "bonus": 0,
  "fallback": 1500
}
```

Arguments should share one type: the result is statically typed as the first argument's type.
