# Loop Reference

A `loop` is a bounded, typed state machine — the language's one way to accumulate over data (fold/reduce) or iterate
until a condition converges. It is a callable, exactly like `func` and `ruleset`: typed parameters, named- or
positional-argument call sites, and no recursion (loops sit in the same acyclic call graph). Every loop has a `state`
(the carried record), a `do` step (a patch producing the next state), and exactly one **iteration source**:
`over: <list>` (bounded by the list's length) or `while` + `maxIterations` (bounded by the explicit cap). Combining
both, or providing neither, is a link error.

## While Form

`while` + `maxIterations` drive condition-based iteration — amortization schedules, fixpoints, anything that converges
rather than walking a fixed list. `while` is checked **before** every step.

```edgerules
{
    loop countdown(x: number): {
        state: { n: x, steps: 0 }
        while: state.n > 0
        maxIterations: 10
        do: { n: state.n - 1, steps: state.steps + 1 }
    }
    result: countdown(x: 3)
}
```

**output:**

```json
{
  "result": {
    "n": 0,
    "steps": 3
  }
}
```

## Over Form (Fold)

`over: <list>` iterates once per element; the list's length is the bound, so no `maxIterations` is needed (providing one
alongside `over` is a link error). This is EdgeRules' fold/reduce — the language has no `reduce` built-in on purpose,
this is the one way to accumulate.

```edgerules
{
    loop sumUp(xs: number[]): {
        over: xs
        state: { total: 0 }
        do: { total: state.total + item }
    }
    result: sumUp(xs: [1, 2, 3])
}
```

**output:**

```json
{
  "result": {
    "total": 6
  }
}
```

## Early Break

An `over` loop may still declare `while` as an optional early-break condition — fold-with-takeWhile, the one thing
DMN/FEEL cannot express. `while` is checked each step before consuming the next element; a `false` result stops the loop
**without** consuming that element.

```edgerules
{
    loop shipWithinBudget(orderTotals: number[], budget: number): {
        over: orderTotals
        state: { spent: 0, shipped: 0 }
        while: state.spent + item <= budget
        do: {
            spent: state.spent + item
            shipped: state.shipped + 1
        }
        return: { shipped: state.shipped, remainingBudget: budget - state.spent }
    }
    result: shipWithinBudget(orderTotals: [40, 60, 30], budget: 100)
}
```

**output:**

```json
{
  "result": {
    "shipped": 2,
    "remainingBudget": 0
  }
}
```

`40 + 60 = 100 <= 100` ships the first two orders; the third (`30`) would push spend to `130`, so `while` stops the loop
before it is consumed.

## Scoping

One rule removes all ambiguity about "which generation of the value am I reading?": reading the carried state is always
written `state.<field>` — bare names never silently mean "the previous value".

| Name form              | Meaning                                                                   | In scope                  |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `<param>`              | loop parameter (immutable for the whole loop)                             | everywhere                |
| `state.<field>`        | previous state in `do`; current state in `while`; final state in `return` | `while`, `do`, `return`   |
| bare `<field>` in `do` | the **new** value of a sibling step field (ordinary context DAG order)    | `do` only                 |
| `item`                 | current element of `over`                                                 | `while`, `do` (over form) |
| `index`                | 0-based position of `item` in `over`                                      | `while`, `do` (over form) |

```edgerules
{
    loop lastIndex(xs: string[]): {
        over: xs
        state: { at: 0 }
        do: { at: index }
    }
    result: lastIndex(xs: ["a", "b", "c"])
}
```

**output:**

```json
{
  "result": {
    "at": 2
  }
}
```

Writing `balance: balance - payment` inside `do` (instead of `state.balance - payment`) is a link-time cycle error — the
field would reference its own new value, so the "previous vs. new" mix-up that plagues other loop notations is
unrepresentable here.

## Step Semantics: Patch, Not Replace

`do` is a **record patch** over `state`, not a replacement:

- every `do` field must name an existing `state` field and preserve its type — an unknown field name is a link error;
- state fields not mentioned in `do` carry over unchanged, with no boilerplate re-statement;
- intermediates worth auditing are just declared as ordinary state fields with an initial value.

```edgerules
{
    loop f(x: number): {
        state: { n: x, tag: "fixed" }
        while: state.n > 0
        maxIterations: 10
        do: { n: state.n - 1 }
    }
    result: f(x: 2)
}
```

**output:**

```json
{
  "result": {
    "n": 0,
    "tag": "fixed"
  }
}
```

`tag` is never mentioned in `do`, so it carries over from the initial state unchanged.

## Return Projection

`return` is optional and projects the final state to any expression — not only a record. Omitting it returns the whole
final state.

```edgerules
{
    loop sumSquares(n: number): {
        state: { i: 0, total: 0 }
        while: state.i < n
        maxIterations: 100
        do: { i: state.i + 1, total: state.total + (state.i + 1) * (state.i + 1) }
        return: state.total
    }
    result: sumSquares(n: 3)
}
```

**output:**

```json
{
  "result": 14
}
```

`return` only sees `state` — `item`/`index` are structural to iteration and do not outlive it.

## Typed Empty State

A `state` field with no inferable type from its initial expression (an empty list literal) uses the same type-wrapper
syntax as typed inputs: `<T[], []>` declares the element type explicitly and seeds the field with an empty list.

```edgerules
{
    loop keepBig(xs: number[]): {
        over: xs
        state: { selected: <number[], []> }
        do: { selected: if item > 10 then append(state.selected, item) else state.selected }
    }
    result: keepBig(xs: [5, 20, 7, 30])
}
```

**output:**

```json
{
  "result": {
    "selected": [20, 30]
  }
}
```

## Exhaustion Is an Error, Not a Result

A `while` loop that still wants to continue once `maxIterations` steps have run does **not** silently return the last
state — it produces `Invalid`, propagating like any other special value and visible to `isInvalid()`/`explain()`.
Silently returning a non-converged result would hide the exact failure a rules engine must surface.

```edgerules
{
    loop f(x: number): {
        state: { n: x }
        while: state.n > 0
        maxIterations: 2
        do: { n: state.n - 1 }
    }
    result: f(x: 5)
}
```

**output:**

```json
{
  "result": "Invalid('loop 'f' exceeded maxIterations (2)')"
}
```

A `while` expression that itself evaluates to a special value (e.g. a `Missing` input flowing into the condition)
terminates the loop the same way, with an origin naming the loop and the condition. Beyond any single loop's
`maxIterations`, `DecisionService::set_iteration_budget` caps total loop steps across one evaluation (default 100,000);
breaching it yields the same `Invalid` shape.

## Named Arguments

Loop calls accept named arguments exactly like function and ruleset calls — a call is either fully positional or fully
named, and named arguments may be written in any order:

```edgerules
{
    loop amortize(principal: number, annualRate: number, payment: number): {
        state: { balance: principal, months: 0 }
        while: state.balance > 0
        maxIterations: 600
        do: {
            balance: state.balance + state.balance * annualRate / 12 - payment
            months: state.months + 1
        }
        return: { months: state.months }
    }
    result: amortize(payment: 1200, principal: 200000, annualRate: 0.04)
}
```

**output:**

```json
{
  "result": {
    "months": 244
  }
}
```

## Link-time Checks

The linker validates the whole loop before anything runs:

- every parameter is typed;
- `state` and `do` are non-empty records of plain fields with no duplicates; every `state` field has a concretely
  inferable type (or a `<T, default>` wrapper);
- every `do` field names a `state` field and preserves its type;
- exactly one iteration source: `over` alone, or `while` + `maxIterations` together — never both, never neither;
- `maxIterations` is a positive integer **literal** (a statically auditable bound, not a computed expression);
- no parameter or state field is named `state`, and (in the `over` form) none is named `item` or `index`;
- loops join the same acyclic call graph as `func`/`ruleset` — a loop can call another loop, but never itself, directly
  or transitively.

## The Loop Is for Stateful Iteration

A plain element-wise transform is not a loop's job — `for x in xs return ...` and list indexing already cover
map/filter. Reach for `loop` when the computation is genuinely stateful: accumulation, early break, or convergence.

For the full design rationale, Portable JSON shape, CRUD editing paths, and GUI rendering, see
[loop-metaphor-spec.md](../architecture/dsl/loop-metaphor-spec.md).
