# Rulesets Reference

A `ruleset` is a named, callable rule matrix: a typed input signature plus an ordered set of rule rows, with a **hit
policy** selecting how matches resolve. It is to `func` what a decision matrix is to an expression — same callable
identity, same typed parameters, same treatment at call sites — but its body is a rule matrix instead of an expression,
and it carries one extra data field: `hitPolicy`.

| `hitPolicy`         | Semantics                                           | Result type            |
| ------------------- | --------------------------------------------------- | ---------------------- |
| `"first-match"`     | first matching rule wins (rows ordered)             | `R` (the `then` shape) |
| `"unique-match"`    | exactly one rule may match; two matches → `Invalid` | `R`                    |
| `"collect-matches"` | all matching rules, in row order                    | `R[]`                  |
| `"best-match"`      | highest explicit `priority` among matches wins      | `R`                    |

## Declaring and calling a ruleset

```edgerules
{
    type Applicant: { age: <number>; income: <number>; segment: <string> }
    applicant: { age: 23, income: 25000, segment: "retail" }

    ruleset risk(age: number, income: number, segment: string): {
        hitPolicy: "first-match"
        rules: [
            { when: { age: 18..25, income: < 30000, segment: "retail" }, then: { level: "high",   limit: 1000 } }
            { when: { age: 18..25, income: >= 30000 },                   then: { level: "medium", limit: 5000 } }
            { when: { segment: "premium" },                              then: { level: "low",    limit: 20000 } }
        ]
        default: { level: "none", limit: 0 }
    }

    decision: risk(age: applicant.age, income: applicant.income, segment: applicant.segment)
    level: decision.level
}
```

**output:**

```json
{
  "applicant": {
    "age": 23,
    "income": 25000,
    "segment": "retail"
  },
  "decision": {
    "level": "high",
    "limit": 1000
  },
  "level": "high"
}
```

Invocation is a plain (named- or positional-argument) function call — there is no decision-table special case at call
sites, in the AST, or in the Portable JSON representation.

### Parameter defaults

A parameter may declare a default with the standard type-wrapper syntax; a call site that omits the argument (by name,
or as a trailing positional argument) uses the default. This is what lets an editor add an input column to a ruleset
that already has call sites without simultaneously updating every call site:

```edgerules
{
    ruleset score(x: number, boost: <number, 5>): {
        hitPolicy: "first-match"
        rules: [ { when: { x: any }, then: { total: x + boost } } ]
    }
    named: score(x: 10)                  // { total: 15 } — boost defaults to 5
    positional: score(10)                // { total: 15 }
    explicit: score(x: 10, boost: 1)     // { total: 11 }
}
```

In Portable JSON the same parameter is a `@kind: "type"` object: `{ "@kind": "type", "type": "number", "default": 5 }`.
Function parameters accept the same defaults.

## Body shape

| Field       | Required | Meaning                                                                      |
| ----------- | -------- | ---------------------------------------------------------------------------- |
| `hitPolicy` | yes      | `"first-match"` \| `"unique-match"` \| `"collect-matches"` \| `"best-match"` |
| `rules`     | yes      | ordered list of rule rows                                                    |
| `default`   | no       | fallback result; forbidden when `hitPolicy` is `"collect-matches"`           |

Each rule row is `{ when?, then, priority?, name? }`:

| Field      | Required        | Meaning                                                                                 |
| ---------- | --------------- | --------------------------------------------------------------------------------------- |
| `when`     | no              | map of `input-name → unary test`, or a single boolean expression; omitted = matches all |
| `then`     | yes             | result record; must share one shape across all rows and `default`                       |
| `priority` | best-match only | explicit integer priority (required there, rejected elsewhere)                          |
| `name`     | no              | optional label for audit/trace                                                          |

## Cells are unary tests

Every `when` cell is a [unary test](../architecture/ebnf.md#unary-tests) over the named parameter — parsed, typed AST,
not a string. Cells always name declared parameters directly.

| Cell                     | Meaning                                            |
| ------------------------ | -------------------------------------------------- |
| `age: any`               | always matches (same as omitting the cell)         |
| `age: 21`                | equality with the parameter                        |
| `income: < 30000`        | comparison (`>`, `>=`, `<`, `<=`, `!=` likewise)   |
| `age: 18..25`            | inclusive range membership                         |
| `segment: in ["a", "b"]` | membership in a value list                         |
| `segment: not("x")`      | negation of any test                               |
| `age: >= 18 and <= 64`   | conjunction / disjunction of tests                 |
| `age: isAdult`           | a named unary test (any declared 1-param function) |

A named unary test is any declared function taking exactly one parameter, referenced by name in a cell:

```edgerules
{
    func isCore(x: number): x >= 26 and x <= 64
    ruleset band(age: number): {
        hitPolicy: "first-match"
        rules: [ { when: { age: isCore }, then: { name: "core" } } ]
        default: { name: "other" }
    }
    decision: band(age: 30)
}
```

**output:**

```json
{
  "decision": {
    "name": "core"
  }
}
```

## `when` as a boolean expression

Instead of a per-column cell map, `when` may be a single boolean expression over the ruleset's declared parameters,
evaluated exactly like `then`/`default` — no unary-test desugaring applies, and parameters are referenced by name
directly rather than through the implicit context variable:

```edgerules
{
    ruleset band(age: number): {
        hitPolicy: "first-match"
        rules: [ { when: age >= 26 and age <= 64, then: { name: "core" } } ]
        default: { name: "other" }
    }
    decision: band(age: 30)
}
```

This is equivalent to the cell-map form `when: { age: isCore }` from the named-unary-test example above. A ruleset's
rows may freely mix both `when` forms. Any expression the language can already produce (comparisons, `and`/`or`,
function calls, `if/then/else`, …) is valid here, as long as it evaluates to a boolean; anything else is a link-time
type error, and unknown identifiers are an ordinary unresolved-reference error, same as in `then`/`default`.

**output:**

```json
{
  "decision": {
    "name": "core"
  }
}
```

## Semantics

1. Each argument expression is evaluated once per call.
2. A rule matches when **all** its `when` cells match (omitted cell = `any`), or when its boolean `when` expression
   evaluates to `true` (omitted `when` = matches all).
3. `first-match` / `unique-match` / `best-match`: no match → `default` if present, otherwise a typed `Missing` with
   origin `no rule matched in '<name>'`. `collect-matches`: no match → empty list (`default` is not allowed there).
4. `unique-match` with two or more matches → `Invalid` with origin `multiple rules matched in '<name>'`.
5. `best-match` rows carry an explicit integer `priority` field; rows are order-independent (sorted by priority at link
   time).
6. A `Missing`/`Invalid` input value fails every comparison cell but still matches `any` — rulesets degrade gracefully,
   and `default` keeps them total.

## Link-time checks

The linker validates the whole ruleset before anything runs:

- every `when` key names a declared parameter; each cell test type-checks against that parameter's type; a
  boolean-expression `when` must itself type-check to a boolean;
- all `then` results and `default` share one structural record shape (a shape-mismatch link error names the divergent
  field);
- `hitPolicy` is one of the four enum values;
- `default` is rejected under `collect-matches`; `priority` is required under `best-match` and rejected otherwise;
- `rules` is an inline literal list (v1).

## The transparent alternative: plain rulesets over data

A ruleset earns its keep when conditions form a **matrix over shared inputs**. For flat checklists, prefer plain data —
the result structure is self-evident with nothing to guess:

```edgerules
{
    checks: [
        { name: "age",     passed: applicant.age >= 18 }
        { name: "income",  passed: applicant.income >= 1000 }
        { name: "history", passed: applicant.defaults = 0 }
    ]
    failed: for check in checks[passed = false] return check.name
    status: if count(failed) = 0 then "ELIGIBLE" else "INELIGIBLE"
}
```

The two compose: a ruleset's parameter can be another ruleset's or plain expression's result.

## Portable JSON

A ruleset serializes to its own `@kind`, parallel to a function definition — every rule and cell is a field-addressable
node, so a GUI/agent can edit one cell, add a rule, or change the hit policy without replacing an opaque blob:

```json
{
  "@kind": "ruleset",
  "parameters": {"age": "number", "income": "number", "segment": "string"},
  "hitPolicy": "first-match",
  "rules": [
    {
      "@kind": "rule",
      "when": {"age": "18..25", "income": "< 30000", "segment": "\"retail\""},
      "then": {"@kind": "context", "fields": {"level": "'high'", "limit": 1000}}
    }
  ],
  "default": {"@kind": "context", "fields": {"level": "'none'", "limit": 0}}
}
```

- `set("risk.rules[2].then.limit", 2000)` — edit one output cell
- `set("risk.rules[0].when.age", "21..30")` — edit one `when` cell; the string is a unary test (`"> 80"`, `"any"`,
  `"\"retail\""`), desugared exactly like DSL cell source
- `remove("risk.rules[0].when.age")` — clear a cell back to `any`
- `remove("risk.default")` — drop the default row; `set("risk.default", …)` re-creates it
- `set("risk.rules[3]", { "@kind": "rule", ... })` — add a rule
- `set("risk", { "@kind": "ruleset", "hitPolicy": "best-match", ... })` — change the hit policy (whole-ruleset replace)

`get` resolves the same paths `set` accepts (`risk.rules`, `risk.rules[0]`, `risk.rules[0].when.age`,
`risk.rules[0].then.limit`), and echoes `when` cells in the compact unary-test sugar they were authored in (`"18..25"`,
not the desugared `"... >= 18 and ... <= 25"`). An output cell with no value is authored as the bare special-value
string `"Missing"` or `"NotApplicable"` (the untyped form — it adopts the column's type from the other rows).

A boolean-expression `when` serializes as an ordinary nested expression node (`@kind: "expression"`), same as any other
non-trivial expression, rather than the flat cell-map object — the presence of `@kind` is what distinguishes it from a
cell map on decode:

```json
{"@kind": "rule", "when": {"@kind": "expression", "expression": "age >= 26 and age <= 64"}, "then": {"name": "'core'"}}
```

A call to a ruleset is an ordinary `@kind: "invocation"` node — no decision-table special case.
