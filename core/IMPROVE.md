# Improvement loop

Nothing here learns by itself. The skill improves only through evidence you approve, one change at a time.

## 1. Record (every task, no model tokens)
When a task finishes, Master appends one line:
`node scripts/route-log.cjs append --log <master_dir>/routing-log.jsonl --task <type> --start T1 [--final T2] --result pass|fail --tokens N --rework yes|no --correction yes|no --note "short"`
- `task` is a key from the routing table (lookup, plan, bugfix, build ...). `start` is the tier first tried; `final` the tier that finished it.
- `rework` = the worker came back needing the Master or the merge went red. `correction` = the user corrected Master.
- A real mistake that happened twice: `node scripts/failure-case.cjs add --dir <master_dir>/improve/cases ...` writes a case card to become a regression test.

## 2. Review (every ~10 tasks, on a new model release, or when you ask: `/master-brain improve`)
`node scripts/route-stats.cjs report <master_dir>/routing-log.jsonl --default <task=Tier,...from MODELS.md> --write <master_dir>/improve/proposals`
- Proposals appear only with at least 8 samples per task. Fewer: it says "still collecting".
- Rules: lower a default when a cheaper tier passes first try at 90% or better; raise it when the default passes under 70%; flag a brief when rework is over 30%; flag a rule when corrections are over 20%.
- Each proposal has a type: **routing** (a MODELS.md row), **local-rule** (an overlay rule for this project) or **generic** (also worth contributing). The run writes `improve/last-run.json`; `state.cjs` nudges once 10 or more tasks are logged after it.
- Master shows the proposals and the evidence. It never applies them.

## 3. Decide and apply (one change at a time)
1. You approve or reject each proposal. Master sets its status line to approved or rejected.
2. Apply one approved change by type: routing = a `MODELS.md` row; local-rule = `overlay.cjs add` (one line of rule, one of evidence); generic = overlay it, then offer `overlay.cjs export` so the user can send it (see `core/UPDATE.md`). Skill text itself changes only in the maintainer's repo.
3. Run `node scripts/verify.cjs <skill dir>` and the A/B harness on the affected tasks.
4. Keep it only if quality holds and tokens do not rise. Otherwise revert (every release has a git tag).
5. Note the change in ACTION_LOG. Maintainers also bump `VERSION`, add a `CHANGELOG.md` entry and follow `RELEASING.md`.

## 4. Fix at the strongest layer
A script or test that enforces a rule beats a written law, which beats skill prose. A mistake that recurs moves up a layer. A new rule must replace or merge an older one so the skill does not grow without bound.

## 5. Measuring (lessons from the first A/B run)
- Exact token use per subagent is in its transcript (`<session>/subagents/*.jsonl`, `usage` on each assistant message); the Agent result also shows `subagent_tokens`.
- A subagent's answer arrives in a hand-back tool call, not a text block: grade that text, or the grader reads the wrong message.
- Run a control (same prompt, no skill) every time. Fresh-token totals swung 20% on identical prompts because the prompt cache was warm or cold; compare turns, tool calls and cache-read as well.
- Each subagent costs 55-160k tokens just to start, so a small skill edit is invisible in totals. Judge skill text by turns and quality; judge boot changes by tokens.
- A pass rule must not depend on a fixture's deliberately red test. Use at least 3 runs per cell before claiming a saving.

## 6. Limits
Small samples mislead (hence the minimum). A new model invalidates old statistics: re-run the ladder. Case cards need a hidden test before they count as regression tests. The user stays the decision maker.
