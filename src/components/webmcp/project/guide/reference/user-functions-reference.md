# User-Defined Functions Reference

## Simple Functions

User can define their own functions and use them in execution. If argument types are not specified, they will be
inferred during runtime.

```edgerules
{
    func inc(nums): {
        result: for n in nums return toString(n) + "!"
    }
    asNumbers: inc([1, 2, 3]).result
    asChars: inc(['a','b','c']).result
}
```

**output:**

```json
{
  "asNumbers": ["1!", "2!", "3!"],
  "asChars": ["a!", "b!", "c!"]
}
```

## Inline Functions

User can define simple single return functions inline without the need for a full function body.

```edgerules
{
    func addOne(x): x + 1
    func doubleAndAddOne(y): addOne(y * 2)
    result: doubleAndAddOne(3)
}
```

**output:**

```json
{
  "result": 7
}
```

## Declared Return Types

A function signature can declare its return type with `-> TypeRef`, placed between the parameter list and the body
colon. When present, it is checked against the type the body actually evaluates to — a mismatch fails to link. When
absent, the return type is inferred exactly as before, with no change in behavior.

```edgerules
{
    func isAdult(age: number) -> boolean: age >= 18
    func doubled(nums: number[]) -> number[]: for n in nums return n * 2
    result1: isAdult(20)
    result2: doubled([1, 2, 3])
}
```

**output:**

```json
{
  "result1": true,
  "result2": [2, 4, 6]
}
```

## External Function Declarations

`external func` declares a signature the _host_ must satisfy — no body, and the `-> TypeRef` arrow is mandatory (there
is no body to infer it from). Every parameter must also carry a type annotation, since nothing else could supply one. A
call site type-checks against the declared signature exactly like a call to an ordinary function, and the declared
return type flows into inference for any field that depends on the result.

`external func` must be declared at the root of the model — a declaration nested inside a `{...}` field, `func`,
`ruleset`, or `loop` body is a parse error. Names are therefore unique per model, and `get('*', ['external-method'])`
is a single flat call listing every external function a host must be able to resolve. Call sites remain legal anywhere,
nested or not.

```edgerules
{
    type MyData: {
        id: <number, required: true>
        name: <string, required: true>
    }

    external func fetchData(url: string) -> MyData

    myData: fetchData("https://api.example.com/data")
    label: "Data: " + myData.name
}
```

The engine never performs I/O itself. Executing a model that _demands_ a call to an external function (the call site is
reached on the evaluation path, and its arguments are fully evaluated) evaluates that call site to
`Pending(ReturnType, path)` — a system-only special value, like `Missing`, that a caller can test with `isPending(x)` —
and the call is collected into the response's ready frontier for the host to actually perform. `Pending` propagates
through arithmetic, string, casting, and aggregation the same way `Missing` does. A call whose own arguments are still
`Pending` (it depends on another unresolved call's result) is simply not collected this round; it becomes ready, and
gets collected, once its blocking dependency is resolved. A model that only _declares_ an external function without ever
demanding a call to it evaluates normally — `fetchData` above could be declared and simply never called from any
reachable field.

Executing such a model through the envelope API (`DecisionService.execute`, `packages/_core`/`@edgerules/node`/
`@edgerules/web`; `execute`/`resume` are `async`) returns a `PartialResult` instead of throwing, once at least one call
is demanded and unresolved:

```js
const result = await service.execute('*');
if (isPartialResult(result)) {
  // result.externalCalls: [{type: "func", path: "myData", name: "fetchData",
  //   arguments: {url: "https://api.example.com/data"}, resultType: "MyData"}]
  const final = await service.resume(result, [{path: 'myData', result: {id: 42, name: 'Alice'}}]);
  // final: {myData: {id: 42, name: "Alice"}, label: "Data: Alice"}
}
```

`resume` appends the given resolutions to the accumulated input envelope (`result.envelope` — the durable artifact to
persist between rounds) and re-executes; resolving only some of `externalCalls` is legal, and any call newly unblocked
by a resolution is collected in that same call rather than requiring an extra round-trip just to discover it. A resolved
value is cast through the call's declared return type on injection — a malformed payload (e.g. a non-numeric string for
a `-> number` call) produces `Invalid(...)` fields rather than aborting execution. A resolution can also be negative
(`{path, missing: true}`), recording `Missing(ReturnType, '<path>')` so the decision completes under ordinary `Missing`
propagation instead of staying `Pending` forever.

A host that always resolves `fetchData` the same way does not need this manual loop at all: register a resolver once
with `service.registerExternalFunction('fetchData', handler)` and every `execute`/`resume` call resolves it
transparently, only surfacing a `PartialResult` for calls nobody registered a handler for. See
[api-spec.md](../architecture/api-spec.md#host-registered-external-call-handlers-packages_core) for
the full provider/event registry, [api-spec.md](../architecture/api-spec.md#execution-envelopes) for
the raw envelope contract, and
[external-executions-spec.md](../architecture/external-executions-spec.md) for the full feature
specification and its design rationale.

**The `optimise` metaphor rides this same mechanism.** A demanded `optimise` call site goes `Pending` and surfaces in
the same ready frontier, as an entry with `type: "optimise"` carrying an LP/MILP problem instead of function arguments;
the host resolves it with a solver rather than a function handler (`registerSolver`, not `registerExternalFunction` —
routing is by `type` first, so the two never cross). Everything above about `Pending` propagation, partial resolution,
negative resolutions, and the durable envelope applies unchanged. See [optimise-reference.md](optimise-reference.md) for
the element, and [optimise-solver-hosting.md](optimise-solver-hosting.md) for the host side.

## Return Body Scoping

User can define a specific `return` field in function bodies to define the exact return value, allowing internal
variables to be hidden.

```edgerules
{
    func calculateDiscount(productType): {
        productDiscounts: [0.20, 0.15, 0.11]
        campaignDiscount: 0.05
        activeCampaign: "SUMMER_SALE"
        baseDiscount: productDiscounts[productType - 1]
        return: {
            campaign: activeCampaign
            discount: baseDiscount + campaignDiscount
        }
    }
    discount1: calculateDiscount(1)
    discount2: calculateDiscount(2)
}
```

**output:**

```json
{
  "discount1": {
    "campaign": "SUMMER_SALE",
    "discount": 0.25
  },
  "discount2": {
    "campaign": "SUMMER_SALE",
    "discount": 0.2
  }
}
```

## Named Arguments

Function calls can pass arguments by parameter name instead of by position, removing the risk of accidentally swapping
two same-typed arguments. A call must be either fully positional or fully named. Named arguments are matched against the
callee's declared parameter names regardless of the order they are written in. Named arguments are only valid for
user-defined functions — built-in functions must always be called positionally.

```edgerules
{
    func risk(age, income): age + income
    result: risk(income: 200, age: 30)
}
```

**output:**

```json
{
  "result": 230
}
```

## Functions as Enclosed Context

Inside a function, it is possible to nest other functions and variables deeply. Functions cannot access variables from
the outer scope - this makes each function an enclosed context that can be reused and reasoned about independently.

```edgerules
{
    type Customer: {
        name: <string>;
        income: <number>;
        expense: <number>;
        tags: <string[]>
    }
    func customerDetails(customer: Customer): {
        self: customer
        financialInformation: {
            total: self.income + self.expense
            savings: self.income - self.expense
            isProfitable: self.income > self.expense
        }
        status: {
            tagCount: count(self.tags)
            func hasTag(customer, tag: string): {
                result: contains(customer.tags, tag)
            }
            isVIP: hasTag(self, "vip").result
        }
    }
    detailedCustomer: customerDetails({
        name: "Alice";
        income: 1000;
        expense: 400;
        tags: ["vip", "premium"]
    })
}
```

**output:**

```json
{
  "detailedCustomer": {
    "self": {
      "name": "Alice",
      "income": 1000,
      "expense": 400,
      "tags": ["vip", "premium"]
    },
    "financialInformation": {
      "total": 1400,
      "savings": 600,
      "isProfitable": true
    },
    "status": {
      "tagCount": 2,
      "isVIP": true
    }
  }
}
```
