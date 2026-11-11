## Annotations Story

An annotation labels a model node for the Modeler GUI. The engine stores annotations, but does not interpret them.

The Modeler GUI uses these node kinds:

| Annotation      | Node                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `@InputNode`    | A user input, also a record of terms                                     |
| `@FunctionNode` | An invocation of a `func`, `ruleset`, `loop`, `optimise`, or `service`   |
| `@ChartNode`    | A chart of a list value                                                  |
| `@OutputNode`   | A result value                                                           |

- A node kind annotation MAY have the `name` argument. Portable maps the argument to `@name`.
- `@Name("...")` sets only the GUI label of a node, for example `@Name("Main Workbook")`. Portable maps it to
  `@name` without `@node`.
- An empty label is no label: `@ChartNode(name: "")` is `@ChartNode`, and `@Name("")` is no annotation.
- A `type` declaration carries an annotation. An inline structure type does not.
- A model groups GUI nodes in a root `workbook` declaration. A model without a workbook is a workbook as a whole.

Example:

```edgerules
{
    @InputNode(name: "Applicant")
    applicant: { age: 23, income: 25000, segment: "retail" }

    @ChartNode(name: "Payment Schedule")
    schedule: [
        { month: 1, amount: 1000 },
        { month: 2, amount: 1000 },
        { month: 3, amount: 1000 }
    ]
}
```

- One `PortableNode` has at most one annotation. For this reason, Portable flattens the annotation into the node:

```typescript
export interface PortableObject {
    '@kind': string;
    '@node'?: 'InputNode' | 'FunctionNode' | 'ChartNode' | 'OutputNode' | 'TermsSet' | (string & {}); // node kind
    '@name'?: string; // GUI label; alone, it is the `@Name("...")` annotation
}
```

- The GUI does not render special fields, such as `return` in functions or `hitPolicy`, `rules`, `default` in rulesets.
  These fields have no annotation.
- Annotations have no runtime effect. The linker and the interpreter ignore them.
- A context field has at most one annotation.
- The maximum annotation identifier length and label length is 255 characters.
- The Project Explorer opens functions and rulesets. A `@FunctionNode` field invokes them on the canvas.
- The Modeler GUI validates the logical use of annotations, for example `@ChartNode` on a function. The engine
  validates only technical constraints, to prevent flooding or crashing.
- The GUI sets and gets annotations for each node through the Portable API.
- An annotation write does not trigger re-linking or re-evaluation:
  `service.set('schedule', {'@kind': 'context', '@node': 'ChartNode', '@name': 'Monthly payment'});`.
- The `@kind` of an annotation-only write MUST match the node.
- An absent annotation key keeps its value. `null` or `""` removes it.
- `service.set('Applicant', {'@kind': 'type', '@node': null, '@name': 'The Applicant'});` sets the
  `@Name("The Applicant")` annotation of a type.
- `service.set('Applicant', {'@kind': 'type', '@node': null, '@name': ''});` removes the annotation.
- The GUI removes the annotation of a node that the user deletes from the ReactFlow canvas:
  `service.remove('schedule.@ChartNode')`. `service.remove('schedule.@Name')` removes a `@Name` annotation.
- There is no rename API for annotations. In the GUI, a rename deletes the node and adds it again to ReactFlow.
- The engine and the EBNF do not name node kinds. `Name` is the only reserved annotation identifier.
- CodeMirror highlights annotations in the GUI. The Rust crates have no highlighting code.

## EdgeRules Example

```edgerules
{
    // types are managed in the EdgeRules Types Editor
    type Applicant: { age: <number>; income: <number>; segment: <string> }

    // all functions and rulesets are accessed from the Project Explorer
    // and maintained in the Code Editor or the Decision Table Editor
    ruleset risk(age: number, income: number, segment: string): {
        hitPolicy: "first-match"
        rules: [
            { when: { age: 18..25, income: < 30000, segment: "retail" }, then: { level: "high",   limit: 1000 } }
            { when: { age: 18..25, income: >= 30000 },                   then: { level: "medium", limit: 5000 } }
            { when: { segment: "premium" },                              then: { level: "low",    limit: 20000 } }
        ]
        default: { level: "none", limit: 0 }
    }

    func paymentSchedule(amount: number, period: number): {
        schedule: for x in 1..period return { month: x, payment: amount / period }
    }

    service processApplication(applicant: Applicant): {
        decision: risk(applicant.age, applicant.income, applicant.segment)
        schedule: paymentSchedule(decision.limit, if applicant.segment = "premium" then 12 else 6)
        return: { decision: decision, schedule: schedule.schedule }
    }

    @Name("Main Workbook")
    workbook main: {
        @InputNode
        applicant: { age: 23, income: 25000, segment: "retail" }

        @InputNode
        applicantRecord: {
            isAdult: applicant.age >= 18
            isHighIncome: applicant.income > 100000
            maxPeriod: if applicant.segment = "premium" then 12 else 6
        }

        @FunctionNode
        decision: risk(age: applicant.age, income: applicant.income, segment: applicant.segment)

        @OutputNode
        level: decision.level

        @ChartNode
        schedule: {
            list: paymentSchedule(decision.limit, applicantRecord.maxPeriod)
        }
    }
}
```

The host executes the workbook with `execute('main')`.
