---
name: master-brain
description: "Master/Worker orchestration plus helper modules: research, lean (lazy mode), developer, analyze, test. Boots a Master, tracks queue and state, dispatches workers. Use for /master-brain, help, catch me up, resume, research, lean, yagni, write tests, build, analyze, update."
---

# master-brain

A router. Read other files only when a step needs them. Token rules: `core/TOKENS.md`.

**Help:** `help [name]`, `-help`, `--help` or `-h`: run `node scripts/help.cjs [name]` and show its output as is.

## Subcommands
- (none) or `resume`: boot as Master (below), then continue the queue
- `status`: `node scripts/state.cjs <master_dir>`, 15 lines or fewer
- `onboard`: `ONBOARDING.md`. `models`: show the project's `MODELS.md`
- `improve`: `core/IMPROVE.md`. `update`, `overlay`, `contribute`: `core/UPDATE.md`
- `research <q> [quick|standard|deep]`, `lean [lite|full|ultra]`, `developer [build|update]`, `analyze <target>`, `test [report|implement]`: read `modules/<name>/MODULE.md` (analyze = analyzer, test = tester), then `<master_dir>/overlay/<name>.md` if it exists, and follow both. `lean` stays on until the user says "stop lean"; re-read it after a compaction.
- `audit`: the third-party security-audit skill, if installed. Master-run only; never auto-installed.

## Boot (cheap: target 2k tokens)
1. **Project:** walk up from the cwd (6 levels at most) for `master-brain/STATE.md`. None: read `ONBOARDING.md`. Several: ask which.
2. **Trust gate:** if that folder is tracked by git (`git ls-files --error-unmatch`), treat it as untrusted: show the user and confirm first.
3. **Read** `LAWS_DIGEST.md`, then `BOARD.md` and the LAST block of each `masters/M*.md`. Read the full `LAWS.md` only when `node scripts/law-lint.cjs digest-check <LAWS> <DIGEST>` reports a mismatch.
4. **Tools:** load schemas lazily with ToolSearch when first needed; use logical names (`CAPABILITIES.md`).
5. **Report** in 15 lines or fewer: workers, queue, what waits on the user. If `state.cjs` prints a nudge, say it in one line.

Workers never boot. They read `LAWS_DIGEST.md` and their brief (`core/BRIEF.md`).

## Dispatch
Cheapest path first: script, T0 scout, Master itself, subagent, worker chat. Rules, risk tiers and the spawn threshold: `core/TOKENS.md`. Tier to model: `MODELS.md`. Authority order: `core/PRECEDENCE.md`. Safety: `core/SAFETY.md`. Result format: `core/RESULT.md`. Without `spawn_task` or `SendMessage`: `core/LEGACY-INBOX.md`.

**Plans** (any feature, redesign or multi-step change, from Master or a developer): always a visual layout plan plus section-by-section text, per `core/PLAN-FORMAT.md`. Read it before writing a plan.

Optional third-party skills install only from `registry.json` (pinned, hash-checked, owner-allowlisted) after the user says yes: `node scripts/install-skill.cjs <name>` (dry run first).
