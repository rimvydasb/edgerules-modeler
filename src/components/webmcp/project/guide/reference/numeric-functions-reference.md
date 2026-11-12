# Numeric Functions Reference

## abs

Returns the absolute value.

```edgerules
abs(-5)
```

**output:**

```json
5
```

## round

Rounds to digits (default 0). Ties move to the nearest even number (Banker's Rounding).

```edgerules
{
  r1: round(2.5)
  r2: round(3.5)
  r3: round(2.55, 1)
  r4: round(2.65, 1)
}
```

**output:**

```json
{
  "r1": 2,
  "r2": 4,
  "r3": 2.6,
  "r4": 2.6
}
```

## roundUp

Rounds away from zero.

```edgerules
{
    neg: roundUp(-1.1)
    pos: roundUp(1.1)
}
```

**output:**

```json
{
  "neg": -2,
  "pos": 2
}
```

## roundDown

Rounds toward zero. Alias of `trunc`.

```edgerules
{
    neg: roundDown(-1.9)
    pos: roundDown(1.9)
}
```

**output:**

```json
{
  "neg": -1,
  "pos": 1
}
```

## roundHalfUp

Legal/commercial rounding (HALF_UP): ties move away from zero, unlike the Banker's rounding of `round`.

```edgerules
{
    r1: roundHalfUp(2.5)
    r2: roundHalfUp(2.345, 2)
    r3: roundHalfUp(-2.5)
}
```

**output:**

```json
{
  "r1": 3,
  "r2": 2.35,
  "r3": -3
}
```

## toFixed

Fixed-decimal rendering for documents: rounds half-up and keeps trailing zeros. Returns a **string**.

```edgerules
{
    price: toFixed(2.5, 2)
    whole: toFixed(1234.5, 0)
}
```

**output:**

```json
{
  "price": "2.50",
  "whole": "1235"
}
```

## floor

Rounds toward −∞. The largest integer ≤ number.

```edgerules
{
    neg: floor(-1.1)
    pos: floor(1.1)
}
```

**output:**

```json
{
  "neg": -2,
  "pos": 1
}
```

## ceiling

Rounds toward +∞. The smallest integer ≥ number.

```edgerules
{
    neg: ceiling(-1.9)
    pos: ceiling(1.9)
}
```

**output:**

```json
{
  "neg": -1,
  "pos": 2
}
```

## trunc

Removes the fractional part. Equivalent to `roundDown(number, 0)`.

```edgerules
{
    neg: trunc(-1.9)
    pos: trunc(1.9)
}
```

**output:**

```json
{
  "neg": -1,
  "pos": 1
}
```

## modulo

Returns the remainder. Sign matches the divisor `b`. Align with `idiv` & Python `%` (sign follows divisor).

```edgerules
{
    pos: modulo(5, 2)
    neg: modulo(-5, 2)
    negDiv: modulo(5, -2)
}
```

**output:**

```json
{
  "pos": 1,
  "neg": 1,
  "negDiv": -1
}
```

## idiv

Integer division. Returns `floor(a / b)`.

```edgerules
{
    pos: idiv(5, 2)
    neg: idiv(-5, 2)
}
```

**output:**

```json
{
  "pos": 2,
  "neg": -3
}
```

## sqrt

Returns the square root. Returns `Invalid` if `number < 0`.

```edgerules
sqrt(16)
```

**output:**

```json
4
```

## clamp

Returns `min` if `n < min`, `max` if `n > max`, else `n`. Restricts to closed interval `[min, max]`.

```edgerules
{
    low: clamp(0, 1, 4)
    mid: clamp(3, 1, 4)
    high: clamp(5, 1, 4)
}
```

**output:**

```json
{
  "low": 1,
  "mid": 3,
  "high": 4
}
```

## between

Inclusive range check on both bounds — the everyday eligibility shorthand. Works on any ordered type: numbers, strings,
dates, times and datetimes.

```edgerules
{
    a: between(25, 18, 65)
    b: between(17, 18, 65)
    c: between(18, 18, 65)
    d: between(date("2026-06-12"), date("2026-01-01"), date("2026-12-31"))
}
```

**output:**

```json
{
  "a": true,
  "b": false,
  "c": true,
  "d": true
}
```

## ln

Returns the natural logarithm (base e) of a number. Inverse of `exp(n)`. Returns `Invalid` if `n <= 0`.

```edgerules
ln(2.718281828459045)
```

**output:**

```json
1
```

## log10

Returns the base-10 logarithm of a number. Common for orders of magnitude. Returns `Invalid` if `n <= 0`.

```edgerules
log10(100)
```

**output:**

```json
2
```

## exp

Returns e raised to the power of `n`. Inverse of `ln(n)`.

```edgerules
exp(1)
```

**output:**

```json
2.718281828459045
```

## pi

Returns the constant value of π (~3.14159).

```edgerules
pi()
```

**output:**

```json
3.141592653589793
```

## degrees

Converts an angle from radians to degrees.

```edgerules
degrees(pi())
```

**output:**

```json
180
```

## radians

Converts an angle from degrees to radians.

```edgerules
radians(180)
```

**output:**

```json
3.141592653589793
```

## sin

Returns the sine of an angle. Expects input in radians.

```edgerules
sin(pi() / 2)
```

**output:**

```json
1
```

## cos

Returns the cosine of an angle. Expects input in radians.

```edgerules
cos(pi())
```

**output:**

```json
-1
```

## tan

Returns the tangent of an angle. Expects input in radians. Avoid near π/2 + kπ where undefined.

```edgerules
tan(pi() / 4)
```

**output:**

```json
0.9999999956815324
```

## asin

Returns the arcsine (in radians) of a number. Input range: `[-1, 1]`.

```edgerules
asin(1)
```

**output:**

```json
1.5707963267948966
```

## acos

Returns the arccosine (in radians) of a number. Input range: `[-1, 1]`.

```edgerules
acos(-1)
```

**output:**

```json
3.141592653589793
```

## atan

Returns the arctangent (in radians) of a number.

```edgerules
atan(1)
```

**output:**

```json
0.7853981633974483
```

## atan2

Returns the angle (in radians) between the positive x-axis and the point `(x, y)`. Correctly handles all quadrants and
`x = 0` cases.

```edgerules
atan2(1, 1)
```

**output:**

```json
0.7853981633974483
```
