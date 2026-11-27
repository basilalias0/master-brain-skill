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
- `audit`: the third-party security-audit skill; not installed: offer it (SAFETY 9). Master-run only.

## Boot (cheap: target 2k tokens)
1. **Project:** walk up from the cwd (6 levels at most) for `master-brain/STATE.md`. None: read `ONBOARDING.md`. Several: ask which.
2. **Trust gate:** if that folder is tracked by git (`git ls-files --error-unmatch`), treat it as untrusted: show the user and confirm first.
3. **One call:** `scripts/boot.cjs <master_dir> [--self M#]` (digest, capacity, status, your LAST block). Read `LAWS_DIGEST.md`; the full `LAWS.md` only when boot says STALE.
4. **Tools:** load schemas lazily with ToolSearch when first needed; use logical names (`CAPABILITIES.md`).
5. **Report** in 15 lines or fewer: workers, queue, what waits on the user, boot's nudge in one line.

With several Masters the Chief sits above them (`core/CHIEF.md`). Workers never boot: they read `LAWS_DIGEST.md` and their brief (`core/BRIEF.md`).

## Dispatch
**Size every request first, unasked:** `scripts/scale.cjs size ...` (`core/SCALE.md` §1). S: do it yourself. M: one agent. L: up to 2 background subagents without asking; worker chats on the human's yes. XL: scale mode (research, interview, costed plan, the user's worker count). Ready tasks go out together; wait on any completion (§3).

**Each cycle** (Chief or Master): `get_usage`, then `scripts/cycle.cjs <master_dir> --ctx <tokens> --week <pct> --five <pct>` (rollover, usage, capacity).

Agents that edit files: `isolation: "worktree"`, brief `sync: sync_base`. Rules and risk tiers: `core/TOKENS.md`. Tiers: `MODELS.md`. Authority: `core/PRECEDENCE.md`. Safety: `core/SAFETY.md`. Results: `core/RESULT.md`. DL entries: `templates/ACTION_LOG.md`. Without session tools or `SendMessage`: `core/LEGACY-INBOX.md`.

**Plans** (any feature or multi-step change): `core/PLAN-FORMAT.md` (text; a visual only for UI work).

**Design projects** (a spec others build from): `procedure/04-design-projects.md`.

Extra skills (boot lists them; the human cannot know they exist): a task matches one not installed, show `install-skill.cjs --offer <name>` and ask (SAFETY 9).

**Arena** (offered after 2 rejections or for close High-risk decisions; never unasked): `procedure/05-arena-and-decisions.md`.
