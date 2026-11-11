# Finance Functions Reference

Money & business math on exact `Decimal` arithmetic — `0.1 + 0.2 = 0.3`, audits reconcile to the cent.

The time-value-of-money family follows the **numpy-financial / Excel** signatures and sign conventions: money you pay
out is negative, money you receive is positive, and rates are per-period fractions (`0.05 / 12` for 5% APR compounded
monthly). Domain errors (zero divisors, non-converging iterations) return `Invalid`, never a crash — inspect them with
`explain(...)`.

See also: `roundHalfUp`, `toFixed` and `between` in [numeric-functions-reference.md](numeric-functions-reference.md).

## percentOf

`percentOf(part, whole)` — what percent of `whole` is `part`. `Invalid` when `whole` is zero.

```edgerules
percentOf(25, 200)
```

**output:**

```json
12.5
```

## percentChange

`percentChange(old, new)` — relative change in percent. `Invalid` when `old` is zero.

```edgerules
{
    up: percentChange(80, 100)
    down: percentChange(100, 80)
}
```

**output:**

```json
{
  "up": 25,
  "down": -20
}
```

## applyPercent

`applyPercent(n, pct)` — increases (or decreases, for negative `pct`) a number by a percentage.

```edgerules
{
    surcharge: applyPercent(200, 15)
    discount: applyPercent(200, -50)
}
```

**output:**

```json
{
  "surcharge": 230,
  "discount": 100
}
```

## netToGross / grossToNet

VAT both ways; `taxRate` is a fraction (`0.21` for 21%). `grossToNet` is `Invalid` for a `-100%` tax rate.

```edgerules
{
    gross: netToGross(100, 0.21)
    net: grossToNet(121, 0.21)
}
```

**output:**

```json
{
  "gross": 121,
  "net": 100
}
```

## margin / markup

`margin(cost, price)` is `(price - cost) / price` (`Invalid` for a zero price); `markup(cost, price)` is
`(price - cost) / cost` (`Invalid` for a zero cost). Both return fractions — multiply by 100 or use `percentOf` for
percent.

```edgerules
{
    m1: margin(60, 100)
    m2: round(markup(60, 100), 4)
}
```

**output:**

```json
{
  "m1": 0.4,
  "m2": 0.6667
}
```

## pmt

`pmt(rate, nper, pv[, fv])` — per-period payment of an annuity (loan payment). Negative result = money you pay.

```edgerules
round(pmt(0.05 / 12, 360, 200000), 2)
```

**output:**

```json
-1073.64
```

## pv

`pv(rate, nper, pmt[, fv])` — present value of an annuity.

```edgerules
round(pv(0.05 / 12, 60, -200), 2)
```

**output:**

```json
10598.14
```

## fv

`fv(rate, nper, pmt[, pv])` — future value of an annuity.

```edgerules
round(fv(0.05 / 12, 120, -100), 2)
```

**output:**

```json
15528.23
```

## nper

`nper(rate, pmt, pv)` — number of periods to pay off `pv` with payment `pmt`.

```edgerules
round(nper(0.07 / 12, -150, 8000), 2)
```

**output:**

```json
64.07
```

## npv

`npv(rate, cashflows)` — net present value; the first cashflow sits at `t = 0` (numpy-financial convention; Excel's
`NPV` discounts the first argument — multiply by `1 + rate` to convert).

```edgerules
round(npv(0.08, [-1000, 300, 400, 500]), 2)
```

**output:**

```json
17.63
```

## irr

`irr(cashflows)` — internal rate of return via deterministic Newton iteration with a fixed cap; `Invalid` when it does
not converge or when the cashflows do not change sign.

```edgerules
round(irr([-1000, 300, 400, 500, 200]), 4)
```

**output:**

```json
0.1532
```

## effectiveRate

`effectiveRate(nominal, compoundsPerYear)` — effective annual rate (EAR).

```edgerules
round(effectiveRate(0.12, 12), 4)
```

**output:**

```json
0.1268
```

## amortizationSchedule

`amortizationSchedule(principal, rate, periods)` — the full repayment plan as a list of
`{ period, payment, interest, principal, balance }` records; renders straight into a GUI table. Amounts are rounded to
cents the way banks publish schedules (half-up interest, payment remainder to principal, final row settles the balance
exactly), so every row reconciles to the cent. `periods` is capped at 1200.

```edgerules
amortizationSchedule(1000, 0.01, 3)
```

**output:**

```json
[
  {"period": 1, "payment": 340.02, "interest": 10, "principal": 330.02, "balance": 669.98},
  {"period": 2, "payment": 340.02, "interest": 6.7, "principal": 333.32, "balance": 336.66},
  {"period": 3, "payment": 340.03, "interest": 3.37, "principal": 336.66, "balance": 0}
]
```
