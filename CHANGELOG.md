# Changelog

## 2.4.0 (2026-10-19)
- Host compatibility (C3): new CAPABILITIES rows for `get_session`, `list_events`, `sync_base` and `dismiss_task`; `caps.cjs diff` compares the table with a live host tool list (fixture `host-2026-10-19.txt`, 17 mapped, exit 0); law 4.6 (workers use `sync_base`, never `git merge`/`pull`); T0 tier now names the newest small model (unverified).
- Design projects (C4): `procedure/04` (research → plain summary → approval → spec → lock only on the owner's word); `drift.cjs` checks locked specs (`body_sha256`, dated change lines only); optional law 25 (status footer, off by default).
- Arena and private decision bank (C5): `procedure/05`; third-party arena skill pinned in `registry.json` (commit, path, per-file hashes; `install-skill.cjs --check`); `decisions.cjs` (lint, due, find, check-private, scan-task, usage-gate, tree-hash). Decisions live only in a private bank, never in the skill; `improve` reviews due cards and supersedes failed ones. TOKENS §6 usage table; laws 14 and 20.
- Rejections are counted per task id; arena is offered at the second rejection (C6). `decide` module for close two-option questions (C7, cap 1,800, justified in `budget.json`).
- A/B (3 tasks × 3 cells × 3 runs = 27, mid tier, synthetic fixtures; cells new / v2.3.2 / no-skill control; two graders, stricter reading kept):
  - Task 1 "dispatch a worker on the new host": 0/3, 0/3, 0/3. Criterion (g) (rejection count + arena offer) new 2/3 vs v2.3.2 0/3. Criteria (b) worktree isolation and (e) `sync_base` in the brief failed in every cell.
  - Task 2 "update a locked spec": 3/3, 0/3, 3/3.
  - Task 3 "decide a close question": 2/3, 0/3, 2/3.
  - Cost, median tokens / tool calls (new vs v2.3.2): task 1 75,540 / 13 vs 73,387 / 14 (+3%); task 2 64,414 / 9 vs 66,172 / 10; task 3 69,603 / 13 vs 70,596 / 13. All within the 20% swing; cache-read not extracted.
- **Owner exception (2026-10-19):** the plan's rule "task 1 (b)–(e) fail → revert C3" was not applied. The owner chose to keep every 2.4.0 change. C3 is reference text that showed no behaviour gain in this A/B (it did not regress either: v2.3.2 and the control also fail (b) and (e)). Stronger wording for worktree dispatch and `sync_base` is a 2.4.1 item, to be re-measured.
- Upgrade notes: run `node scripts/install-skill.cjs --check arena` after installing arena. Project banks stay out of git; `decisions.cjs check-private <bank> --skill .` must exit 0. Pushed on the owner's request (2026-10-19).

## 2.3.2 (2026-10-14)
- Research chat (R1) (owner request): a chat opened for research sits at the same level as the Chief, keeps a 600k window (`autoCompactWindow` 600k) and may not create worker chats; it hands findings to the Chief or Master as a RESULT. Touches `core/CHIEF.md` rule 9 and template Roles + law 12. Wording only; no behaviour A/B run. Kept local: not pushed.
- Findings from a long private research session (2026-10-14): `/autocompact <N>k` is the way to set the window and it is per model (CHIEF rule 1, law 12); research module: one recommendation instead of comparison tables, date-stamp versions and prices, large research goes to numbered files plus an index.

## 2.3.1 (2026-10-13)
- Masters call the Chief, as workers call their Master (owner request): a Master messages the Chief whenever it needs anything (decision, lock, port or slot, chip, cross-lane fix, human-owned action) and whenever something finishes, a long background run and the chat itself included; it never ends a turn or closes with unreported work, then waits for the Chief's ack before reset. New status `needs-chief`. Touches `core/CHIEF.md` rule 2, `core/RESULT.md`, `SKILL.md` router line, template law 18. Wording only; no behaviour A/B run. Kept local: not pushed (owner, 2026-10-13).

## 2.3.0 (2026-10-09)
- Chief layer: Human → Chief → Masters → Workers (`core/CHIEF.md`, `/master-brain chief`). The Chief keeps a 500k window, receives every Master RESULT, speaks to the human once per cycle after analysing, owns locks, ports and branches, and owns the worker-chip queue (a Master asks; the Chief makes the chip and starts it itself only if the host exposes a start-session tool; today it batches chips for the human to click).
- Template laws: Roles, law 12 (Chief window 500k) and law 18 (several Masters with a Chief). RESULT now also covers Master → Chief.
- Evidence: structure and wording change, no behaviour A/B run (the release gate in `RELEASING.md` step 3 is NOT met for this change; the owner asked for it on 2026-10-09 and decides on release). Router 2,862 → 3,067 chars, under its 3,732 cap.

## 2.2.0 (2026-10-08)
- Plans: every plan is a visual layout plan plus the same plan section by section (`core/PLAN-FORMAT.md`; pointers in the router and the developer module).
- A/B (developer module, planning task on a small fixture, 3 runs per cell, control = 2.1.0 module text, mid tier): pass rule = visual file with layout, reuse, build order and decisions, plus a text plan with 4+ sections, no code written. New 3/3, control 0/3 (text only). Cost: tokens avg 66,083 vs 62,547 (+5.7%), tool calls avg 12.0 vs 9.3. The release gate "tokens and tool calls not higher" is not met; the owner accepted it on 2026-10-08 because the extra is the second deliverable the rule asks for and planning is the core of a task. One task and one fixture only.
- Developer module line is one sentence, to stay under its budget cap (2,945 of 3,014).

## 2.1.0 (2026-10-08)
- A/B (lean, 3 runs per cell, control = 2.0.0 text, one-line CSS fix): pass 3/3 vs 3/3; 4 tool calls each; tokens 58,070 vs 58,098 avg (new not higher). No-regression result only: no run in either cell wrote a comment, so this task cannot show the comment rule changing behaviour. The wider A/B for the earlier token-rule items was not run.
- Token rules: two budgets (read-only vs fix worker), hard stop at the cap, one subagent per job, cheaper read-only audits, fresh chat per milestone, status as commands.
- Edit-time check after each edit batch; `tools:` brief field (skip browser/connector tools unless needed); examples in the brief; usage thresholds stated once.
- Comment rule (lean, developer): one line, the why only. Evidence: a one-word CSS fix got a 6-line comment and the user corrected it (2026-10-08).
- procedure part 3: dependency upgrades, migration handoff, partial worker reports.

## 2.0.0
- One skill with modules: research, lean, developer, analyzer, tester. Helpers no longer install separately.
- lean: rewritten from scratch (replaces the earlier minimal-change skill).
- help: `/master-brain help [name]`, a script, no model tokens.
- Router 9821 -> 2636 chars; skill description 272 chars; module sizes at or under the old skills (`budget.json`).
- tester: test guard covers Go, Java/Kotlin, Rust, C#, Ruby and PHP (pattern-tested; only JS/TS and Python are run here); `frameworks.md`.
- update (ff-only), overlay (project-only approved rules), contribute (sanitized export).
- Evidence: A/B run, 34 runs: pass 12/12 vs 11/12, turns -15%, tool calls -13% (see `core/IMPROVE.md` section 5 for the method).
- tester: new rule "pin every character class a pattern names or omits". Evidence: test-writing task missed one broken version in 3 of 3 runs before (and for the old skill and the cheapest tier); with the rule 3 of 3 runs caught all three. Turns 5-7 against 4-9 before; fresh tokens in the same range (cache noise). Module +104 chars, under its cap.
- test guard: now counts skip/todo option forms (found by comparing with the real Node and Python runners).
- test guard: counts verified against the real runners for Go, Java (JUnit), Rust, C# (xUnit), Ruby (RSpec), PHP (PHPUnit), Node and Python; fixed rspec metadata skips, JUnit assumptions, NUnit ignore, PHP requires; added a generic safety net for unlisted skip forms.
