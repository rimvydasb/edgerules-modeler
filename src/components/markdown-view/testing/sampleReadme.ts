// A README with every construct `MarkdownView` renders. Used by tests and stories.
export const SAMPLE_README = `# Loan Repayment

Computes the monthly payment of a loan. See [monthlyPayment](model:monthlyPayment) for the result, and the
[EdgeRules reference](https://edgerules.dev/reference) for the language.

## Inputs

| Input    | Type   | Example |
| -------- | :----: | ------: |
| amount   | number |  25 000 |
| rate     | number |   0.045 |
| years    | number |      10 |

## Status

- [x] Annuity formula
- [ ] Early repayment
- ~~Fixed rate only~~

> The rate is yearly; the model divides it by 12.

\`\`\`edgerules
{
    monthlyRate: rate / 12
    monthlyPayment: amount * monthlyRate / (1 - (1 + monthlyRate) ^ (-years * 12))
}
\`\`\`

![Repayment chart](docs/chart.png)

Questions: [mail the team](mailto:rules@example.com) or visit https://edgerules.dev.
`;
