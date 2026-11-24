# Scale: size every request, run big work in parallel waves

The home of sizing, start-all and wait-on-any: nobody has to name workers, and nobody waits for one task at a time.

## 1. Size every request (nobody has to ask for workers)
At intake, before picking a path, estimate from the code map and FEATURE_INDEX, then run
`node <skill_dir>/scripts/scale.cjs size --files N --areas N --parts N --hours H [--new] [--risk]`
(`parts` = pieces that touch disjoint files and do not wait on each other; `hours` = agent hours; add the five effort
factors, `MODELS.md`, to get tier and effort too). Quote its output line in the reply: without it the sizing was
skipped. Follow the class:

| Class | Path |
|---|---|
| S | the Master does it itself (lean). Never a worker. |
| M | one worker, no question to the human. Subagent or worker chat: `worker.cjs choose` (below). |
| L | start now, without being asked, one line to the human ("3 parts: starting 3 workers"). Each part: `worker.cjs choose`. Subagents start unasked (`Agent`, `isolation: "worktree"`, `run_in_background`); worker chats need the human's yes. |
| XL | scale mode, §2. |

**Subagent or worker chat:** `node <skill_dir>/scripts/worker.cjs choose --size S|M|L --master-ctx <tokens> [--steer]
[--outlive] [--running K] [--warm H] --log <master_dir>/routing-log.jsonl`. A worker chat only when the human must step in
(`--steer`), the work must outlive the Master (`--outlive`), the subagent cap is reached, or it costs less; near its
rollover point the Master rolls over first. Otherwise a subagent: it starts cleaner and never grows a long chat. Log
each worker with `route-log --worker sub|chat --boot <start tokens>` so the costs calibrate.

The human's words beat the class ("do it yourself", "no workers"). Risk floors (TOKENS §2, `MODELS.md`) still apply.

**Re-size after the first look.** Sizing from the request text alone is a guess. After the scout or the first 2-3 steps, run `size` again with what was found and change path
if the class moved. A worker with no passing check by half its budget stops and is escalated (`MODELS.md` Escalation).

## 2. Scale mode (XL)
1. **Research first** (`research` module, `deep` for new ground): the code, the stack, prior art, unknowns. Spend at most
   about 5% of the 5-hour window. Answer what the files answer; do not ask the human those.
2. **Questions, 6 or fewer, each with your default:** scope in and out; the finish line and how it is checked; quality bar
   (prototype or production); deadline; areas not to touch; the share of the 5-hour and weekly windows this run may use.
   Do not send them yet: plan on the defaults first (steps 3-5) and send everything in one message (step 6).
3. **Break it down** into `<master_dir>/plans/<slug>.json`: tasks with `id`, `size` (S-XL), `deps`, `human_days` (how long a
   person would take), one lane each, disjoint files. Foundational work (schema, shared contracts) is alone in wave 1. Split any XL task that can be split.
4. **Measure:** `get_usage` (5-hour %, weekly %, context). `pct5h` = % of the 5-hour window per million tokens, from
   routing-log lines with `--pct`. None yet: say "uncalibrated" and re-plan after wave 1.
5. **Plan:** `node <skill_dir>/scripts/scale.cjs plan <plan.json> --cap <C> --pct5h X --left5h P --pctWeek Y --leftWeek Q
   --log <master_dir>/routing-log.jsonl`. C = chat capacity (4 worker chats per Master, times the Masters you will use,
   within `CAPACITY.md`).
6. **Ask once, in one message:** the questions with their defaults, then the plan built on those defaults (text, `core/PLAN-FORMAT.md`; the
   waves are the script's table as printed), its recommendation, what is out of scope,
   top 3 risks, and "How many workers? (recommended N)". Wait. Answers that change the plan: re-run `plan` and send only
   what changed. Their number is the cap; questions sent alone cost a round trip.
7. **Start:** `start_session` per worker (CAPABILITIES `spawn_task`), `initiation: "user_asked"` quoting their yes, a full
   brief (`core/BRIEF.md`), `effort` and `model` from the task's score, `wake_when_done: true`.

## 3. Run waves, never one task at a time
- Dispatch every ready task, up to N, **in one message**, before waiting on any of them.
- Wait on **any** completion (wake notice, completion notice, `Monitor` on `handoffs/`), never on one chosen task.
- On each RESULT: check it, mark BOARD, and start the next ready task in the freed slot at once. Do not hold the slot for
  the rest of the wave. Only the batched sweep (law 7), LOCK changes and shared-contract tasks wait.
- Each cycle: `get_usage` and the TOKENS §6 table. A run that crosses the 5-hour window: checkpoint and resume at the reset
  (law 14). The approved plan goes on after the reset without asking again.
- After wave 1: log each task (`route-log.cjs --size --pct`), re-run `plan`. Wall time or tokens moved 25% or more: tell the
  human in one line. Past the share they gave: ask before going on.
- A partial RESULT: record the done items by commit and re-dispatch only the missing ones with those commits as context;
  a skipped item needs a one-line reason and goes to the human as a decision.
- A dependency upgrade gets its own worktree, branch and install (a worktree's `node_modules` may be a junction to
  main's: detach the link, never its target), merges after the other workers, then the top chat's full sweep (it is `scope: wide`, law 7).
- A migration runs before any sweep that reads its new columns (`core/SAFETY.md` 4).
- With several Masters: one Master per area (CHIEF rule 10) runs its own waves; the Chief waits only on cross-area deps.

## 4. Honest numbers
Until 3 tasks per size are logged the costs are defaults: say "uncalibrated". More workers never cut tokens: each adds
its boot cost, and the 5-hour window often bounds wall time before the worker count does. Pick N for the critical path
(the script's recommendation), not the most workers that fit.
