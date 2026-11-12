# MCP Report

Agent was asked for this one task:

> You will use WebMCP from document.modelContext
>
> I want to add the new channel to this project: "live"
> for me it takes 2 hours, but it is 3 times more effective than a call.
> add it.

Agent did a task in 2 minutes with this output:

```text
“Live” is now a fourth channel in the project, and all 23 tests pass.

Terms: 120 minutes and a lift of 0.75, which is 3 times the call’s 0.25. A client who prefers live gets the same ×1.5 fit bonus as the other channels.
Where it applies: the optimiser picks live as one more option per client, within the same team-time limit. It also feeds the schedule, the totals by channel and the totals by wealth tier (lives).
Limits on live: the only one is the existing 14-day cooling-off rule. I added no consent or email rules for live, and no cap like the SMS one.
One test changed: “one worker, two hours” used to give three calls, but the solver now prefers one live meeting (revenue 1338.75 vs 1060.9). I kept that test’s intent by setting it to 1.5 hours, where live doesn’t fit. I added a new case for the two-hour live result.

Per minute, live earns less than a call (0.75/120 vs 0.25/30), so the solver should only choose it when there’s spare time or a client’s propensity makes it worth the two hours. I didn’t run the 100-client workbook to see how often it is chosen, so that’s worth a look.

The README still describes three channels. The change is in the editor and not saved yet.
```

## Agent Report

## Tools called

| Group         | Tool                                                                                                            | Calls    | Used for                                                                     |
|---------------|-----------------------------------------------------------------------------------------------------------------|----------|------------------------------------------------------------------------------|
| Page (WebMCP) | `getTools`                                                                                                      | 2        | Listing the 13 tools. The first listing was truncated, so I called it again. |
|               | `get-project-overview`                                                                                          | 1        | Version, test totals                                                         |
|               | `list-model-entries`                                                                                            | 1        | Entry index (output truncated)                                               |
|               | `read-source`                                                                                                   | about 20 | Reading the 13 entries I needed                                              |
|               | `search-model`                                                                                                  | 1        | Finding references to `sms` (truncated)                                      |
|               | `edit-model`                                                                                                    | 1        | The atomic edit of 7 entries                                                 |
|               | `list-tests`                                                                                                    | 1        | Reading the failing case                                                     |
|               | `edit-tests`                                                                                                    | 1        | Updating one case and adding one                                             |
| Browser       | `javascript_tool`                                                                                               | about 35 | Everything above, plus string patching                                       |
|               | `get_page_text`                                                                                                 | 1        | First look at the page                                                       |
| Not used      | `evaluate-model`, `run-tests`, `get-language-guide`, `set-documentation`, `open-in-editor`, `undo-agent-change` | 0        |                                                                              |

## Issues I hit

| Issue                                      | Cause                                                                                                                | Cost                                                                                                                                               |
|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `executeTool` rejected my calls            | It needs the tool object from `getTools()`, not a name or a plain object. The error text was the only documentation. | 3 failed attempts                                                                                                                                  |
| Generic "failed in the extension" errors   | Page-side exceptions, such as reading an `undefined` entry, came back with no message.                               | I misread one as a content filter and wasted about 3 calls. That was my mistake. I had skipped fetching `channelTerms`.                            |
| `[BLOCKED: Cookie/query string data]`      | The output filter fires on DSL source containing `=`, `?` or `&`, and EdgeRules uses `=` for equality.               | I had to escape those characters on every read.                                                                                                    |
| Silent truncation at about 1000 characters | Both the tool output and the filter cut results.                                                                     | I read long entries in slices.                                                                                                                     |
| Results only available in a second call    | I wrapped calls in an async function and stored the result in `window`.                                              | Two round trips for every read. I never retried top-level `await` after fixing the `executeTool` call, so some of these were probably unnecessary. |
| Version numbers jumped from 6 to 14 to 90  | Unclear. `edit-tests` also didn't need `baseVersion`.                                                                | I couldn't tell what the numbers mean.                                                                                                             |

## Most complex part

The `edit-model` change. Adding one channel meant 7 entries and about 20 coordinated changes:

- the `contactMix` optimiser: signature, a new variable, the objective, three constraints
- the `contactPlan` named arguments
- the `clientRecord` and `clientAction` shapes
- a new rule in each of the two decision tables

`edit-model` can only replace a whole entry, so I read the full source, patched it with string replacement inside the
page, checked a "missed replacements" list, and sent everything as one atomic set. I did it that way because retyping
the entries from truncated output would have corrupted them. The regression result then caught a real behaviour change:
one live meeting now beats three calls in the two-hour test.

## How I'd improve the page's tools

| Change                                                             | Why                                                                                                                                  |
|--------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Add a patch operation to `edit-model` (find/replace or line range) | This is the biggest gain. It removes read-whole, patch, write-whole, and the truncation risk with it.                                |
| Add a dry-run flag to `edit-model`                                 | I could check parse and link errors and see the test impact before committing.                                                       |
| Let `read-source` take several paths and return plain text         | It would cut about 20 calls to 1 and drop the JSON-inside-JSON escaping.                                                             |
| Add a "who references this entry" tool                             | `search-model` returns excerpts and truncates. A dependency list would show every caller of `channelTerms` or `contactMix` directly. |
| Make `executeTool` friendlier                                      | Accept a tool name, or expose `window.callTool(name, args)`. At minimum, say in the error what type is expected.                     |
| Return real errors and explicit truncation                         | Include a message, plus total size and an offset on every truncated result.                                                          |
| Let `edit-tests` copy an existing case with overrides              | I had to copy 20+ input values by hand for the new case.                                                                             |
| Let `evaluate-model` run against a dataset in the project          | I never ran the real 100-client workbook, so I can't tell you how often live gets chosen. This is the one gap in my verification.    |
| Make versioning consistent                                         | One counter, one meaning, and the same `baseVersion` rule for model and tests.                                                       |

The `=`/`?`/`&` filter on the browser side is a separate problem from the page's tools. It blocks nearly every read of
EdgeRules source, so it needs fixing there.
