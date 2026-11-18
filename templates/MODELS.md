# MODELS: the one place model names live

Skills and briefs name tiers (T0-T3), never models; dispatch resolves the tier here. Agents never edit this file; they propose and the human approves. Fast mode stays off. Evidence: `<skill_dir>/templates/MODELS-evidence.md` (only when re-checking a default).

last_verified: 2026-10-05

| Tier | Role | Model | Id accepted by `set_session_model` | Default effort | Status |
|---|---|---|---|---|---|
| T0 | scout | Haiku 5.5 | claude-haiku-5-5 | low | unverified (changed 2026-10-19) |
| T1 | standard | Sonnet 5.5 | claude-sonnet-5-5 | low | verified via Agent tool; picker id unverified |
| T2 | deep | Opus 5.5 | claude-opus-5-5 | medium | verified via Agent tool; picker id unverified |
| T3 | top | Fable 5.1 | claude-fable-5-1 | medium | unverified |

Status becomes `verified` after the first successful dispatch; the picker's ids are authoritative. Fallback: T3, T2, T1, T0; tell the human. The Agent tool takes `haiku`, `sonnet`, `opus` or `fable`.

## Routing: task, default tier, escalate when
| Task | Default | Escalate when |
|---|---|---|
| Lookups, log digging, recon, sweep running | T0 | never |
| Single-file fix or a one-to-two-step edit | T0 only when tests or the type check catch a wrong fix (Checking 0); else T1 | multi-file, callers to check, or failed once: T1 |
| Master planning | T1 | multi-module or a LOCK dispute: a T2 subagent or worker plans it (Masters never switch) |
| Research | T1 | high stakes or conflicting sources: T2 |
| Analyzer | T1 | huge graph: T2 |
| Developer update, lean | T1 | failed once: T2 |
| Developer build | T2 | single layer: T1 |
| Tester | T1 | concurrency or flaky: T2; never T0 first for writing tests |
| Audit hunters (read-only; lower effort) | T1 | verifiers of high or critical findings: T2; never T3 |

## Floors (never go below)
Planning: T1 and at least medium effort. Security, migrations, permission and LOCK changes: T1 and at least high effort.

## Effort score: effort per task, not per tier
Effort is how much the model thinks and checks before acting; higher pays off only on hard tasks.
Score each line 0, 1 or 2; `scale.cjs size --clarity --reach --mistake --newness --checking` adds it up and prints
tier and effort:

| Factor | 0 | 1 | 2 |
|---|---|---|---|
| Clarity | exact steps | some choices | open design |
| Reach | one file | a few files, one area | many areas or shared code |
| Cost of a mistake | cosmetic | a bug users see | security, data, money, or messages to real people |
| Newness | repeats a pattern | partly new | new ground or an unverified outside API |
| Checking | tests and the type check catch it | partly | judgment only |

Total: 0-2 low, 3-5 medium, 6-7 high, 8-9 xhigh, 10 max (max only with the human's yes or after a failed attempt).
8 or more lifts the tier to at least T2; 0-2 with Checking 0 may use T0. A coordinating Master stays at medium at most.
The Master writes `score: N/10` and the effort in each brief and applies it (Agent `effort`, or `set_session_effort`
as soon as a chip-started session starts: it inherits its parent's).

## Escalation (once per task)
Cheap-first pays only when the check is reliable (a failed cheap run cost over 4x a good one).
1. **Diagnose.** It skipped a file, skipped the checks or rushed: one **effort** level up, same model. It had the
   context, ran the checks and was still wrong: one **tier** up. Never both at once.
2. **Where.** Worker context under about 120k: change it in place. Over: the worker writes its LAST block (tried,
   failed, the failing check, next step) and stops; a **fresh worker** at the new level continues on the same branch.
   Never fork the old chat (a cache does not move between models).
3. A second failure goes back to the Master (`needs-master`), then to the human. Log one line of reason in `masters/M#.md`.
Masters and the Chief never switch their own model or effort: hard work goes to a worker or subagent at the right level.
