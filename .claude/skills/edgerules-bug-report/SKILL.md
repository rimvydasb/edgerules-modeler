---
name: edgerules-bug-report
description:
  File a GitHub issue in rimvydasb/edgerules for a defect in the EdgeRules WASM engine, DSL or API (not edgerules-react
  code).
---

# Submit an EdgeRules engine bug

Target repository: **https://github.com/rimvydasb/edgerules** (`gh` CLI, `-R rimvydasb/edgerules`).

Only engine defects go there. A bug in this repo's React/TypeScript code is fixed here, not reported.

## 1. Prove it is an engine bug

The issue must reproduce **without edgerules-react**. Do all of the following before drafting anything:

1. **Use the latest engine.** Check `npm view @edgerules/node versions --json | tail -5` (and
   https://www.npmjs.com/package/@edgerules/web?activeTab=versions). If `package.json` pins an older version, reproduce
   on the latest one too (install it in the scratchpad, not in this project). A bug that is already fixed upstream is
   not reported — suggest the `edgerules-wasm-upgrade` command instead.
2. **Write a minimal throwaway Node script** in the scratchpad that imports `@edgerules/node` directly
   (`MutableDecisionService` comes from the `@edgerules/node/mutable` subpath; the package is ESM, so use `.mjs`) — no
   React, no mocks, no project code. Smallest model and fewest calls that still show the defect. Run it and keep the
   exact output.
3. **Check it is not by design.** Read the contract in the sibling repo before calling it a bug:
   - `../edgerules/docs/architecture/` — `*-spec.md` is authoritative (`api-spec.md`, `crud-spec.md`, `dsl/`,
     `ebnf.md`). `docs/stories/*-story.md` may be stale.
   - `../edgerules/tests/wasm/` — CI-run usage examples; if a test asserts the behaviour, it is intended.
   - `../edgerules/docs/reference/` — end-user language reference.
   - `docs/engine-bug-reports.md` — `[NOT A BUG]` entries are closed questions; do not re-file them.

   If the spec is silent or ambiguous, say so in the issue rather than claiming a violation.

If any step shows the problem is in edgerules-react, stop and fix it here instead.

## 2. Check for duplicates

```bash
gh issue list -R rimvydasb/edgerules --state all --search "<key words>" --limit 20
```

Also search `docs/engine-bug-reports.md`. If an open issue already covers it, add a comment with the new reproduction
and version (`gh issue comment <n> -R rimvydasb/edgerules --body-file …`) instead of opening a new one — after the user
confirms (step 4).

## 3. Draft the issue

Title: short and factual, naming the API or DSL feature — e.g.
`set('*', …) drops @model-version on an existing service`. No `[bug]` prefixes; the `bug` label covers that.

Write the body to a scratchpad file (`issue.md`) using this template:

````markdown
## What is wrong

<One or two sentences: what the engine does.>

## Reproduction

`@edgerules/node` `<version>` (also `@edgerules/web` `<version>` if checked), Node `<node -v>`

```ts
<minimal self-contained script>
```

Actual output:

```
<exact output, trimmed to the relevant part>
```

## Expected behaviour

<What should happen, with a link/quote to the spec section (`docs/architecture/api-spec.md` "…") or the `tests/wasm/…`
example that shows the intended behaviour. If the spec is silent, say so.>

## Impact

<One or two sentences: what edgerules-react cannot do because of this, and any workaround in use.>
````

Rules: the script must run as-is on a clean install of the named version; no edgerules-react imports, file paths or
component names in the reproduction; no secrets or local absolute paths.

## 4. Confirm, then submit

Creating an issue is outward-facing. Show the user the title and body and ask for confirmation, unless the user already
told you to submit without asking. Then:

```bash
gh issue create -R rimvydasb/edgerules --title "<title>" --body-file <scratchpad>/issue.md --label bug
```

Use `--label enhancement` instead when it is a missing capability rather than wrong behaviour (e.g. "no structured
built-in catalog").

## 5. Record it locally

Add or update the entry in `docs/engine-bug-reports.md` (format and labels are described at the top of that file) and
put the issue link in it: `**Issue:** https://github.com/rimvydasb/edgerules/issues/<n>`. If code here works around the
bug, leave a comment at the workaround that links to the issue, so the `edgerules-wasm-upgrade` command can find and
remove it once fixed.

Report the issue URL to the user.
