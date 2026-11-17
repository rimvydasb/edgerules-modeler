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

## [VALID] An `owner` field cannot be declared in the Boxed view

**What the user sees:** the field menu of a type offers Convert to context, relation or list, Duplicate and Delete. The
name cell rejects `owner application` ("Names must start with a letter and contain only letters, numbers, or
underscores") and no menu marks a field as `owner`. The Boxed view only shows `<Application, owner: true>` for a field
that already exists.

**Expected behaviour:** a field has a way to become an `owner` field (a toggle in its menu, or in the type cell).

**Workaround:** write the field in the Code view of the type. The engine needs the parent to hold the child first
(E356), so `Application.applicants: <Applicant[]>` comes before `owner application: <Application>`.

## [VALID] A decision cannot be created in the GUI

**What the user sees:** the Project Explorer has a DECISIONS section with no Add button, no menu of the Boxed view turns
a function into a decision, and `Add to Methods` offers only Function and Ruleset. A function cannot read another
decision (E355), so a model with decisions cannot be written in the Boxed view alone.

**Expected behaviour:** `Add to Decisions`, or a "Convert to decision" item in the function menu.

**Workaround:** in the Code view of a function, change `func` to `decision`; the entry moves to DECISIONS after a short
debounce. The conversion fails with E354 ("cannot declare a 'return'") while the body is only `result: 0` (the Code view
shows `func name(arg): 0`): add a first field before converting. `result: 0` is deletable once there is another field.

## [VALID] A rejected cell edit keeps its error after the cause is gone

**What the user sees:** an edit the engine rejects (E307, E355, E308) leaves the cell editor open, red, with the error.
Deleting the other rules or switching the hit policy fixes the cause, but the error and the open cell stay until Escape.
The Boxed view also shows the rejected value (`"AGE"`) in the cell while the model keeps the old one.

**Expected behaviour:** the error is re-checked when the model changes, or Enter on a rejected cell reverts it.

**Workaround:** Escape cancels the cell and the model is as it was.

## [VALID] The Code view keeps an unapplied draft and its old error after the cause is fixed

**What the user sees:** a type is written in the Code view with an `owner` line the engine rejects (E356, "The code is
not applied"). After the user fixes the cause in another type and comes back, the Code view still shows the draft and
the old E356 banner, while the Boxed view has no owner field. Nothing applies the draft again; any edit does.

**Expected behaviour:** the draft is applied again when the model changes, or the Code view shows the model, not the
draft, with a note that a draft was discarded.

## [VALID] An action column of a decision table cannot change its type with more than one rule

**What the user sees:** a new ruleset has `result: 0` in its rules and `default`; a new action column holds `""`. The
action headers show no type and their menu has Move left and Move right only (a condition header has "to string", "to
number", …). Typing `"AGE"` over `0` in one rule is rejected (E307, "rule results disagree on field …") because the
other rules and the default still hold the number. Every single-cell edit is rejected, so the action values cannot
become strings.

**Expected behaviour:** an action column has a type menu like a condition column, and the change retypes every rule and
the default.

**Workaround:** a ruleset with one rule is consistent with itself: add one rule, choose the hit policy `collect-matches`
(it drops the default), edit the rule, then add the other rules (a new rule copies the actions of the first one).

## [VALID] Choosing `collect-matches` on a ruleset without rules fails with E308

**What the user sees:** `collect-matches` removes the `default` row. A new ruleset has no rules, so the change leaves
nothing and the engine answers "ruleset has no rules and no 'default'". The user did not remove anything, and the error
does not say that the default row is dropped by the choice.

**Expected behaviour:** keep the default while there are no rules, or say in the error that `collect-matches` has no
default.

**Workaround:** add a rule first.

## [VALID] A type mismatch error prints the whole structure of the expected type

**What the user sees:** an expression typed in the condition cell of an `Applicant` column is a unary test of the column
value. Writing a boolean there gives `type mismatch in node NodeId(110): expected {application: {applicants: …` and the
whole nested structure of `Applicant`, then `found boolean`.

**Expected behaviour:** the type name and the cell: "expected Applicant, found boolean". The way out is the rule menu
item "Switch to expression condition", which the message does not mention.

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

## [VALID] A node dropped on the canvas covers the pins of the node under it

**What the user sees:** an Output dropped near the call node of a workbook covers its RESULTS pins; the pin
`declineReasons` could not be reached to draw a wire. The new node also selects, and the split panel opens over half of
the canvas.

**Workaround:** "Arrange nodes" lays the canvas out again; the split toggle closes the panel.

## [VALID] The error of a value input of a workbook is drawn over its text field

**What the user sees:** a value input that gets `"rich"` for a number shows the error in a line under the field, in
small red letters that run over the border of the field and are cut off ("… argument 'income' expe"). The text of the
engine is in the alert; the node shows a part of it.

**Expected behaviour:** the error has its own line below the field, wrapped, or a tooltip.

## [VALID] A service body cannot be a `return:` object in the Boxed view

**What the user sees:** the only row of a new service, `result`, offers Duplicate only; "Convert to context" appears
after the service has another field. The playground writes `return: { outcome: …, declineReasons: … }`.

**Workaround:** the two fields are members of the service body, without `return`. The service returns the same object;
the e2e flow compares the workbook output with the documented one.

## [VALID] "Duplicate" of an assertion row copies the expected value into the cases that have no such row

**What the user sees:** case 1 of a ruleset has one result row, case 2 has two. Duplicating `[0].points` adds
`[1].points` with the expected value of case 1 in case 1, which has no `[1]`: both cells are flagged as a mismatch until
the user clears them.

**Expected behaviour:** the duplicate copies the expected value into the column of the row the user duplicated from, or
leaves the other cells empty.
