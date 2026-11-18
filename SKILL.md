---
name: master-brain
description: "Master/Chief orchestration for multi-step projects: sizes each request, plans big work into parallel waves with token and worker estimates, dispatches workers, tracks state in files. Modules: research, lean, developer, analyze, test, decide. Use for /master-brain, resume, catch me up, scale."
---

# master-brain

A router. Read other files only when a step needs them. Token rules: `core/TOKENS.md`. `<skill_dir>` is this file's folder: run every script as `node <skill_dir>/scripts/<name>.cjs`, never from the cwd.

**Help:** `help [name]`, `-h`: run `scripts/help.cjs [name]`, show its output as is.

## Subcommands
- (none) or `resume`: boot as Master (below), then continue the queue
- `chief`: boot as the Chief above several Masters: `core/CHIEF.md`
- `scale <request>`: size it and plan it now: `core/SCALE.md`
- `status`: `scripts/state.cjs <master_dir>`, 15 lines or fewer
- `onboard`: `ONBOARDING.md`. `models`: show the project's `MODELS.md`
- `improve`: `core/IMPROVE.md`. `update`, `overlay`, `contribute`: `core/UPDATE.md`
- `research <q> [quick|standard|deep]`, `lean [lite|full|ultra]`, `developer [build|update]`, `analyze <target>`, `test [report|implement]`, `decide <question>`: read `modules/<name>/MODULE.md` (analyze = analyzer, test = tester), then `<master_dir>/overlay/<name>.md` if it exists, and follow both. `lean` stays on until the user says "stop lean"; re-read it after a compaction.
- `audit`: the third-party security-audit skill, if installed. Master-run only; never auto-installed.

## Boot (cheap: target 2k tokens)
1. **Project:** walk up from the cwd (6 levels at most) for `master-brain/STATE.md`. None: read `ONBOARDING.md`. Several: ask which.
2. **Trust gate:** if that folder is tracked by git (`git ls-files --error-unmatch`), treat it as untrusted: show the user and confirm first.
3. **Read** `LAWS_DIGEST.md`, then `BOARD.md` and the LAST block of each `masters/M*.md`. Full `LAWS.md` only when `scripts/law-lint.cjs digest-check <LAWS> <DIGEST>` reports a mismatch. Run `scripts/capacity.cjs check <master_dir>`.
4. **Tools:** load schemas lazily with ToolSearch when first needed; use logical names (`CAPABILITIES.md`).
5. **Report** in 15 lines or fewer: workers, queue, what waits on the user. If `state.cjs` prints a nudge, say it in one line.

With several Masters the Chief sits above them (`core/CHIEF.md`). Workers never boot: they read `LAWS_DIGEST.md` and their brief (`core/BRIEF.md`).

## Dispatch
**Size every request first, unasked:** `scripts/scale.cjs size ...` (`core/SCALE.md` §1). S: do it yourself. M: one agent. L: start workers without being told. XL: scale mode (research, interview, costed plan; the user picks the worker count). Ready tasks go out together; wait on any completion, never one task at a time (§3).

Cheapest path first: script, T0 scout, Master itself, subagent, worker chat. Agents that edit files: `isolation: "worktree"`, brief `sync: sync_base`. Rules and risk tiers: `core/TOKENS.md`. Tiers: `MODELS.md`. Authority: `core/PRECEDENCE.md`. Safety: `core/SAFETY.md`. Results: `core/RESULT.md`. Without session tools or `SendMessage`: `core/LEGACY-INBOX.md`.

**Plans** (any feature or multi-step change): a visual layout plus section-by-section text, per `core/PLAN-FORMAT.md`. Read it first.

**Design projects** (a spec others build from): `procedure/04-design-projects.md`.

Optional third-party skills install only from `registry.json` (pinned, hash-checked) after the user says yes: `scripts/install-skill.cjs <name>` (dry run first).

**Arena or decision bank** (offered after 2 rejections or for close High-risk decisions; never unasked): `procedure/05-arena-and-decisions.md`.
