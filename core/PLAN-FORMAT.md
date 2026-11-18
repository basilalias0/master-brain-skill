# Plan format

Every plan for a feature, redesign or multi-step change (Master or developer) is a text plan. Work that changes a UI
also gets a visual plan; nothing else does.

## 1. Section-by-section text (always)
Sections in a fixed order, each self-contained: goal, behaviour, data and rules (fields, permissions, edge cases),
reuse (existing components, libraries and docs first; a new library only with a stated reason), files likely touched,
build order and tests (what each phase proves, the commands), and the decisions that are the user's, each with a
recommendation. Write it to the project's plan location (a `docs/` or `specs/` part file under the line cap), not only
into chat.

## 2. Visual plan (UI work only)
One HTML Artifact (or, without an Artifact tool, a self-contained `.html` file), in the same section order: a realistic
mock of every page, dialog and state touched (empty, loading, error, full; example data marked), and numbered flow
boxes where behaviour matters. Light and dark, readable at phone width, status never by colour alone. It must agree
with the text; if they differ, fix both before presenting.

## Rules
- Verify claims against the code first (the file, component or table exists) and mark anything unverified. Cite web
  research by link.
- Present the plan (and the Artifact link, if any) with a 10-line summary. Do not build until the user approves.
- One approval covers the whole plan. Re-open a scoped question only for a new decision with no matching ACTION_LOG
  reuse signature, a business-rule ambiguity, or files or modules beyond the approved scope. Approval gates
  (`core/SAFETY.md` 12) always need a fresh yes.
