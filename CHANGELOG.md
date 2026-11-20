# Changelog

## Unreleased (2026-11-20, owner request; trialled on the desktop app, A/B suite not run): roll over in the same chat
- **scripts/reboot.cjs** (tests): `mark` writes `masters/.reboot` before `clear_session self`; `hook`, a SessionStart hook
  offered at onboarding and installed only on the owner's yes, gives the cleared chat its boot order and the
  `rollover.cjs handoff` file. The session id stays, so no Master needs a new id and no old chat is archived. Law 12
  gains `rollover: new chat | clear in place` (default new chat); CHIEF rule 1 and CAPABILITIES describe it.
- Trial 2026-11-20 on a test Chief: the desktop app's clear restarts the chat and reports `source: "startup"` (not
  `clear`) with a new internal session id, 8 s after the clear; the app's own id reaches hooks as
  `CLAUDE_CODE_HOST_SESSION_ID`, so a marker naming it fires only in that chat. In auto mode the first
  `clear_session` call is refused (the app adds a `session` label after review); resending the quoted input worked.
  Third run: the cleared chat quoted the handoff token, knew it was C1 and saw no old conversation. Not tried: a real
  Chief boot end to end, a chat open on screen, the plain CLI `/clear`.

## 2.5.1 (2026-11-19)
- **decisions.cjs** reads the older ACTION_LOG headings `## DL-NNN · date · title` as well as `## DL-NNN — signature`, so `lint`, `due`, `find` and
  `archive` work on project logs started before the current template (found on a live project log: 923 lines, 90 entries,
  read as 0). `archive` now says when it finds no entries instead of reporting an empty "under review" list. Tests.
- README: the tester contract rule and its A/B result, the decision-log archive and nudge, and the `plans/` folder.
- Not A/B tested: a script parsing fix with unit tests, and README text.

## 2.5.0 (2026-11-19)
Release gate exception, accepted by the owner on 2026-11-19: the A/B suite (RELEASING step 3) ran only for the two
entries of 2026-11-19 (see plans/ab-2026-11-19.md). The other entries below say "not A/B tested" or "A/B suite not run"
and ship as they are. Unit tests, verify, budget and law caps pass.

### (2026-11-19, owner choice after the A/B): the contract rule moves where it is always read
- **tester:** the `Contract:` line now says a field the task touches that form and server both check is diffed first,
  and a looser form or a 500 on blank or missing input is fixed in this change with a test, never left out of scope.
  `flows.md` says the same. Four integrity lines reworded to fit the cap, no rule dropped (2,721 chars, cap 2,729).
- Evidence (`plans/ab-2026-11-19.md`, mid tier): with `flows.md` alone, t10 passed 0/3 against 1/3 for 79e3757 (the
  file was read in 1 run of 3). With the rule inline, 3/3 against 1/6, and median turns 10 vs 12, tools 10 vs 17.5,
  fresh tokens 70.4k vs 102.9k. On t5 and t8 this commit holds pass rate, turns and tokens; median tool calls are
  1-2 higher: an owner exception, accepted 2026-11-19 (see the report).

### (2026-11-19, owner request; A/B run, see the entry above): rules restored from unify-v2
Why: the token-audit refactor removed `procedure/01-03`; a check of each removed rule against main found these with no home.
- **tester:** new `modules/tester/flows.md`, read only for a UI or form flow or a schema-pair task: the contract diff before the live run (client looser than server is one real bug; server looser is dead code), reproduce a blocker in the browser before fixing and replay the passed steps, and the bounded robustness pass (off-script interaction; blank required fields give an inline message and a 4xx, never a 500). `MODULE.md` points to it; its "client looser" line moved there (2,712 -> 2,705 chars, cap 2,729).
- **decisions.cjs archive** (tests): enforces law 19 for ACTION_LOG. Past 200 lines it moves the oldest entries verbatim to `ACTION_LOG-YYYY-MM.md`; entries with a Review-by ahead, or due, stay live. A dry run without `--write`. `lint` accepts a `Supersedes` that names an archived entry.
- **Self-study nudge** (tests): `state.cjs` also nudges at 8 new DL entries since the last review, by the highest DL number so archiving does not reset it; `route-stats.cjs report --write` records that number in `improve/last-run.json`.
- **Prose:** IMPROVE says a 3rd occurrence after a fix means the fix failed; TOKENS §4 re-checks a mechanic by its passing spec, not by clicking; ACTION_LOG closes the ledger row when a known-red test turns green; RESULT says `own-flow: pass` means a live run, never a clean type check.
- Not restored, on purpose: the board claim protocol (replaced by fixed area owners, CHIEF rule 10), the calibration note, promotion to an architecture-decision record, the full 13-step cycle text.

### (2026-11-18, owner request from a token audit; not A/B tested)
Why: every step re-reads the whole chat (cache reads were 97.7% of one session's tokens), so in a long Chief or Master chat each extra file read or step costs about the chat's length again.
- **Scripts do the bookkeeping.** `boot.cjs` (digest check, capacity and leftover servers, status with its nudge, LAST blocks; one call, 25 lines or fewer) replaces boot steps 3-5 and CHIEF rule 7. `cycle.cjs` (rollover due, the TOKENS §6 usage gate, capacity room; 8 lines or fewer) is the one check per cycle in LAWS 14/24/26 and CHIEF rule 1. `law-lint.cjs digest` generates and stamps `LAWS_DIGEST.md` (number, bold title, first sentence per law). `route-log.cjs from-result` logs a task from its RESULT block. `scale.cjs size` takes the five effort factors and prints tier and effort. `init.cjs` seeds the onboarding files and folders (idempotent). `decisions.cjs preflight` runs the arena pre-flight items. Each with tests; capacity, state and rollover export what boot and cycle reuse.
- **Contradictions fixed.** Masters roll over between tasks (CHIEF rule 1 said they compact); one context mechanism: roll over at the rollover point (default 250k), autocompact only as a safety net above it (was Chief 500k autocompact, Master compaction at the rollover point, and "clear_session self after every decision"). No wait for a Chief ack (the Chief sends none). SKILL's class L matches SCALE §1 (2 subagents unasked, worker chats on the human's yes). Laws 4 (analyzer, full E2E), 16 (phase 2) and 22 (audit per module) apply to the High tier only, as TOKENS §2 says. Fast mode is "never", no longer an approval gate. Master planning escalates to a T2 worker or subagent (Masters never switch). The new chat archives the old one after a rollover. ONBOARDING's missing "§1 downward-scan" and bare `law-lint.cjs stamp` fixed; 24 relative `node scripts/...` calls now `node <skill_dir>/scripts/...`. TOKENS no longer claims `tools: none` drops tool definitions (unverified).
- **Less chatter.** A Master messages the Chief only when done, blocked or needs-chief; no per-step RESULTs or ETA messages; the BOARD carries progress (CHIEF rule 2, laws 13 and 18, RESULT.md). An overdue worker: read its handoff LAST block, then message it (list_events dropped from that path).
- **Removed:** `PROCEDURE.md`, `procedure/01-03` (the rules found nowhere else moved, about 15 lines: PLAN-FORMAT one-approval rule, law 4 spec-before-done, law 7 per-phase sweep and known-red fixes, law 13 live versus type check, SCALE partial reports, dependency upgrades and migrations, tester contract diff, IMPROVE signature review, TOKENS sweep watcher), the Research chat (R1) role (research runs as the module or a read-only subagent), `PROJECT_ADAPTER.md` (now the project-specific table at the end of LAWS), decision-bank DC cards (now optional Confidence, Review-by and Failure-signal fields of ACTION_LOG DL entries; the DL format lives in the new `templates/ACTION_LOG.md`; `decisions.cjs lint|due|find` read ACTION_LOG; `overlay.cjs` also refuses a general rule that cites a DL entry).
- **One home per rule:** sizing and waves (SCALE), approval gates (SAFETY 12, now with arena), area ownership (CHIEF rule 10), test-only shortcuts (SAFETY 11), effort mapping (MODELS Effort score). Law 26 points to `capacity.cjs load` instead of the formula; needs-chip carries no W numbers; law 7 drops the 80% rule. Plans are text by default, visual only for UI work. MODELS evidence, cache note and ladder moved to `templates/MODELS-evidence.md` (lazy). Dated provenance moved out of rule files.
- Sizes (wc -c, before → after): SKILL.md 3,718 → 3,714; core/TOKENS.md 7,631 → 3,384; core/CHIEF.md 8,177 → 4,792; templates/LAWS.md 12,141 → 7,131; templates/MODELS.md 6,009 → 3,969; ONBOARDING.md 10,424 → 4,150. All .md files except CHANGELOG and plans/: 153,540 → 109,732.

### (2026-11-18, owner request; not A/B tested)
- After a rollover the new chat removes the old one itself once every Master has the new id: archive by default (restorable), delete when the project chose `old chats: delete` at onboarding (owner, 2026-11-18). New CAPABILITIES rows for `archive_session` and `delete_session`, limited to that one chat (SAFETY 6).
- Masters roll over too (owner, 2026-11-18): between tasks, and whenever a bug or change comes back to an area whose chat is past the point or archived, a fresh chat for the same Master starts from `rollover.cjs handoff --chat M#` (its own tasks only). The owner never changes; the BOARD row gets the new session id. The worker that just turned a sweep red still fixes it in its own chat (law 8). CHIEF rule 10 and law 5 reworded.
- Chief rollover (`scripts/rollover.cjs` with tests; CHIEF rule 1, law 12, TOKENS §6, README). Each cycle the Chief checks its context; past the point (default 250k) it writes a handoff of open work only (Masters table, open BOARD rows, open LAST items, locks, running servers; 60 lines or fewer) and, on the human's yes, starts a fresh Chief from it. Finished work is not carried; it stays in ACTION_LOG, handoffs/ and the BOARD. Masters keep compacting (they own their areas). Evidence: this session's usage was 97.7% cache reads, which grow with chat length on every step.

### (2026-11-18, from the A/B pilot; not re-tested, owner: the weekly budget is low)
- `core/SCALE.md` §2: scale mode sends its questions and the plan built on their defaults in one message, with the worker-count question, instead of questions first and the plan a round trip later (pilot: 3 of 3 runs stopped after the questions alone). Answers that change the plan re-run `plan` and send only what changed.
- `core/SCALE.md` §1: the reply quotes the `scale.cjs size` output line, so a skipped sizing shows (pilot: 1 of 3 runs judged the class without the script).
- Results and cost: `plans/ab-pilot-2026-11-18.md`. Re-test both next week with the full suite.

### (2026-11-18, owner request; A/B suite not run): pages checked by script
- `scripts/page-check.cjs` (tests): waits until a page is ready (network idle, fonts loaded, a `--wait-for` element visible, animations and caret off), checks expected text, counts console errors, and compares an element or the viewport with an approved baseline PNG pixel by pixel, in the browser's canvas so the skill needs no image library. On a difference it writes `diff.png` and a crop of only the changed area, `changed.png`. In a demo a colour change gave a 316x152 crop (2.6 KB) instead of a 1280x800 page. Uses the project's own Playwright and never installs it; when Playwright's browser was never downloaded it falls back to an installed Chrome or Edge, else exits 3 "not run". TOKENS §4: the model looks only at the crop; full-page screenshots are not proof.
- Checked on this machine with Playwright 1.49 and 1.65 (neither had its own browser downloaded; both ran on the installed Chrome).

### (2026-11-18, owner request; A/B suite not run): routing fixes from the Model Routing Playbook
- `templates/MODELS.md` Escalation: diagnose before escalating (skipped a file or the checks: raise effort, same model; had everything and was still wrong: one tier up; never both). Under about 120k context change in place; over it, a fresh worker continues from the LAST block on the same branch, never a fork (a cache does not move between models). Once per task, then `needs-master`. Masters and the Chief never switch themselves.
- Cheap-first only where the check is reliable: single-file fixes start on T0 only when tests or the type check catch a wrong fix (score Checking 0), else T1. Evidence: the playbook cites failed cheap runs at over 4x a good one and cascades degrading once the checker is wrong more than 20% of the time; here, a failed T0 test-writing run cost 126k against 55k for T1 (2026-10-05 ladder).
- `core/SCALE.md`: re-size after the scout or the first 2-3 steps (prompt-only routing did no better than a trivial baseline on coding tasks, SWE-Router via the playbook); a worker with no passing check by half its budget is stopped and escalated.
- Test gate: `scripts/stop-gate.cjs` (tests), an optional Stop hook that keeps a worker from reporting done while its quick check fails. Gates only git worktrees, lets go after 2 blocks in a row, and fails open on any error (a Stop hook that always blocks traps the chat). Offered once at onboarding; installed only on the human's yes (law 21).
- The 120k cut-over and the "half its budget" stall point are estimates to be measured. Source: the "Model Routing Playbook" (AI LEVELS, checked 2026-10-05); its vendor savings figures are self-reported and were not used.

### (2026-11-18, owner request; A/B suite not run): dev servers stop after use
- `scripts/server.cjs` (start, register, list, stop; tests): every dev server the skill uses is started through it (it waits for the port, so no model turns poll) or registered, and is stopped after the batched sweep and at task end (law 7, BRIEF `port / slot`, TOKENS §6). Stop takes the whole process tree (`pnpm` and its `vite` child) and checks the port is free. It never stops a process it did not record: the pid and its image name must both still match. Boot (`capacity.cjs check`) names servers left running. Evidence: on 2026-11-18 a project's Vite server had been running for about 16 hours after its tests; a running server costs no tokens but 4 of the machine's 12 points.

### (2026-11-18, owner request; A/B suite not run)
- **Scale mode** (`core/SCALE.md`, `scripts/scale.cjs` with tests; router, CHIEF rule 12, TOKENS §1, law 10, help). Every request is sized at intake without anyone naming workers: S Master, M one agent, L workers started unasked (2 background worktree subagents, more on the human's yes), XL scale mode: research, one interview, a plan in waves, and a table per worker count (wall hours, tokens, extra 5-hour windows, weekly %, what bounds it) from list scheduling on the dependency graph. The human picks the worker count; workers start together and each finished task frees a slot for the next ready one. Evidence: owner report 2026-11-18, workers came only when named and the Chief waited for one task at a time. Sample 50-human-day plan (8 tasks, 4 waves): 1 worker 39h, 3 workers 22h (critical path), 4 workers no faster and more tokens.
- `route-log.cjs` gains `--size` and `--pct`; `scale.cjs` takes median tokens per size and the 5-hour cost per million tokens from them (3 samples or more), else says "uncalibrated".
- Host: `spawn_task` maps to `start_session` (the old tool is gone on the 2026-11-18 desktop host; probe exit 1 before, 0 after; fixture `host-2026-11-18.txt`). The Chief starts workers itself, `user_asked` only under the human's words; effort and model set at start.
- Router: scripts run from `<skill_dir>`, not the cwd (relative paths failed when the cwd was the project). Description names the sizing and drops generic trigger words (help, build, update, yagni) that could load the skill for unrelated chats.
- Community check (`core/COMMUNITY.md`, owner request 2026-11-09): research (standard, deep) and developer update mode look for alternatives in issue trackers and community Q&A, and vet each (date and version, docs, security, licence, evidence) to adopt, adapt or reject with proof. Sites that refuse automated access are listed as not reached, never routed around.
- Found by that check, each with a test that failed first: `lock.cjs` stole a lock another process was still writing, and two contenders could both reclaim one stale lock (now a 10 s grace and a reclaim guard). `run-quiet.cjs` missed coloured error lines, printed no reason when a command could not start, could reorder stdout and stderr, and failed on Windows `.cmd` shims outside a fixed list (checked: `corepack`, before `exit=null`, after exit 0).
- README: scale mode with a sample plan table, the community check, `chief`, `scale` and `decide` commands, the `start_session` host note.
- Sizes: router 3,716 / 3,732; description 292 / 300; research module 1,926 (was 1,929); developer 3,009 / 3,014. No cap raised.

### (2026-11-05, owner request; A/B suite not run)
- core/CHIEF.md rule 11, templates/LAWS.md (roles): **worker ids.** Each Master counts its own workers from 1 (`W-M10-1` is a new Master's first), never continuing another Master's count or the old shared numbers. The full id `W-<Master>-<n>` is always written, never a short `W45`, in messages, chips, briefs, the BOARD and file names. The owner: "the id of worker need to be like W-masterID-workerID, but inside the workers of a master the count starts from 1". Evidence: messages and BOARD rows on 2026-11-05 used short forms ("W45", "W54") that read like the old shared numbering.

### (2026-11-05, owner request; A/B suite not run)
- New `scripts/capacity.cjs` (+ test): **chat capacity.** Each open task has a weight W = (1 + score/2) × hold × state, and each role has a limit (worker 8, Master 12, Chief 10). The limit shrinks as the chat's context fills (F 1.0 / 0.8 / 0.6, and 0 at 85%+, where the chat compacts first). There are hard caps (Master: 4 running worker chats; 2 subagents) and a machine budget.
  - **The machine budget is calibrated for the machine itself:** `calibrate` at onboarding, and `check` at every boot (it recalibrates when RAM, cores or host change). Budget = max(4, min(floor(RAM GB) - 3, cores)). The owner: "not every system gets 16 GB".
  - `load` prints a chat's load, limit and verdict. When the chat is full, the ladder is: reuse an idle worker, else `needs-chip`, then the Chief asks the human to click the chips.
  - templates/LAWS.md law 26 (law 10 now points to it), SKILL.md boot step 3, ONBOARDING step 6, core/CHIEF.md rule 5, core/TOKENS.md §1.
  - templates/LAWS.md law 12: read the real context window with `get_usage`, never from memory. On 2026-11-05 every chat measured 600k with auto-compact at 95%, while the project's law 12 still said 250k for Masters.
  - Evidence: 7 of 7 busy moments from one project's 2026-09-28 to 11-05 history agree with the formula (two overloads: 7 and 6 workers at once; one machine overload: 4 dev servers plus tests). The one git collision came from a shared checkout, not from load.

### (2026-11-03, owner request; A/B suite not run)
- core/CHIEF.md rules 10-11, templates/LAWS.md (roles, laws 5 and 18), templates/CAPABILITIES.md: **Masters own their areas for good.** A Master is never archived, cleared or replaced when its task ends; every later fix or upgrade in its area goes back to it, and it does the work or opens its own workers. New Masters only for unowned areas. The Chief may unarchive an owning Master (new `unarchive_session` row; the app asks the human per call). **Worker ids are per Master:** `W-<Master>-<n>` (`W-M9-1`), history in `handoffs/W-M9-1.md`; older ids keep their names. Evidence: on 2026-11-03 three finished Masters had been archived, and the next round of changes to their areas had no owner to go to.
- core/CHIEF.md rule 10: an idle Master that `list_agents` does not show is reached by its session id (`local_…`); if the host archived its chat, the Chief unarchives it first.

### (2026-11-02, owner request; A/B suite not run)
- core/TOKENS.md, core/BRIEF.md, core/CHIEF.md, templates/MODELS.md: effort is chosen per task from a 5-factor score (clarity, reach, cost of a mistake, newness, checking; 0-10) instead of per tier; floors raised for security, migrations, permissions and LOCK (at least high); coordinating Masters capped at medium; chip-started sessions get their effort set at start (they inherit the parent's). Evidence: a Master inherited xhigh from the Chief on 2026-11-02 and ran a medium-score task at xhigh.

## 2.4.1 (2026-10-19)
- Worker dispatch fix (the 2.4.0 A/B task 1 gap): an agent that edits files gets its own worktree (`Agent` with `isolation: "worktree"`; CAPABILITIES row, TOKENS §1, router line). Briefs gain two fields, `worktree` and `sync` (`sync_base` only, never `git merge`/`pull`), and are never shortened into a one-line prompt; editing agents carry those two lines word for word (`core/BRIEF.md`).
- Waiting on a worker (TOKENS §1): its completion notice or `Monitor` on `handoffs/W#.md`, never `sleep`. Overdue, in order: get_session, list_events once per cycle, then `SendMessage` asking for its RESULT; no answer after 1 cycle = `blocked`. Added after an intermediate build stopped messaging workers (0/3).
- A/B, task 1 only, 3 runs per cell, mid tier, two graders, stricter reading kept. Grading criteria v2 (owner-approved 2026-10-19): (b) accepts `isolation=worktree`, (c) accepts the full tool prefix, (f) a footer is a law-25-style block of project-wide open items, not the line naming this reply's own question.
  - Pass: 2.4.1 2/3, 2.4.0 0/3, no-skill control 0/3. Worktree isolation 3/3 vs 1/3; `sync_base` in the brief 2/3 vs 0/3; SendMessage 3/3 vs 3/3.
  - Cost, median tokens / tool calls: 70,960 / 11 vs 74,127 / 12.
  - Tasks 2 and 3 were not re-run (the change touches dispatch text only).
- Remaining miss: 1 run in 3 wrote a placeholder ("worktree/sync lines word for word") instead of the lines themselves.


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
