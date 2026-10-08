# Plan format

Every plan for a feature, redesign or multi-step change (Master or developer) ships in two forms. A developer who skips the text must still be able to build from the visual.

## 1. Visual plan (required)
One HTML Artifact (or, with no Artifact tool, a single self-contained `.html` file the user can open). Tabs or sections, one per decision area. Each section holds:
- **Layout:** a realistic mock of every page, dialog and state it touches (empty, loading, error, full), with example data marked as example.
- **Flow:** the steps as numbered boxes when behaviour matters (routing, sync, login).
- **Reuse:** which existing components, libraries and docs it builds from. Reuse first; add a variant or feature to an existing component before writing a new one; a new library only with a stated reason.
- **Data and rules:** tables, fields, permissions, edge cases, in a compact table.
- **Build order and tests:** phases, what each phase proves, the commands to verify.
- **Decisions:** the questions that are the user's to answer, each with a recommendation.
Light and dark, readable at phone width, vibrant but status never by colour alone.

## 2. Section-by-section text (required)
The same plan in plain text, in the same section order as the visual, each section self-contained: goal, behaviour, data, files likely touched, tests, open questions. Write it to the project's plan location (a `docs/` or `specs/` part file under the project's line cap), not only into chat.

## Rules
- The visual and the text must agree. If they differ, fix both before presenting.
- Verify claims against the code first (file, component or table exists), and mark anything unverified.
- Research (web) is cited by link in the visual's overview section.
- Present the Artifact link plus a 10-line summary. Do not build until the user approves the plan.
