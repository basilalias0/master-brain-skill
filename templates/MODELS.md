# MODELS: the one place model names live

Skills and briefs name tiers (T0-T3), never models. Dispatch resolves tier to id here at dispatch time. Agents never edit this file; they propose changes and the human approves. Fast mode stays off.

last_verified: {{date}}

| Tier | Role | Model | Id accepted by `set_session_model` | Default effort | Status |
|---|---|---|---|---|---|
| T0 | scout | Haiku 4.5 | claude-haiku-4-5 | low | unverified |
| T1 | standard | Sonnet 5.5 | claude-sonnet-5-5 | low | unverified |
| T2 | deep | Opus 5.5 | claude-opus-5-5 | medium | unverified |
| T3 | top | Fable 5.1 | claude-fable-5-1 | medium | unverified |

Status becomes `verified` after the first successful dispatch; the picker's ids are authoritative (the tool lists them when an id is refused). Fallback chain: T3, T2, T1, T0; tell the human when it is used. The Agent tool takes `haiku`, `sonnet`, `opus` or `fable`.

## Routing: task, default tier, escalate when
| Task | Default | Escalate when |
|---|---|---|
| Lookups, log digging, recon, sweep running | T0 | never |
| Master planning | T1 | multi-module or a LOCK dispute: T2 |
| Research | T1 | high stakes or conflicting sources: T2 |
| Analyzer | T1 | huge graph: T2 |
| Developer update, ponytail | T1 | failed once: T2 |
| Developer build | T2 | single layer: T1 |
| Tester | T1 | concurrency or flaky: T2 |
| Audit hunters | T1 | verifiers of high or critical findings: T2; never T3 |

## Floors (never go below)
Planning, security, migrations, LOCK changes: T1 and default effort. Escalate only after a failed attempt and log one line of reason in `masters/M#.md`.

## Usage
From `get_usage`: above 70% of the 5-hour window, drop non-critical work one tier; above 90%, checkpoint and stop launching.
