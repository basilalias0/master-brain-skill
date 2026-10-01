# Procedure — the generic build → test → regress → log cycle

This file is deliberately generic — no project-specific file paths, module names, or
userflow logic anywhere in it. Every reference to a concrete file lives in
`PROJECT_ADAPTER.md` instead, keyed by the "generic role" names used below (e.g. *the
form-schema pair*, *the module-collision list*, *the credential-constants file*). Porting
this system to a different project means copying this file unmodified and writing a new
`PROJECT_ADAPTER.md` for that project — never editing this one to fit a specific case.

Modeled on a proven reference system (a sibling project's browser-flow tester — plain
markdown + a real Playwright/E2E suite, no special tooling, actually used across many real
tested flows with a genuine track record of caught bugs) — kept: the checklist-in-a-file
discipline, the typed reusable-blocker log, the regress-before-continuing rule, the
robustness pass. Fixed structurally: the reference's own admitted gap was that spec-
generation (step 9 below) was the step that got skipped under time pressure on most flows —
here it's a hard, non-skippable gate, not a best-effort step.

**Calibration, stated plainly:** nothing in this procedure — including the self-study pass
at the end — converges toward "100% accuracy." There is no evidence that unaided
self-reflection does that, and credible research shows it can make things *worse* without
an external verification signal. Every step here that writes to the decision log is anchored
to something externally checkable: a failing test, a type error, a real 4xx/500, a human's
explicit decision. The self-study pass's only claim is "does this exact mistake signature
recur a 3rd time after the fix" — track that, not a percentage nothing here can measure.

---

## Contents

Split verbatim 2026-10-01 to keep every file ≤200 lines (LAWS law 19 — `master-brain/LAWS.md`). Content lives in [`procedure/`](procedure/); old "PROCEDURE.md §N" pointers resolve through this table. Edit the part, not this index.

| Section | Part |
|---|---|
| The cycle | [01-the-cycle](procedure/01-the-cycle.md) |
| Multi-phase features — the loop runs per phase, not once at the end | [01-the-cycle](procedure/01-the-cycle.md) |
| Reuse policy | [01-the-cycle](procedure/01-the-cycle.md) |
| Decision/mistake log — format | [02-decisionmistake-log-format](procedure/02-decisionmistake-log-format.md) |
| Self-study pass (periodic — never per-feature) | [02-decisionmistake-log-format](procedure/02-decisionmistake-log-format.md) |
| Cross-session coordination | [02-decisionmistake-log-format](procedure/02-decisionmistake-log-format.md) |
| Keeping lookups cheap as the log grows | [02-decisionmistake-log-format](procedure/02-decisionmistake-log-format.md) |

