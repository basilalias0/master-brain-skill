# Token rules

The goal is the fewest tokens per task with no loss of quality. Every rule here has a guardrail; do not drop the guardrail to save more.

## 1. Cheapest path first
script, then T0 scout subagent, then Master directly, then a subagent, then a worker chat.
- A script does anything mechanical (locks, test guard, line caps, code map, filtered test run, status).
- A scout answers "where is X" and returns conclusions, never file dumps.
- Master edits tiny things itself (one file, a few lines) with lean.
- **Spawn a worker chat only** when the work is over about 3 files or 15 minutes, or truly parallel. A worker's boot costs more than a small fix.
- One subagent per job: never split triage and fix, and never let two agents read the same source (measured: subagents were 55% of one session's cost).
- Batch same-lane tasks into one worker. Reuse a warm idle worker; clear it when it changes module or its context grows. Cap parallel workers at 2-3.

## 2. Risk tiers (how much pipeline a task gets)
| Tier | Example | Pipeline |
|---|---|---|
| Low | typo, copy, one-file fix | lean + type-check |
| Medium | one-lane feature or bugfix | + its own flow test |
| High | auth, data, money, shared contract, LOCK | + analyzer + scoped audit + Master slot run |
Never route High work below T1 or default effort.

## 3. Reading
- Look in the code map and FEATURE_INDEX first; grep with a few lines of context; Read with offset and limit.
- Never open a file over about 200 lines whole unless editing most of it. Never re-read after an edit.
- ACTION_LOG, FEATURE_INDEX, changelogs and handoffs are grep-only, never read whole.
- Briefs carry file:line targets, not "explore". The worker still greps callers before editing (bug fixes: required).
- Index entries carry the git hash and expire when it changes. Read the exact lines before editing; never trust an index for content.
- Reuse a dated verdict (same git hash) instead of re-analysing or re-researching.

## 4. Output
- Run tests, build and type-check through `scripts/run-quiet.cjs`: full log to a file, only the verdict, first errors and the path on screen. Read the log file on any failure.
- Edit, never rewrite whole files. Scaffold and codemod before writing by hand. Formatters and linters do formatting.
- Reports 10 lines or fewer. Paths and line numbers, never pasted code. Diffs, not whole files, for review (read surrounding code for risky changes).
- Screenshots only for visual changes; otherwise page text and the accessibility tree.
- Batch independent tool calls into one message. Every extra turn re-reads the whole context.

## 5. Budget and effort
- Each brief states a budget (files read, tool calls). Default cap for a subagent: about 25 tool calls, reading file ranges (offset and limit), not whole files. At the limit the worker returns `needs-master` with partial progress; Master may extend.
- Read-only audits and hunters run on a cheaper model or lower effort (see `MODELS.md`); keep the strong model for fix workers.
- Effort follows the tier in `MODELS.md`: low for routine T0/T1 work, higher only after a failed attempt. Planning, security, migrations and LOCK changes never go below the floor in `MODELS.md`.

## 6. Sessions
- Check `get_usage` once per cycle and before each wave. Above 70% of the 5-hour window: drop non-critical work one tier. Above 90%: checkpoint and stop launching.
- Workers do one task, then clear, unless the next task is in the same lane.
- Start a fresh chat after each milestone; the state lives in `STATE.md` and the reports, not in the chat (a long chat is re-read every turn).
- Status checks are commands (a detached script that writes a summary file, plus a node watcher), never a model turn that re-reads context.
- Compact or clear at task boundaries with a short keep-list, not at the context limit.
- Keep the Master's session stable: choose model and effort at the start and do not switch them mid-session (a switch re-reads the whole context uncached). Change tier by dispatching, not by switching the Master.
- Disable connectors a worker does not need (the human approves the change).
