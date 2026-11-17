---
name: fix-modeler-bugs
description: Fix modeler bug or all registered bugs
argument-hint: 'the bug to fix or empty of any bug'
---

# Goal

Fix the bug if user asks to fix on, or fix all bugs if user does not mention particular bug.

Bug: `$ARGUMENTS`

# Tasks

1. Find bug report in `modeler-bug-reports.md`
2. Reproduce the bug with e2e test case
3. Fix the bug. If architectural change is required, inform the user about it
4. Run e2e test case that reproduced the bug and see it passing
5. Delete the bug description from `modeler-bug-reports.md` when bug is fixed

# Notes

- If bug is related to the engine, add the bug description to `engine-bug-reports.md` and mark the modeler bug in
  `modeler-bug-reports.md` as [ENGINE]. Stop fixing that bug, because engine needs to be fixed first.
- Please be aware of bugs that require creating the feature that is new and not mentioned in any story. Stop treating it
  as a bug and add a label [FEATURE] to `modeler-bug-reports.md`. Please use common sense to separate real issue from
  the feature request.