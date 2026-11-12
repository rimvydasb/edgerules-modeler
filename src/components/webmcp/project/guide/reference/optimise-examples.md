# Optimise Examples

The first optimisation entries for the Modeler Examples Library. Each one shows the composition that motivates the
`optimise` metaphor: **rules produce the numbers and the gates** — auditable, testable, versioned — and **the solver
spends a scarce resource against them**. Element syntax and result semantics:
[optimise-reference.md](optimise-reference.md); wiring a solver:
[optimise-solver-hosting.md](optimise-solver-hosting.md).

All four models are **solver-preload tagged**: `service.requiresSolver()` returns `true`, which is the signal a host
reads at model-open time to load highs-js before the first `execute`. The models and every output below are executed
against real highs-js by `tests/wasm/models/optimisation.test.ts` and `tests/wasm/models/client-outreach.test.ts` —
those tests are what keep this document honest.

## 1. Factory production — spend a day of capacity

A workshop makes chairs and tables. Pricing rules produce the per-unit margin; the solver decides the mix against three
shared resources.

```edgerules
{
    prices: { chair: 45, table: 120 }
    materialCost: { chair: 30, table: 80 }

    func unitMargin(price, cost): { result: price - cost }

    optimise productionPlan(
        workers: number, sticks: number, plates: number,
        chairMargin: number, tableMargin: number
    ): {
        bottlenecks: true
        variables: {
            chairs: <number, integer: true, min: 0>
            tables: <number, integer: true, min: 0>
        }
        maximise: chairMargin * chairs + tableMargin * tables
        constraints: {
            workerCapacity: 1 * chairs + 3 * tables <= workers
            stickSupply:    4 * chairs + 4 * tables <= sticks
            plateSupply:    1 * chairs + 2 * tables <= plates
        }
        timeLimit: 1000
    }

    plan: productionPlan(
        workers: 8, sticks: 40, plates: 12,
        chairMargin: unitMargin(prices.chair, materialCost.chair).result,
        tableMargin: unitMargin(prices.table, materialCost.table).result
    )
    summary: {
        status: plan.status
        profit: plan.objective
        chairs: plan.chairs
        tables: plan.tables
        workerWorth: plan.bottlenecks.workerCapacity
    }
}
```

**output (`summary`):**

```json
{
  "status": "optimal",
  "profit": 120,
  "chairs": 8,
  "tables": 0,
  "workerWorth": 0
}
```

A table earns 40 against a chair's 15 — and eats three worker-hours to the chair's one. With eight hours to spend the
solver builds eight chairs and no tables.

**Why every bottleneck is 0 here.** Both variables are integers, so the fixed-integer re-solve that prices constraints
has no continuous structure left and every dual comes back 0 — the documented behaviour, matching FICO, Gurobi, and
CPLEX (see [optimise-reference.md](optimise-reference.md) § Bottleneck values). The result's `notes` say so:

```json
[
  "Solved by highs-js 1.15.1.",
  "Feasibility and the reported objective were re-verified by the engine within tolerance; optimality was not re-verified.",
  "The objective value is stable across solver versions; when several plans tie, which one is returned is not.",
  "Bottleneck values are one valid pricing of the constraints, not a unique one.",
  "Bottleneck values hold locally, with the integer variables fixed at their solved values — they are not a global sensitivity guarantee."
]
```

Meaningful shadow prices need a continuous variable somewhere — the next example.

## 2. Feed blending — hit a quality floor at the lowest cost

A blend of corn and soy must weigh exactly one batch and carry a minimum of protein. Quantities are continuous
kilograms, so this is a pure LP and the bottleneck values come free with the solve.

```edgerules
{
    batchKg: 100
    protein: { floorPercent: 20 }

    optimise feedMix(
        batch: number, proteinFloor: number,
        cornCost: number, soyCost: number, cornLimit: number
    ): {
        bottlenecks: true
        variables: {
            corn: <number, min: 0>
            soy:  <number, min: 0>
        }
        minimise: cornCost * corn + soyCost * soy
        constraints: {
            batchWeight:  1 * corn + 1 * soy = batch
            proteinFloor: 0.1 * corn + 0.5 * soy >= proteinFloor
            cornCeiling:  1 * corn <= cornLimit
        }
    }

    mix: feedMix(
        batch: batchKg,
        proteinFloor: batchKg * protein.floorPercent / 100,
        cornCost: 0.3, soyCost: 0.9,
        cornLimit: batchKg * 0.8
    )
    summary: {
        status: mix.status
        cost: mix.objective
        costPerKg: mix.objective / batchKg
        corn: mix.corn
        soy: mix.soy
        proteinWorth: mix.bottlenecks.proteinFloor
        cornCeilingWorth: mix.bottlenecks.cornCeiling
    }
}
```

**output (`summary`):**

```json
{
  "status": "optimal",
  "cost": 45,
  "costPerKg": 0.45,
  "corn": 75,
  "soy": 25,
  "proteinWorth": 1.5,
  "cornCeilingWorth": 0
}
```

Cheap corn is limited by the protein requirement, not by its own ceiling: 75 kg corn + 25 kg soy carries exactly 20 kg
of protein for 45.00 per batch. The bottleneck values price the two binding rows — **one more kilogram of required
protein costs 1.50**, one more kilogram of batch weight costs 0.15 — while `cornCeiling` reports 0 because it never
binds. Those numbers are the whole business argument for `bottlenecks: true`.

## 3. Order sourcing — split an order across suppliers, respecting a compliance gate

Rules decide _who is allowed to supply_; the solver decides _how much from whom_. The gate is the auditable part: the
solver never sees a supplier the compliance rule ruled out.

```edgerules
{
    order: { units: 80 }
    alpha: { unitCost: 12, capacity: 40, certified: true }
    beta:  { unitCost: 9,  capacity: 60, certified: true }
    gamma: { unitCost: 7,  capacity: 50, certified: false }

    func usableCapacity(supplier): {
        result: if supplier.certified then supplier.capacity else 0
    }

    optimise sourcing(
        units: number,
        alphaCost: number, alphaCap: number,
        betaCost: number,  betaCap: number,
        gammaCost: number, gammaCap: number
    ): {
        variables: {
            fromAlpha: <number, integer: true, min: 0>
            fromBeta:  <number, integer: true, min: 0>
            fromGamma: <number, integer: true, min: 0>
        }
        minimise: alphaCost * fromAlpha + betaCost * fromBeta + gammaCost * fromGamma
        constraints: {
            demandMet:     1 * fromAlpha + 1 * fromBeta + 1 * fromGamma = units
            alphaCapacity: 1 * fromAlpha <= alphaCap
            betaCapacity:  1 * fromBeta  <= betaCap
            gammaCapacity: 1 * fromGamma <= gammaCap
        }
    }

    split: sourcing(
        units: order.units,
        alphaCost: alpha.unitCost, alphaCap: usableCapacity(alpha).result,
        betaCost:  beta.unitCost,  betaCap:  usableCapacity(beta).result,
        gammaCost: gamma.unitCost, gammaCap: usableCapacity(gamma).result
    )
    summary: {
        status: split.status
        spend: split.objective
        fromAlpha: split.fromAlpha
        fromBeta: split.fromBeta
        fromGamma: split.fromGamma
    }
}
```

**output (`summary`):**

```json
{
  "status": "optimal",
  "spend": 780,
  "fromAlpha": 20,
  "fromBeta": 60,
  "fromGamma": 0
}
```

Gamma is the cheapest supplier at 7 per unit — and uncertified, so `usableCapacity` hands the solver a capacity of 0 and
gamma never appears in the plan. Beta covers its full 60 units at 9, alpha the remaining 20 at 12: 780 in all.

### When the order cannot be sourced

Raise the order to 250 units, beyond what the certified suppliers can cover, and the model is infeasible. Rather than
just saying so, the engine runs the elastic relaxation and names the constraint that has to give. The model is the one
above with `units: 250` and one field added:

```edgerules
{
    order: { units: 250 }
    alpha: { unitCost: 12, capacity: 40, certified: true }
    beta:  { unitCost: 9,  capacity: 60, certified: true }
    gamma: { unitCost: 7,  capacity: 50, certified: false }

    func usableCapacity(supplier): {
        result: if supplier.certified then supplier.capacity else 0
    }

    optimise sourcing(
        units: number,
        alphaCost: number, alphaCap: number,
        betaCost: number,  betaCap: number,
        gammaCost: number, gammaCap: number
    ): {
        variables: {
            fromAlpha: <number, integer: true, min: 0>
            fromBeta:  <number, integer: true, min: 0>
            fromGamma: <number, integer: true, min: 0>
        }
        minimise: alphaCost * fromAlpha + betaCost * fromBeta + gammaCost * fromGamma
        constraints: {
            demandMet:     1 * fromAlpha + 1 * fromBeta + 1 * fromGamma = units
            alphaCapacity: 1 * fromAlpha <= alphaCap
            betaCapacity:  1 * fromBeta  <= betaCap
            gammaCapacity: 1 * fromGamma <= gammaCap
        }
    }

    split: sourcing(
        units: order.units,
        alphaCost: alpha.unitCost, alphaCap: usableCapacity(alpha).result,
        betaCost:  beta.unitCost,  betaCap:  usableCapacity(beta).result,
        gammaCost: gamma.unitCost, gammaCap: usableCapacity(gamma).result
    )
    why: explain(split.objective).origin
}
```

**output (`why`):**

```json
"E340: optimise 'sourcing' is infeasible — the constraints contradict each other; the smallest fix relaxes 'demandMet' by 150 (= 250)"
```

150 of the 250 units cannot be sourced: either the order shrinks, or a supplier's certification (or capacity) has to
change. Every `Missing` field of the result carries the same explanation, so `explain()` on any of them answers the
question. See [optimise-reference.md](optimise-reference.md) § Infeasibility diagnostics.

## 4. Budget allocation — one decision variable per list element

The list of candidates comes from data, so the model cannot name a variable per candidate. An indexed variable
declares one per element of a list parameter, and a constraint family writes one row per element.

```edgerules
{
    optimise allocate(caps: number[], values: number[], budget: number): {
        bottlenecks: true
        variables: { amount: <number[], min: 0, over: caps> }
        maximise: sum(for i in 0..(count(caps) - 1) return values[i] * amount[i])
        constraints: {
            capped: for i in 0..(count(caps) - 1) return amount[i] <= caps[i]
            total: sum(for a in amount return a) <= budget
        }
    }
    plan: allocate(caps: [4, 4, 4], values: [5, 3, 1], budget: 6)
    summary: {
        status: plan.status
        objective: plan.objective
        amount: plan.amount
        bottlenecks: plan.bottlenecks
    }
}
```

**output (`summary`):**

```json
{
  "status": "optimal",
  "objective": 26,
  "amount": [4, 2, 0],
  "bottlenecks": { "capped": [2, 0, 0], "total": 3 }
}
```

The budget of 6 goes to the best values first: 4 units at 5, then 2 units at 3. One more unit of budget is worth 3, the
value of the second candidate. Lifting the first cap by one unit is worth 2: one unit moves from value 3 to value 5. On
the wire the solver sees `amount[0]`, `amount[1]`, `amount[2]` and the rows `capped[0]`, `capped[1]`, `capped[2]`, and
`total`. An infeasible family names its rows the same way in the E340 explanation.

`tests/wasm/models/client-outreach.test.ts` solves the larger acceptance model: 100 clients, three binary channel
variables per client (300 variables), and a `oneAction` family of one row per client.
