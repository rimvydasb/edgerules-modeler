# Modeler Bug Reports

Found by `e2e/project/loan-origination-from-scratch.spec.ts`: a first-time user enters the Loan Origination model of
`docs/reference/playground.md` of the engine through the GUI, from an empty project, and makes the mistakes a newcomer
makes. Engine defects are in `engine-bug-reports.md`.

Each entry has a label:

- **[VALID]** — still open on the version of the Modeler it was found on.
- **[FIXED]** — fixed; the entry stays for the history.
- **[ENGINE]** - additional label for bugs that are related to the EdgeRules WASM engine.
- **[FEATURE]** - additional label for bugs that are classified as a features rather than modeler problem.

Entry format: a heading with the label and the problem, then **What the user sees**, **Expected behaviour** and
**Workaround** (the way the e2e flow goes on).

Result: the whole model of the playground is entered through the GUI, and its `example` workbook computes the output of
the playground (`DECLINE`, scores 30 and 60, `[["INC_CHECK"], []]`). The flow needs the Code view for three things: the
`owner` field and the `decision` keyword (the first two entries).

## [VALID] [FEATURE] An `owner` field cannot be declared in the Boxed view

**What the user sees:** the field menu of a type offers Convert to context, relation or list, Duplicate and Delete. The
name cell rejects `owner application` ("Names must start with a letter and contain only letters, numbers, or
underscores") and no menu marks a field as `owner`. The Boxed view only shows `<Application, owner: true>` for a field
that already exists.

**Expected behaviour:** a field has a way to become an `owner` field (a toggle in its menu, or in the type cell).

**Workaround:** write the field in the Code view of the type. The engine needs the parent to hold the child first
(E356), so `Application.applicants: <Applicant[]>` comes before `owner application: <Application>`.

## [VALID] [FEATURE] A decision cannot be created in the GUI

**What the user sees:** the Project Explorer has a DECISIONS section with no Add button, no menu of the Boxed view turns
a function into a decision, and `Add to Methods` offers only Function and Ruleset. A function cannot read another
decision (E355), so a model with decisions cannot be written in the Boxed view alone.

**Expected behaviour:** `Add to Decisions`, or a "Convert to decision" item in the function menu.

**Workaround:** in the Code view of a function, change `func` to `decision`; the entry moves to DECISIONS after a short
debounce. The conversion fails with E354 ("cannot declare a 'return'") while the body is only `result: 0` (the Code view
shows `func name(arg): 0`): add a first field before converting. `result: 0` is deletable once there is another field.

## [VALID] [FEATURE] An action column of a decision table cannot change its type with more than one rule

**What the user sees:** a new ruleset has `result: 0` in its rules and `default`; a new action column holds `""`. The
action headers show no type and their menu has Move left and Move right only (a condition header has "to string", "to
number", …). Typing `"AGE"` over `0` in one rule is rejected (E307, "rule results disagree on field …") because the
other rules and the default still hold the number. Every single-cell edit is rejected, so the action values cannot
become strings.

**Expected behaviour:** an action column has a type menu like a condition column, and the change retypes every rule and
the default.

**Workaround:** a ruleset with one rule is consistent with itself: add one rule, choose the hit policy `collect-matches`
(it drops the default), edit the rule, then add the other rules (a new rule copies the actions of the first one).

## [FIXED] [ENGINE] A type mismatch error prints the whole structure of the expected type

**What the user saw:** an expression typed in the condition cell of an `Applicant` column is a unary test of the column
value. Writing a boolean there gave `type mismatch in node NodeId(110): expected {application: {applicants: …` and the
whole nested structure of `Applicant`, then `found boolean`.

**Fix:** engine `0.2.10-alpha.202611171702` reports E309 with the cell path and the type name
(`ruleset condition 'eligibilityRules.rules[0].when.applicant' expected Applicant, found boolean`) and says to write the
whole `when` as one boolean expression. The Modeler shows it as is.

## [FIXED] "Add argument" on a service made an untyped parameter that the engine refused, and no header showed

**What the user saw:** `Add argument` on a service wrote `arg` without a type. The engine answered E358 ("service
parameter 'arg' has no type"), the edit was rolled back, the ARGUMENTS cell stayed empty and the error banner ran off
the right edge of the window. There was no header to give the argument a type, so a service could not get a parameter in
the Boxed view at all.

**Fix:** `useRowActions.ts`: a `service` or a `decision` gets `arg: string`, which the user renames and retypes. Unit
test: `commands.test.tsx`, "Add argument on a service adds a typed argument".

## [FIXED] The Flow editor did not draw the wires between expression nodes of a workbook

**What the user saw:** in a workbook with `application`, `creditScores: for applicant in application.applicants …` and
`approval: application.ApplicationApproval`, only one wire showed (into the call). The browser console printed React
Flow error 008 ("Couldn't create edge for source handle id: out:applicants") over a hundred times, one for each render.
The wires were looked up on a pin `out:applicants` that an expression node does not have; it has `out:*` only.

**Fix:** `graph.ts`: a read of any path from an expression node leaves from its only pin. Unit test: `graph.test.ts`,
"leaves an expression node from its only pin, whatever path is read from it".

## [VALID] [FEATURE] A service body cannot be a `return:` object in the Boxed view

**What the user sees:** the only row of a new service, `result`, offers Duplicate only; "Convert to context" appears
after the service has another field. The playground writes `return: { outcome: …, declineReasons: … }`.

**Workaround:** the two fields are members of the service body, without `return`. The service returns the same object;
the e2e flow compares the workbook output with the documented one.
