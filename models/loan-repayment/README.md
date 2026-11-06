# Loan Repayment Planner

Prices consumer loans and mortgages by credit score and term, and plans their monthly repayment: the payment, the
amortization schedule, the total cost and the yearly split of interest and principal.

## How a loan is priced

1. [pricingTier](model:pricingTier) selects the price tier and the rate premium from the credit score and the term.
2. [annualRate](model:annualRate) adds the premium to the base rate of 3.5%.
3. [monthlyPayment](model:monthlyPayment) is the fixed monthly annuity, rounded to cents.
4. [repaymentSchedule](model:repaymentSchedule) is the monthly amortization schedule.

A declined request has a payment of 0 and an empty schedule.

| Credit score | Term             | Tier       | Premium |
| ------------ | ---------------- | ---------- | ------- |
| 760 or more  | 15 years or less | prime      | 0.50%   |
| 760 or more  | any              | prime      | 0.75%   |
| 680 to 759   | any              | standard   | 1.50%   |
| 600 to 679   | 10 years or less | near-prime | 3.00%   |
| other        | other            | declined   | —       |

## The service

[loanRepayment](model:loanRepayment) prices a `LoanRequest` and returns the repayment:

```edgerules
sampleRequest: { amount: 25000; years: 3; creditScore: 700 }
samplePayment: loanRepayment(request: sampleRequest).payment
```

## Workbooks

- [Mortgage plan](model:mortgageBook): a 250 000 mortgage over 25 years for a prime borrower.
- [15 vs 30 years](model:termComparisonBook): the same 180 000 loan over 15 and over 30 years.
