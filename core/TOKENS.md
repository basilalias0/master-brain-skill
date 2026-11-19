# Token rules

Fewest tokens per task, no loss of quality; keep each guardrail. Every step re-reads the whole chat, so in a long chat a
saved step saves about its length again.

## 1. Cheapest path first
Script, T0 scout, the Master itself, a subagent, a subagent in its own worktree, a worker chat. Never two agents on the same files or sources.
- Scripts do mechanical work. Scouts return conclusions, never file dumps. The Master edits tiny things itself (lean).
- Sizing, start-all, wait-on-any: `core/SCALE.md`. A worker chat only for over about 3 files or 15 minutes, or parallel work.
- An agent that edits files gets its own worktree and the `worktree` and `sync` lines of `core/BRIEF.md` word for word.
- Overdue RESULT: read the worker's handoff LAST block, then message it by name. No answer after 1 cycle = `blocked`.
- One subagent per job. Batch same-lane tasks into one worker; reuse a warm idle one. Workflow tool: offer once per wave with a cost, never unasked.

## 2. Risk tiers (how much pipeline a task gets)
| Tier | Example | Pipeline |
|---|---|---|
| Low | typo, copy, one-file fix | lean + type-check |
| Medium | one-lane feature or bugfix | + its own flow test |
| High | auth, data, money, shared contract, LOCK | + analyzer, phase-2 optimise, scoped audit, the Master's full E2E |
Never route High work below T1 or default effort.

## 3. Reading
- Code map and FEATURE_INDEX first; grep with context; Read with offset and limit; never re-read after an edit or open a 200-line file whole.
- ACTION_LOG, FEATURE_INDEX, changelogs and handoffs are grep-only. Briefs carry file:line targets. Reuse a verdict with the same git hash.

## 4. Output
- Tests, build and type-check run through `scripts/run-quiet.cjs`. Check each edit batch; never carry a red edit forward.
- Edit, never rewrite whole files. Reports 10 lines or fewer, paths not pasted code. Batch independent tool calls.
- Pages: `scripts/page-check.cjs`; look only at a failing `changed.png` crop. Without Playwright: page text and the accessibility tree.
- A mechanic that already has a passing spec is re-checked by running or adapting that spec, never by clicking through again (cheaper, and less flaky than page references).

## 5. Budget and effort
- Each brief states a budget: read-only about 25-40 tool calls; a fix worker about 10 per item. At the cap: `needs-master` with done and remaining items and every sha; only the Master extends it.
- A full sweep that runs is never trimmed. Read-only audits run cheaper. Effort: `MODELS.md` Effort score (`scale.cjs size` prints it).

## 6. Sessions
- Once per cycle and before each wave: `get_usage`, then `scripts/cycle.cjs` (rollover, this table, capacity). A missing or non-numeric value counts as 90%.

| Window (`get_usage`) | ≥ 70% | ≥ 80% | ≥ 90% |
|---|---|---|---|
| 5-hour | non-critical work drops 1 tier; no arena | — | checkpoint, stop launching |
| weekly | no arena | non-critical work drops 1 tier | stop launching |

- Workers clear after each task unless the next is in the same lane. Chief and Masters roll over (`core/CHIEF.md` rule 1).
- Never switch a long chat's model or effort (it re-reads uncached); change tier by dispatching.
- Wait with `Monitor` or `run_in_background`, never sleep loops or status turns. Sweeps: a detached script writes a summary file (decode Windows UTF-16 logs with node; re-arm a wait at 2 hours).
- `tools: none` in a brief asks a worker to skip browser and connector tools; whether that drops their definitions is unverified (the host list likely stays).
