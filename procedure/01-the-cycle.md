<!-- Part 1/2 of [PROCEDURE.md](../PROCEDURE.md) — split verbatim 2026-10-01, LAWS law 19. -->
## The cycle

**1. Intake & orient.** Read the live state snapshot + the last ~10 action-log entries (not
the whole log — see "Keeping lookups cheap" below). Classify the request against the
feature index. If it spans 2+ modules with no logical dependency and no overlap on the
module-collision list (from `PROJECT_ADAPTER.md`), flag it parallelizable and say so.
Ambiguous requirement → ask now, don't guess and don't let it surface later as a blocker.

**Present the plan once. Get one approval, covering the whole feature** — which modules/
files it touches, the build approach, which flows will get tested, whether it's split
across parallel workers. Once approved, steps 2–13 run without re-asking. Exactly three
things re-open a (scoped, not full-plan) question instead of proceeding silently:
- a blocker forces a genuinely new decision (step 6) with no matching reuse signature,
- the robustness pass surfaces a real business-rule ambiguity (step 8.3),
- the touched-file/module set would expand past what was scoped at intake — that's
  materially a different task, not a sub-step of the approved one.

**2. Register.** Create a flow record (draft, unchecked step list) + a row in the flow
index, per the project adapter's file locations. Record which form/schema pair (if any) is
involved and any context-mode axis the project adapter defines (e.g. which tenant/account/
environment the flow runs under) — this determines how step 5 authenticates.

**3. Build.** Hand off to the project's existing code-building workflow/skill — this
procedure does not reimplement building. Resume here once it reports done and the project's
own type/build gate passes clean.

&nbsp;&nbsp;**3a. Parallel-safety check** (only when an approved batch is actually running
two-plus workers at once). Two modules are safe to run in parallel only if *both* hold: no
logical dependency between them, AND disjoint touched-file sets against the module-
collision list. Modules the project adapter marks as foundational (things nearly everything
else depends on) are never included in a parallel batch — sequence them first, alone, even
if nothing else about them looks blocking. For a real parallel batch, use filesystem-level
isolation (e.g. a git worktree per worker) if the environment supports it and the skill's
own instructions are what name it explicitly (tools gated on "only when a project
instruction names X explicitly" read this file as that instruction). Confirm the approved
starting point is actually available to a fresh worktree/clone before relying on it — a
worker isolated from local uncommitted state needs the baseline pushed somewhere it can see.

**4. Schema/contract-diff check** — robustness-pass step zero, done *before* any live
interaction, not after. If the project adapter defines a client/server validation-schema
pair (or any other dual-declared contract — an API type on both ends, a shared enum
duplicated in two places), diff the two for the field(s) this feature touches, reusing
context already loaded at step 3 rather than re-reading either file fresh.
- A mismatch the schema's own comments already mark as an intentional, designed exception
  is not a finding.
- Client/frontend looser than server/backend → a real, concrete bug: the stricter side will
  reject what the looser side's own inline validation waved through, producing a confusing
  generic failure instead of a clear inline error. Report it as one bug in the shared root
  cause, not N separate per-field bugs, if the pattern repeats across fields.
- Server/backend looser than client/frontend → dead validation code on the loose side, not
  a live bug — note it, don't block on it.
- Anything else genuinely ambiguous → check the decision log for a matching reuse signature
  first (§ "Decision log" below); no match → this is a step-1-style scoped question.

**5. Execute.** Drive the real UI step by step, authenticated per the context declared at
step 2. Reuse whatever pre-authenticated/trusted-context shortcut the project adapter
defines rather than re-solving a login/step-up flow on every single run. Check off each step
in the flow record as it passes — the file, not just the chat — so a mid-flow blocker loses
nothing already proven.

**6. On blocker.** Mark the step failed, stop forward progress. Compare the symptom against
the decision log's reuse signatures.
- **Match** → apply the prior decision automatically, say so, append a one-line "Recurred:
  `<date>` (`<this flow>`)" note to that *existing* entry — do not create a new entry for a
  repeat.
- **No match** → first confirm it isn't actually a documented/designed exception before
  treating it as new. If it's genuinely new: present the real options, get a decision from
  the human, write the entry now, in the moment (format below) — never reconstructed from
  memory after the fact.
- Fix the underlying issue.
- **Regress before continuing**: replay steps 1..N already passed in this flow to confirm
  the fix didn't break them, then resume at N+1.

**7. Completion.** Mark the happy-path steps PASS in the flow record; update the flow index
+ this flow's own run-history table.

**8. Robustness pass** (the schema/contract diff from step 4 is already done — don't repeat
it here):
- **8.1 Random/out-of-order interaction** — at a few points, interact with something not in
  the script (another tab, back/forward navigation, double-activating an already-submitted
  control, opening then dismissing a modal). Confirm graceful degradation only: no crash, no
  console error, no stuck UI state, no duplicate submission.
- **8.2 Missing/partial-field submission**, per form — try submitting with required fields
  left blank. Frontend must show a real inline validation message, never a silent failure or
  crash. Backend must return a proper 4xx with a sensible message, never a 500, never a
  partial/corrupt write. Either layer wrong is a concrete, reportable bug.
- **8.3 Requirement-mismatch check** — if the backend or frontend requires a field that
  isn't clearly part of the flow's actual, real business rule, flag it and ask instead of
  assuming it's intentional.
- **This is deliberately not exhaustive combinatorial enumeration of every possible
  button/field-value combination** — that isn't tractable or standard practice anywhere, in
  an AI-assisted testing context or otherwise. This bounded pass is the real, working
  version of "test all the combinations that matter."

**9. Generate the regression spec/test — non-skippable.** Transcribe step 5's already-
proven actions + step 8's assertions into the project's real automated-test format; this
should be close to mechanical, not a rewrite, since every action in it already ran and
passed once.
- A flow's status is *manually-verified* until this step runs, *spec-generated* after. A
  feature cannot be marked done (step 13) while any of its flows still sit at
  manually-verified only — this is a hard gate, not a best-effort reminder, specifically
  because "skip it under time pressure" is the reference system's own documented failure
  mode.
- **Credential hygiene — a real flaw seen in the reference system, designed against here:**
  the generated spec must contain zero literal password/secret strings. It references the
  project's existing named credential constants/helpers only. A brand-new credential need
  becomes a named constant in the project's designated credentials location *first*; the
  spec imports it. Before finishing this step, check the generated file for any literal
  string sitting next to a password/secret/token field that isn't a constant/helper
  reference — refactor if one turns up. (A gitignored credentials file alone does not fix
  this — the boundary breaks at generation time if the generated file itself embeds the
  plaintext value, regardless of where it was sourced from.)

**10. Regression sweep.** Run the full existing regression suite. Diff results by test
name/title (not just a pass/fail count — a count can't tell you *which* test flipped)
against the project's known-red ledger:
- **Known-red, still failing** → expected. Report "N known-red, unchanged" in one line — do
  not re-derive or re-explain why each one is known-red; that's what the ledger is for.
- **Not in the ledger, and failing** → a real new regression. Handle via step 6.
- **Known-red, now unexpectedly passing** → update/close that ledger row, *and* write a
  short decision-log entry on why it started passing — an unexplained red-to-green flip can
  mask a real, separate regression as a free win.
- The sweep only counts as passing when the "new failure" bucket is empty.
- Run filtered to pass/fail-plus-title output, not the full verbose reporter — token
  efficiency, not a style preference.
- Fixing a *pre-existing* known-red entry is its own separately-approved task — never an
  automatic side effect of an otherwise-clean sweep.

**11. Report.** A short outcome summary after every flow run and every regression sweep —
what passed, what's known-red-unchanged, what's genuinely new, and which of those claims
are actually-verified-live versus merely "the build/type gate is clean" (these are different
claims — never conflate them).

**12. Log checkpoint.** An audit, not the first opportunity to write anything — entries were
already written in the moment at steps 4, 6, 8.3, and 10. Confirm nothing loggable from this
flow was missed before closing out.

**13. Close out.** Flip the feature's status in the project's real status source (per the
project adapter) from in-progress to done. Update the project's real decision/changelog doc
if this was an actual decision, not routine content — per that doc's own stated criterion.
Update the coordination board's row to done. Commit (per the project's own git conventions);
don't push unless those conventions say otherwise.

---

## Multi-phase features — the loop runs per phase, not once at the end

A feature approved as multiple phases (step 1's "one approval, covering the whole
feature") runs steps 5–10 once **per phase**, not only after the last one. Concretely,
after each phase's build (step 3) completes:

1. **Browser-check it live** (step 5) — confirm the phase's own new behavior actually
   works, not just that the type/build gate is clean. These are different claims (see
   step 11); never report the weaker one as the stronger.
2. **Turn what was just checked into a regression spec** (step 9) — this is the only
   place new coverage enters the suite. A manual check that never becomes a spec is
   lost the moment a later phase's edits touch anything nearby.
3. **Run the FULL regression suite** (step 10), not just the new spec — a phase's
   change can break something the new spec never touches, and a full sweep is the only
   way to find that.
4. **A failing test — new or existing — means an edge case wasn't mapped**, not a
   flaky test to shrug off. Handle it as a step-6 blocker: go back to the browser
   *first* (reproduce it live, understand what's actually happening — don't fix from
   the stack trace alone), fix the underlying code, update the regression spec so it
   genuinely captures the case that broke it, then **re-run the full suite again**, not
   just the one spec. Repeat this whole loop until the full sweep is clean.
5. Only a clean full sweep closes the phase. Move to the next phase from there — never
   from "the new spec passed" alone.

---

## Reuse policy

If a mechanic already has a passing spec/test, re-verifying it with a different actor or
different data is a **regression check** — run or adapt the existing spec — not a fresh
manual walkthrough. Manual UI-automation-by-reference (clicking via a live accessibility-
tree/DOM reference) has shown real flakiness in the reference system this is modeled on
(stale references after a navigation, interactions not landing focus, mixed simulated-typing
corrupting a field's value) — a generated spec's own locators don't have these problems, so
prefer them once they exist.

---

