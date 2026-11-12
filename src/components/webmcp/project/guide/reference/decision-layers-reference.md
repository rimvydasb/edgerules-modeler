# Decision Layers Reference

An EdgeRules model separates decision logic into five topology layers. Each layer has its own keyword and its own
dependency rules.

| Layer     | Declaration                           | Purpose                                   |
| --------- | ------------------------------------- | ----------------------------------------- |
| Structure | `type`                                | Input data shape and entity relationships |
| Facts     | `facts`                               | Derived fields of a structure type        |
| Decisions | `decision`                            | Policy outcomes for one context instance  |
| Knowledge | `func`, `ruleset`, `loop`, `optimise` | Reusable logic with no topology position  |
| Service   | `service`                             | External entry point and output contract  |

## `facts` extends a structure type with derived fields

A `facts` declaration adds derived fields to the structure type of its one parameter. A consumer reads a facts field
with the same path as a structure field.

```edgerules
{
    type Person: { age: <number>; income: <number> }

    facts PersonFacts(person: Person): {
        adult: person.age >= 18
        monthlyIncome: person.income / 12
    }

    person: { age: 30, income: 24000 } as Person
    adult: person.adult
    monthlyIncome: person.monthlyIncome
}
```

**output:**

```json
{
  "person": {
    "age": 30,
    "income": 24000,
    "adult": true,
    "monthlyIncome": 2000
  },
  "adult": true,
  "monthlyIncome": 2000
}
```

- The engine evaluates all facts fields of an instance when it creates the instance: at service input binding, at a
  cast, and at a `facts` or `decision` call. Facts fields are not lazy.
- Each instance stores one value for each facts field. Every read of the instance, on every path, returns that value.
- A print of an instance shows its facts fields after its structure fields.
- A facts field that fails stores a special value, for example `Invalid` for a division by zero. The instance does not
  fail.
- Service input binding rejects a facts field key or a decision name key in the input:
  `Invalid('field is computed: person.adult')`.

- The `facts` name is free, for the modeler only. It MUST be unique in its context: a `type` and a `facts` declaration
  of one name are a duplicate name.
- The `facts` declaration MUST be in the context of its `type` declaration: `E359`.
- A structure type has at most one `facts` declaration: `E360`.
- The declaration has exactly one parameter: `E350`. The parameter has a type: `E351`.
- The parameter type MUST be a record `type` declaration: `E352`.
- The body reads the instance only through the parameter. An outer value read is error `E101`.
- A `facts` body MUST NOT contain a `return` field: `E354`.
- An `external func` call in a `facts` body is an antipattern. A model SHOULD call an `external func` from a `decision`
  body.

## `decision` computes outcomes for one decision context

A `decision` declaration has one typed parameter, the decision context. `person.PersonEligibility` reads the decision
result of the `person` instance.

```edgerules
{
    type Person: { age: <number>; income: <number> }

    facts PersonFacts(person: Person): {
        adult: person.age >= 18
    }

    decision PersonEligibility(person: Person): {
        approved: person.adult and person.income > 1000
    }

    person: { age: 30, income: 2000 } as Person
    approved: person.PersonEligibility.approved
}
```

**output:**

```json
{
  "person": {
    "age": 30,
    "income": 2000,
    "adult": true
  },
  "approved": true
}
```

- A structure type MAY have any number of decisions, for example a champion and a challenger strategy.
- A read of one decision field evaluates that field and the body fields that it reads.
- Each decision field evaluates at most once for each instance. Later reads, by member path or by call, return the
  stored value. A read through an `owner` path reaches the same instance.
- An external call path in a `facts` or `decision` body starts with the instance path, for example
  `application.applicants[1].Scoring.score`. A host resolves the call of each instance separately.
- A decision that no expression reads is not evaluated.
- A print of an instance does not show its decision results.

## A layer is testable with a literal argument

A test calls a `decision` with a literal. The literal supplies facts fields as plain values, and the engine does not
evaluate the facts body for these fields.

```edgerules
{
    type Person: { age: <number>; income: <number> }

    facts PersonFacts(person: Person): {
        adult: person.age >= 18
    }

    decision PersonEligibility(person: Person): {
        approved: person.adult and person.income > 1000
    }

    approvedCase: PersonEligibility({ adult: true, income: 2000 }).approved
    minorCase: PersonEligibility({ adult: false, income: 2000 }).approved
    lowIncomeCase: PersonEligibility({ adult: true, income: 500 }).approved
}
```

**output:**

```json
{
  "approvedCase": true,
  "minorCase": false,
  "lowIncomeCase": false
}
```

- A `facts` call `PersonFacts(value)` casts `value` to `Person` and returns the instance.
- A facts field that the literal omits is computed from the literal.
- A structure field that the literal omits is `Missing`, by the typed casting rules of user types.

## Structure types are nominal

Two types with the same fields are different types. The linker resolves a facts field or a decision by the type name of
the value.

- A read of a member that the type does not have is `E103`.
- An argument of another structure type is `E115`. The message names the expected and the found type.
- An anonymous record argument is cast to the parameter type.

## The read site sets the visible members

| Read site                             | Structure fields | Facts fields | Decision results |
| ------------------------------------- | ---------------- | ------------ | ---------------- |
| `facts` body                          | Yes              | Yes          | No               |
| `decision` body                       | Yes              | Yes          | Yes              |
| `func`, `ruleset`, `loop`, `optimise` | Yes              | Yes          | No               |
| `service` body                        | Yes              | Yes          | Yes              |
| Model context                         | Yes              | Yes          | Yes              |

A read of a decision result outside the visible members is error `E355`. A call of a `decision` declaration is a read of
its result.

A facts field or a decision field that reads itself, on the same instance or on another instance of its type, is error
`E110`.

## `owner` connects a child type to its parent type

`owner application: <Application>` declares a navigation field from the child type to the parent type.

- The parent type MUST have a field of the child type or of a child list type.
- No other type MAY have a field of the child type.
- The engine builds one object graph at service input binding. Both navigation directions reach the same object.
- An `owner` field is transient. The engine does not print or serialize it.
- The parent child field is transient if the input supplies the parent inside the child. The input MUST NOT supply it.

## `service` is the external contract

A `service` is the declaration that a production host invokes. A `service` parameter MUST have a type: `E358`.

The complete loan example below computes the eligibility of an application with one or more applicants.

```edgerules
{
    // structure layer
    type CreditLine: {
        monthlyPayment: <number, min: 0>
    }

    type Applicant: {
        owner application: <Application>
        birthDate: <date>
        income: <number, min: 0>
        creditLines: <CreditLine[]>
    }

    type Application: {
        applicationDate: <date>
        applicants: <Applicant[]>
    }

    // facts layer
    facts ApplicantFacts(applicant: Applicant): {
        valid: inputValidation(applicant).isValid
        age: calendarDiff(applicant.birthDate, applicant.application.applicationDate).years
        dti: sum(for line in applicant.creditLines return line.monthlyPayment) / applicant.income
    }

    facts ApplicationFacts(application: Application): {
        applicantCount: count(application.applicants)
    }

    // decisions layer
    decision ApplicantEligibility(applicant: Applicant): {
        eligible: applicant.valid and eligibilityRuleset(applicant).isEligible
    }

    decision ApplicationEligibility(application: Application): {
        allEligible: all(for applicant in application.applicants return applicant.ApplicantEligibility.eligible)
        eligible: application.applicantCount > 0 and allEligible
    }

    // knowledge layer
    func inputValidation(applicant: Applicant): {
        isValid: applicant.income >= 0 and applicant.birthDate <= applicant.application.applicationDate
    }

    func eligibilityRuleset(applicant: Applicant): {
        isEligible: applicant.age >= 18 and applicant.dti <= 0.4
    }

    // service layer
    service applicationEligibility(application: Application): {
        return: {
            eligible: application.ApplicationEligibility.eligible
        }
    }
}
```

The host invokes `applicationEligibility` with this input:

```json
{
  "application": {
    "applicationDate": "2026-11-02",
    "applicants": [
      {"birthDate": "1990-04-12", "income": 3000, "creditLines": [{"monthlyPayment": 500}]},
      {"birthDate": "1985-01-30", "income": 5000, "creditLines": []}
    ]
  }
}
```

The service returns this result:

```json
{
  "eligible": true
}
```

- The engine fills the `application` field of each applicant from the parent `applicants` list.
- `inputValidation` reads structure fields only. The `valid` facts field calls it.
- `eligibilityRuleset` reads the facts fields `age` and `dti`. The `ApplicantEligibility` decision calls it.

## Portable JSON represents each layer with its own kind

| Declaration | `@kind`      | Parameter key | Interface `@kind`      | Position                       |
| ----------- | ------------ | ------------- | ---------------------- | ------------------------------ |
| `facts`     | `"facts"`    | `context`     | none                   | Its own key                    |
| `decision`  | `"decision"` | `context`     | `"decision-interface"` | Its own key                    |
| `service`   | `"service"`  | `parameters`  | `"service-interface"`  | Its own key                    |

- `context` has exactly one entry: the decision context parameter and its type name.
- A `facts` or `decision` node with `parameters` is invalid: `PortableError::InvalidStructure`.
- A `context` object without exactly one entry is invalid: `PortableError::InvalidStructure`.
- A `facts` node has `context` and `fields` only. It has no `body` and no `return`.
- `get("PersonFacts")` returns the `facts` node. `get("Person")` returns the `type` node, without its facts.
- `get("Person", ["facts"])` is `EntryNotFound`: `Person` is a `type` node.

### `requires` lists the decisions and the input types that a declaration reads

Each `decision` and each `service` node of the linked view has a `requires` object. `set` ignores it.

| Key         | Content                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| `inputs`    | The input type names: the context type first, then the other types by name  |
| `decisions` | The paths of the other `decision` declarations that the body reads, by name |

- A read of a structure field or a facts field of type `T` is an input requirement of `T`.
- A read of a child field through a child list field adds the child type to `inputs`.
- A read of a decision of a child type does not add the child type to `inputs`.
- A whole instance of type `T` as an `external func` argument is an input requirement of `T`.
- A read of a sibling field of the same decision is not a decision requirement.
- The `inputs` list of a `service` does not hold a parameter type that the body only passes on.

| Declaration                     | `inputs`      | `decisions`                                   |
| ------------------------------- | ------------- | --------------------------------------------- |
| `decision ApplicantCreditScore` | `Applicant`   | (none)                                        |
| `decision ApplicantEligibility` | `Applicant`   | `ApplicantCreditScore`                        |
| `decision ApplicationApproval`  | `Application` | `ApplicantEligibility`                        |
| `service approveApplication`    | `Application` | `ApplicantEligibility`, `ApplicationApproval` |

The table holds the requirements of the model in [playground.md](playground.md).

## Layer errors use the codes E350 to E360

| Code   | Condition                                                              |
| ------ | ---------------------------------------------------------------------- |
| `E350` | A `facts` or `decision` declaration does not have one parameter        |
| `E351` | A `facts` or `decision` parameter has no type                          |
| `E352` | A `facts` or `decision` parameter type is not a record `type`          |
| `E353` | A member name repeats for one structure type                           |
| `E354` | A `facts` or `decision` body has a `return` field, or is an expression |
| `E355` | A read of a decision result in a `facts` or knowledge body             |
| `E356` | The `owner` parent type has no field of the child type                 |
| `E357` | More than one type has a field of the child type                       |
| `E358` | A `service` parameter has no type                                      |
| `E359` | The `facts` declaration is not in the context of its `type`            |
| `E360` | A structure type has more than one `facts` declaration                 |
