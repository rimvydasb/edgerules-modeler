# User Defined Types Reference

## Simple Types

You can define your own types and use them for function parameters and typed input placeholders.

```edgerules
{
    type NumList: <number[]>
    func inc(nums: NumList): {
        result: for n in nums return n + 1
    }
    vals: inc([1, 2, 3]).result
}
```

**output:**

```json
{
  "vals": [2, 3, 4]
}
```

## Complex Types

Types can be nested and combined.

```edgerules
{
    type Person: {
        name: <string>; age: <number>; tags: <string[]>
    }
    type PeopleList: <Person[]>
    func getAdults(people: PeopleList): {
        result: people[age >= 18]
    }
    adults: getAdults([
        {name: "Alice"; age: 30; tags: ["engineer", "manager"]}
        {name: "Bob"; age: 15; tags: ["student"]}
        {name: "Charlie"; age: 22; tags: ["designer"]}
    ])
}
```

**output:**

```json
{
  "adults": {
    "result": [
      {
        "name": "Alice",
        "age": 30,
        "tags": ["engineer", "manager"]
      },
      {
        "name": "Charlie",
        "age": 22,
        "tags": ["designer"]
      }
    ]
  }
}
```

## Typed Input Wrappers

Typed input placeholders can carry runtime metadata with the same wrapper syntax used in type declarations. This
metadata is applied when values are loaded from the request, including nested fields inside named user-defined types.

- `required: true` makes a missing input become `Invalid('<path>')`
- `default` fills in a missing optional input
- `enum` validates provided values against the allowed set and returns `Invalid('<path>')` when the value is not allowed
- `min` and `max` are inclusive numeric bounds; omitted bounds are unbounded
- `integer: true` validates that the value is an integer. It accepts `1.0` as `1` but not `1.5`.

```edgerules
{
    income: <number, 0>
    name: <string, required: true>
    surname: <string, default: "Smith">
    total: income + 1
    fullName: name + " " + surname
}
```

**output:**

```json
{
  "income": 0,
  "name": "Invalid('required input missing: name')",
  "surname": "Smith",
  "total": 1,
  "fullName": "Invalid('required input missing: name')"
}
```

Numeric validation metadata can be combined on the same input:

```edgerules
{
    age: <number, integer: true, min: 0, max: 999>
}
```

Based on complex type definition, required metadata is also applied field by field:

```edgerules
{
    type Customer: {
        id: <number>
        name: <string, required: true>
        income: <number, default: 0>
        tier: <string, default: "GOLD", enum: ["GOLD", "SILVER"]>
    }
    func process(c: Customer): c
    customer: process({})
}
```

**output:**

```json
{
  "customer": {
    "id": "Missing('customer.id')",
    "name": "Invalid('required input missing: customer.name')",
    "income": 0,
    "tier": "GOLD"
  }
}
```

## Argument Casting

At runtime, complex objects are cast to the expected type when passed as function arguments. Casting is fault-tolerant
and works in this way: fields that do not exist in the object definition are filtered out, and fields that exist in the
definition, but not in the object, are set to Special Value. When the target type uses wrapper metadata, casting also
applies `required`, `default`, and `enum` recursively to those declared fields. This approach brings predictable
behavior and is fault-tolerant with unexpected data in production.

```edgerules
{
    type Person: {
        name: <string>; age: <number>; tags: <string[]>
    }
    func checkPerson(person: Person): {
        checkedPerson: person
        isStudent: contains(person.tags, "student")
        isAdult: person.age >= 18
    }
    result: checkPerson({
        name: "Alice";
        tags: ["manager"]
    })
}
```

**output:**

```json
{
  "result": {
    "checkedPerson": {
      "name": "Alice",
      "age": "Missing('result.age')",
      "tags": ["manager"]
    },
    "isStudent": false,
    "isAdult": false
  }
}
```

## Explicit Casting

During runtime, complex objects can be explicitly cast to the expected type using the `as` operator. Behavior is the
same as with argument casting: fields that do not exist in the object definition are filtered out. And fields that exist
in the definition, but not in the object, are set to Special Value. Wrapper metadata on the target type is also applied
recursively, so declared defaults and required fields affect the cast result. Use explicit casting when you want to
ensure that the object conforms to the expected type. This method is fault-tolerant and will not throw errors on missing
or extra fields. Casting will not convert field types - if the field type does not match the expected type, the
execution will be terminated.

```edgerules
{
    type Point: { x: <number>; y: <number> }
    p: { x: 1 } as Point
}
```

**output:**

```json
{
  "p": {
    "x": 1,
    "y": "Missing('y')"
  }
}
```
