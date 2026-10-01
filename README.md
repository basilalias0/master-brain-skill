# master-brain — a Claude Code skill for running a Master chat + Worker chats

Type `/master-brain` in a Claude Code chat and that chat becomes a **Master**. A Master:
- plans every task;
- runs Worker chats, each in its own git worktree;
- picks each worker's model;
- keeps append-only history files so any chat can resume after a compaction or clear;
- batches end-to-end test runs;
- reports to you.

It works in any project. On the first run in a project it onboards: it reads the
project, drafts `master-brain/PROJECT_ADAPTER.md`, and offers a `LAWS.md` from
`templates/LAWS.md`, confirming each law with you.

## Install (any machine)

```bash
git clone https://github.com/<you>/master-brain ~/.claude/skills/master-brain
```

On Windows the folder is `%USERPROFILE%\.claude\skills\master-brain`.

Update with `git -C ~/.claude/skills/master-brain pull`.

## Use

| Type | Does |
|---|---|
| `/master-brain` | Boots a Master (or onboards a new project), then reports status |
| `/master-brain resume` | Same boot, then continues the queue |
| "what can run in parallel" / "log this" | Routing in `SKILL.md` §3 |

## Files

| File | What |
|---|---|
| `SKILL.md` | entry point: Master boot (§0), project resolution, routing |
| `PROCEDURE.md` + `procedure/` | the build/test cycle and log format |
| `ONBOARDING.md` | first run on a project |
| `templates/LAWS.md` | the Master/Worker laws, with `{{slots}}` filled per project |

Per-project state lives in `<project>/master-brain/`, never in this repo. Keep that folder
out of the project's git.

Some laws use Claude desktop app tools: `SendMessage`, `clear_session`,
`set_session_model`, `get_usage` and scheduled tasks. In the plain CLI, Master tells you
the step to do by hand instead.
