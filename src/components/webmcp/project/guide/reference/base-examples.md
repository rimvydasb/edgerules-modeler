# Introduction

**EdgeRules** expression language helps you to define business rules and calculations. It is a simple, declarative,
referentially transparent, and type-safe language with a small set of concepts that you can combine to express complex
logic. Here are some interactive examples to get you started with JSON output.

In the example below, we calculate the best 3-month sales period. You can edit the code and see the results immediately.

```edgerules
{
    sales: [10, 20, 8, 7, 1, 10, 6, 78, 0, 8, 0, 8]
    salesCount: count(sales)
    func sales3(month, sales): {
        result: sales[month] + sales[month + 1] + sales[month + 2]
    }
    acc: for m in 0..(salesCount - 3) return sales3(m, sales).result
    best: max(acc)
}
```

**output:**

```json
{
  "sales": [10, 20, 8, 7, 1, 10, 6, 78, 0, 8, 0, 8],
  "salesCount": 12,
  "acc": [38, 35, 16, 18, 17, 94, 84, 86, 8, 16],
  "best": 94
}
```

## Arithmetic

Integers and reals with +, -, \*, /, ^ and unary -.

```edgerules
{
    summing: 4 + 1.2
    subtracting: 12 - 3
    product: 6 * 7
    division: 10 / 4
    power: 2 ^ 8
    negate: -(5 + 1)
}
```

**output:**

```json
{
  "summing": 5.2,
  "subtracting": 9,
  "product": 42,
  "division": 2.5,
  "power": 256,
  "negate": -6
}
```

## Comparisons

Numeric comparisons: <, <=, >, >=, =, <>.',

```edgerules
{
    lower: 1 < 2
    lowerEquals: 2 <= 2
    greater: 3 > 1
    greaterEquals: 4 >= 4
    simpleEquals: 5 = 5
    negate: 6 <> 7
}
```

**output:**

```json
{
  "lower": true,
  "lowerEquals": true,
  "greater": true,
  "greaterEquals": true,
  "simpleEquals": true,
  "negate": true
}
```

## Boolean

Booleans true/false and logical operators not/and/or/xor.

```edgerules
{
    a: true
    b: false
    allTrue: a and not b
    anyTrue: a or b
    justOne: a xor b
    negateComp: not (3 = 4)
}
```

**output:**

```json
{
  "a": true,
  "b": false,
  "allTrue": true,
  "anyTrue": true,
  "justOne": true,
  "negateComp": true
}
```

## Strings

Single or double quotes. Compare with = and <>.

```edgerules
{
    a: 'hello'
    b: "hello"
    equal: a = b
    notEqual: a <> b
}
```

**output:**

```json
{
  "a": "hello",
  "b": "hello",
  "equal": true,
  "notEqual": false
}
```

## Lists

Indexing, filtering, and numeric built-ins sum/max/count; find returns index or Missing.

```edgerules
{
    nums: [1, 5, 12, 7]
    first: nums[0]
    filtered: nums[... > 6]
    sumAll: sum(nums)
    maxAll: max(nums)
    countAll: count(nums)
    idxOf7: find(nums, 7)
}
```

**output:**

```json
{
  "nums": [1, 5, 12, 7],
  "first": 1,
  "filtered": [12, 7],
  "sumAll": 25,
  "maxAll": 12,
  "countAll": 4,
  "idxOf7": 3
}
```

## Filters

Filters are defined within brackets [...] after a list where ... represents each item. Object fields can be accessed
with dot notation.

```edgerules
{
    vals: [10, 15, 20, 25, 30]
    over20: vals[... > 20]
    below20: vals[not ... > 20]
    between: vals[(... > 10) and (... <= 25)]
    complex: [{a: 1}, {a: 2}][a > 1]
    nested: [{a: {b: 1}}, {a: {b: 2}}][a.b > 1]
}
```

**output:**

```json
{
  "vals": [10, 15, 20, 25, 30],
  "over20": [25, 30],
  "below20": [10, 15, 20],
  "between": [15, 20, 25],
  "complex": [
    {
      "a": 2
    }
  ],
  "nested": [
    {
      "a": {
        "b": 2
      }
    }
  ]
}
```

## Ranges

Inclusive integer ranges a..b; use in loops and built-ins.

```edgerules
{
    range: 1..5
    doubled: for n in 1..5 return n * 2
    sumR: sum(1..5)
    maxR: max(1..5)
    countR: count(1..5)
}
```

**output:**

```json
{
  "range": [1, 2, 3, 4, 5],
  "doubled": [2, 4, 6, 8, 10],
  "sumR": 15,
  "maxR": 5,
  "countR": 5
}
```

## Object (Context)

Named fields with references and nesting.

```edgerules
{
    person: {
        first: 'Ada'
        born: 1815
    }
    ageNow: 2025 - person.born
}
```

**output:**

```json
{
  "person": {
    "first": "Ada",
    "born": 1815
  },
  "ageNow": 210
}
```

## Date

date("YYYY-MM-DD"), compare, add/sub durations, fields and helpers.

```edgerules
{
    d1: date("2017-05-03")
    d2: date("2017-05-04")
    compare: d1 < d2
    plusDays: d1 + duration("P1D")
    beforeHalfDay: date("2017-03-31") - duration("PT12H")
    minusMonth: date("2017-03-31") - period("P1M")
    y: d1.year
    wNum: dayOfWeek(d1)
    lastDom: daysInMonth(date("2025-02-10"))
    between: calendarDiff(date("1987-03-07"),d2)
}
```

**output:**

```json
{
  "d1": "2017-05-03",
  "d2": "2017-05-04",
  "compare": true,
  "plusDays": "2017-05-04T00:00:00",
  "beforeHalfDay": "2017-03-30T12:00:00",
  "minusMonth": "2017-02-28",
  "y": 2017,
  "wNum": 3,
  "lastDom": 28,
  "between": "P30Y1M27D"
}
```

## Time

time("hh:mm:ss"), compare, +/- duration, and fields.

```edgerules
{
    t1: time("13:10:30")
    t2: time("10:00:00")
    diff: t1 - t2
    plusMin: t2 + duration("PT45M")
    hour: t1.hour
}
```

**output:**

```json
{
  "t1": "13:10:30",
  "t2": "10:00:00",
  "diff": "PT3H10M30S",
  "plusMin": "10:45:00",
  "hour": 13
}
```

## DateTime

datetime("YYYY-MM-DDThh:mm:ss"), compare, +/- duration, fields.

```edgerules
{
    dt1: datetime("2017-05-03T13:10:30")
    dt2: datetime("2017-05-01T10:00:00")
    diff: dt1 - dt2
    plus: dt1 + duration("P2DT3H")
    timePart: dt1.time
    weekday: dt1.weekday
}
```

**output:**

```json
{
  "dt1": "2017-05-03T13:10:30",
  "dt2": "2017-05-01T10:00:00",
  "diff": "P2DT3H10M30S",
  "plus": "2017-05-05T16:10:30",
  "timePart": "13:10:30",
  "weekday": 3
}
```

## Duration

duration("ISO-8601"). Years–months and days–time kinds; use with dates/times.

```edgerules
{
    ym: duration("P1D")
    dt: duration("P2DT3H")
    addToDate: date("2017-05-03") + ym
    subFromTime: time("12:00:00") - duration("PT30M")
}
```

**output:**

```json
{
  "ym": "P1D",
  "dt": "P2DT3H",
  "addToDate": "2017-05-04T00:00:00",
  "subFromTime": "11:30:00"
}
```

## Special Values

Operations may yield sentinel values like Missing/NotApplicable for certain situations.

```edgerules
{
    idx: find([1,2], 3)
    oob: [10][5]
}
```

**output:**

```json
{
  "idx": "Missing('value not found')",
  "oob": "Missing('list index out of range')"
}
```
