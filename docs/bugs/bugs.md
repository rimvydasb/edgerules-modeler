# Bugs

- The tests grid offers applicants[0].application as an input row. It's a computed back-reference (owner application) in the Loan Origination model, not an input.
- With the split view on, selecting a node near the right edge pushes it off the canvas. The Flow specs use a wider window because of this.
- Workspace project cards are buttons, not real links, so middle-click and "copy link" don't work.
- When a reference breaks after a field rename, the editor's fallback renames every identifier with that name, including unrelated fields. This was already the case before my changes.
- The Storybook stories tagged fixture existed for the old e2e specs and are now unused; I left them in place.