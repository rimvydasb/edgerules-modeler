# List Built-in Functions Reference

## contains

Checks if a list contains a value.

```edgerules
contains([1,2,3], 2)
```

**output:**

```json
true
```

## count

Returns the number of elements.

```edgerules
count([1,2,3])
```

**output:**

```json
3
```

## min

Finds the smallest number.

```edgerules
min([1,2,3])
```

**output:**

```json
1
```

## max

Finds the largest number.

```edgerules
max([1,2,3])
```

**output:**

```json
3
```

## sum

Adds up all numbers.

```edgerules
sum([1,2,3])
```

**output:**

```json
6
```

## product

Multiplies all numbers.

```edgerules
product([2,3,4])
```

**output:**

```json
24
```

## mean

Calculates the average.

```edgerules
mean([1,2,3])
```

**output:**

```json
2
```

## median

Returns the middle value.

```edgerules
median([1,2,3])
```

**output:**

```json
2
```

## stddev

Standard deviation of numbers.

```edgerules
stddev([2,4])
```

**output:**

```json
1
```

## mode

Most frequent values (may be multiple).

```edgerules
mode([1,2,2,3])
```

**output:**

```json
[2]
```

## all

True if all values are true.

```edgerules
all([true,true,false])
```

**output:**

```json
false
```

## any

True if at least one value is true.

```edgerules
any([false,false,true])
```

**output:**

```json
true
```

## sublist

Extracts sublist from index to end.

```edgerules
sublist([1,2,3], 2)
```

**output:**

```json
[2, 3]
```

## sublist (with length)

Extracts sublist of given length.

```edgerules
sublist([1,2,3], 1, 2)
```

**output:**

```json
[1, 2]
```

## append

Adds elements at the end.

```edgerules
append([1], 2, 3)
```

**output:**

```json
[1, 2, 3]
```

## concatenate

Joins lists together.

```edgerules
concatenate([1,2], [3])
```

**output:**

```json
[1, 2, 3]
```

## insertBefore

Inserts an item at a position.

```edgerules
insertBefore([1,3], 1, 2)
```

**output:**

```json
[2, 1, 3]
```

## remove

Removes element at position.

```edgerules
remove([1,2,3], 2)
```

**output:**

```json
[1, 3]
```

## reverse

Reverses list order.

```edgerules
reverse([1,2,3])
```

**output:**

```json
[3, 2, 1]
```

## indexOf

Returns 1-based positions of matches.

```edgerules
indexOf([1,2,3,2], 2)
```

**output:**

```json
[2, 4]
```

## find

Returns the **0-based** index of the first matching element, or `Missing` when the value is absent. Unlike `indexOf`
(every match, 1-based), `find` returns a single index for the first hit.

```edgerules
{
    found: find([10, 20, 30], 30)
    absent: find([10, 20, 30], 99)
}
```

**output:**

```json
{
  "found": 2,
  "absent": "Missing('value not found')"
}
```

## union

Combines lists without duplicates.

```edgerules
union([1,2], [2,3])
```

**output:**

```json
[1, 2, 3]
```

## distinctValues

Removes duplicates.

```edgerules
distinctValues([1,2,3,2,1])
```

**output:**

```json
[1, 2, 3]
```

## duplicateValues

Returns only the duplicates (unique).

```edgerules
duplicateValues([1,2,3,2,1])
```

**output:**

```json
[2, 1]
```

## flatten

Flattens nested lists. However, only homogeneous lists are supported.

```edgerules
flatten([[1,2], [3], [4]])
```

**output:**

```json
[1, 2, 3, 4]
```

## sort

Sorts list ascending or descending.

```edgerules
{
    ascending: sort([3,1,2,4,0])
    descending: sortDescending([3,1,2,4,0])
}
```

**output:**

```json
{
  "ascending": [0, 1, 2, 3, 4],
  "descending": [4, 3, 2, 1, 0]
}
```

## join

Join supports simple strings join without delimiter, with delimiter, and with delimiter and wrap.

```edgerules
{
    simple: join(["a","b","c"])
    delimiter: join(["a","b","c"], ", ")
    delimiterAndWrap: join(["a","b","c"], ", ", "[", "]")
}
```

**output:**

```json
{
  "simple": "abc",
  "delimiter": "a, b, c",
  "delimiterAndWrap": "[a, b, c]"
}
```

## isEmpty

True if list has no elements.

```edgerules
isEmpty([])
```

**output:**

```json
true
```

## partition

Splits list into sublists of given size.

```edgerules
partition([1,2,3,4,5], 2)
```

**output:**

```json
[[1, 2], [3, 4], [5]]
```

## groupBy

Groups a list of records by a field's value into `{ key, items }` group records, in first-seen key order. Keys keep
their original value type. The group list stays statically typed: iterate it with `for`, filter it with `[key = ...]`,
and read `g.key` / `g.items` — any other field is a link error.

```edgerules
groupBy([
  { segment: "retail", amount: 100 }
  { segment: "premium", amount: 500 }
  { segment: "retail", amount: 50 }
], "segment")
```

**output:**

```json
[
  {
    "key": "retail",
    "items": [
      {"segment": "retail", "amount": 100},
      {"segment": "retail", "amount": 50}
    ]
  },
  {"key": "premium", "items": [{"segment": "premium", "amount": 500}]}
]
```

A record without the field makes the result a typed `Missing` (surface it with `explain`); records whose field is
`notApplicable` are skipped.

## countBy

Group sizes in one call: like `groupBy`, but each group carries `count` instead of `items`.

```edgerules
countBy([
  { segment: "retail" }
  { segment: "premium" }
  { segment: "retail" }
], "segment")
```

**output:**

```json
[
  {"key": "retail", "count": 2},
  {"key": "premium", "count": 1}
]
```

## sumBy / avgBy / minBy / maxBy

Field-wise numeric aggregation over a list of records — `sumBy(rows, "amount")` is `sum` over every record's `amount`.
Same totality rules as the underlying aggregates: a `missing`/`invalid` field value propagates, `notApplicable` records
are skipped, and an absent field is a typed `Missing`.

```edgerules
{
    rows: [{ amount: 100 }, { amount: 500 }, { amount: 300 }]
    total: sumBy(rows, "amount")
    average: avgBy(rows, "amount")
    lowest: minBy(rows, "amount")
    highest: maxBy(rows, "amount")
}
```

**output:**

```json
{
  "rows": [{"amount": 100}, {"amount": 500}, {"amount": 300}],
  "total": 900,
  "average": 300,
  "lowest": 100,
  "highest": 500
}
```

## zip

Pairs two lists element-wise (`[a[i], b[i]]`), truncated to the shorter list.

```edgerules
zip([1, 2, 3], ["a", "b"])
```

**output:**

```json
[
  [1, "a"],
  [2, "b"]
]
```

## range

Number list generator with inclusive bounds, aligned with the native `a..b` range: `range(5, 1)` is empty, descending
needs an explicit negative step. The optional step may be decimal; a zero step or a result over 10000 elements is
`invalid`.

```edgerules
range(0, 10, 3)
```

**output:**

```json
[0, 3, 6, 9]
```
