# MODELS: the one place model names live

Skills and briefs name tiers (T0-T3), never models. Dispatch resolves tier to id here at dispatch time. Agents never edit this file; they propose changes and the human approves. Fast mode stays off.

last_verified: 2026-10-05

| Tier | Role | Model | Id accepted by `set_session_model` | Default effort | Status |
|---|---|---|---|---|---|
| T0 | scout | Haiku 4.5 | claude-haiku-4-5 | low | verified via Agent tool; picker id unverified |
| T1 | standard | Sonnet 5.5 | claude-sonnet-5-5 | low | verified via Agent tool; picker id unverified |
| T2 | deep | Opus 5.5 | claude-opus-5-5 | medium | verified via Agent tool; picker id unverified |
| T3 | top | Fable 5.1 | claude-fable-5-1 | medium | unverified |

Status becomes `verified` after the first successful dispatch; the picker's ids are authoritative (the tool lists them when an id is refused). Fallback chain: T3, T2, T1, T0; tell the human when it is used. The Agent tool takes `haiku`, `sonnet`, `opus` or `fable`.

## Routing: task, default tier, escalate when
| Task | Default | Escalate when |
|---|---|---|
| Lookups, log digging, recon, sweep running | T0 | never |
| Single-file fix or a one-to-two-step edit | T0 | multi-file, callers to check, or failed once: T1 |
| Master planning | T1 | multi-module or a LOCK dispute: T2 |
| Research | T1 | high stakes or conflicting sources: T2 |
| Analyzer | T1 | huge graph: T2 |
| Developer update, lean | T1 | failed once: T2 |
| Developer build | T2 | single layer: T1 |
| Tester | T1 | concurrency or flaky: T2; never Haiku-first for writing tests |
| Audit hunters (read-only; lower effort) | T1 | verifiers of high or critical findings: T2; never T3 |

## Floors (never go below)
Planning, security, migrations, LOCK changes: T1 and default effort. Escalate only after a failed attempt and log one line of reason in `masters/M#.md`.

## Cache note
Haiku 4.5 does not cache prompts under 4,096 tokens, so small T0 jobs are never cached. Prefer a script for mechanical lookups; use T0 for judgment-light reading.

## Usage
From `get_usage`: above 70% of the 5-hour window, drop non-critical work one tier; above 90%, checkpoint and stop launching.

## Evidence (A/B ladder, 2026-10-05, new skills, small synthetic tasks, 1-2 runs each)
- The cheapest tier passed 6 of 7 tasks; it failed only test writing (caught 2 of 3 broken versions). Escalating that failure cost 126k tokens against 55k for the standard tier directly.
- On multi-step work the cheapest tier used 2-4 times the turns of the standard tier (34 against 9 on a 3-caller bug fix), so it saves only if its price per token is lower by more than that.
- A single-file fix cost about a third of the standard tier's tokens on the cheapest tier.
- The deep tier passed everything it was given but the standard tier already did; no quality gain on these tasks, so the build default stays as is until a larger run says otherwise.
