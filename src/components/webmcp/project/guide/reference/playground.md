# Playground

## Example Loan Origination

```edgerules
{
    // Structure layer: input data shape

    type Applicant: {
        owner application: <Application>
        name: <string>
        birthDate: <date>
        income: <number, min: 0>
        expense: <number, min: 0>
    }

    type Application: {
        applicationDate: <datetime>
        propertyValue: <number>
        loanAmount: <number>
        applicants: <Applicant[]>
    }

    // Facts layer: derived fields of each instance

    facts ApplicantFacts(applicant: Applicant): {
        age: calendarDiff(applicant.birthDate, applicant.application.applicationDate.date).years
        disposableIncome: applicant.income - applicant.expense
    }

    facts ApplicationFacts(application: Application): {
        loanToValue: application.loanAmount / application.propertyValue
    }

    // Knowledge layer: reusable business knowledge

    ruleset creditScorecard(age: number, income: number): {
        hitPolicy: "collect-matches"
        rules: [
            { when: { age: <= 25 }, then: { characteristic: "AGE", points: 20 } }
            { when: { age: > 25 }, then: { characteristic: "AGE", points: 30 } }
            { when: { income: >= 1500 }, then: { characteristic: "INCOME", points: 30 } }
        ]
    }

    ruleset eligibilityRules(applicant: Applicant, creditScore: number): {
        hitPolicy: "collect-matches"
        rules: [
            { when: applicant.disposableIncome <= applicant.expense, then: { reason: "INC_CHECK" } }
            { when: applicant.income <= 1000, then: { reason: "MIN_INCOM" } }
            { when: applicant.age < 18, then: { reason: "AGE_CHECK" } }
            { when: { creditScore: <= 10 }, then: { reason: "SCREDIT_S" } }
        ]
    }

    // Decisions layer: one business question per decision

    decision ApplicantCreditScore(applicant: Applicant): {
        scorecard: creditScorecard(age: applicant.age, income: applicant.income)
        score: sum(for line in scorecard return line.points)
    }

    decision ApplicantEligibility(applicant: Applicant): {
        declineReasons: for rule in eligibilityRules(applicant, applicant.ApplicantCreditScore.score) return rule.reason
        eligible: count(declineReasons) = 0
    }

    decision ApplicationApproval(application: Application): {
        loanToValueAcceptable: application.loanToValue <= 0.9
        allApplicantsEligible: all(for applicant in application.applicants return applicant.ApplicantEligibility.eligible)
        outcome: if loanToValueAcceptable and allApplicantsEligible then "APPROVE" else "DECLINE"
    }

    // Service layer: external contract

    service approveApplication(application: Application): {
        return: {
            outcome: application.ApplicationApproval.outcome
            declineReasons: for applicant in application.applicants return applicant.ApplicantEligibility.declineReasons
        }
    }

    // Example execution

    workbook example: {
        application: {
            applicationDate: datetime("2025-01-01T15:43:56")
            propertyValue: 100000
            loanAmount: 80000
            applicants: [
                {
                    name: "John Doe"
                    birthDate: date("1990-06-05")
                    income: 1100
                    expense: 600
                },
                {
                    name: "Jane Doe"
                    birthDate: date("1992-05-01")
                    income: 1500
                    expense: 300
                }
            ]
        } as Application

        creditScores: for applicant in application.applicants return applicant.ApplicantCreditScore
        eligibility: for applicant in application.applicants return applicant.ApplicantEligibility
        approval: application.ApplicationApproval
        response: approveApplication(application)
    }
}
```

**output:**

```json
{
  "example": {
    "application": {
      "applicationDate": "2025-01-01T15:43:56",
      "propertyValue": 100000,
      "loanAmount": 80000,
      "applicants": [
        {
          "name": "John Doe",
          "birthDate": "1990-06-05",
          "income": 1100,
          "expense": 600,
          "age": 34,
          "disposableIncome": 500
        },
        {
          "name": "Jane Doe",
          "birthDate": "1992-05-01",
          "income": 1500,
          "expense": 300,
          "age": 32,
          "disposableIncome": 1200
        }
      ],
      "loanToValue": 0.8
    },
    "creditScores": [
      {
        "scorecard": [
          {
            "characteristic": "AGE",
            "points": 30
          }
        ],
        "score": 30
      },
      {
        "scorecard": [
          {
            "characteristic": "AGE",
            "points": 30
          },
          {
            "characteristic": "INCOME",
            "points": 30
          }
        ],
        "score": 60
      }
    ],
    "eligibility": [
      {
        "declineReasons": ["INC_CHECK"],
        "eligible": false
      },
      {
        "declineReasons": [],
        "eligible": true
      }
    ],
    "approval": {
      "loanToValueAcceptable": true,
      "allApplicantsEligible": false,
      "outcome": "DECLINE"
    },
    "response": {
      "outcome": "DECLINE",
      "declineReasons": [["INC_CHECK"], []]
    }
  }
}
```

## `get("ApplicationApproval", ["decision-interface"])` returns the decision interface

A modeler GUI reads the decision context in `context` and the requirements in `requires`.

```typescript
service.get('ApplicationApproval', ['decision-interface']);
```

**output:**

```json
{
  "@kind": "decision-interface",
  "context": {
    "application": "Application"
  },
  "return": {
    "@kind": "type",
    "fields": {
      "loanToValueAcceptable": "boolean",
      "allApplicantsEligible": "boolean",
      "outcome": "string"
    }
  },
  "requires": {
    "inputs": ["Application"],
    "decisions": ["ApplicantEligibility"]
  },
  "linked": true
}
```
