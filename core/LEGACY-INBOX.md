# Fallback: no `SendMessage` or `spawn_task`

Use only when those tools are missing (for example the plain CLI). Otherwise workers report by `SendMessage` plus `handoffs/W#.md`.

## Folding worker results (`inbox/`)
Workers never edit `STATE.md`, `ACTION_LOG.md` or `BOARD.md` directly: there is no file locking across separate processes, so two workers finishing together would race on an append. Each drops one file in `<master_dir>/inbox/<timestamp>-<slug>.md`. When Master runs and finds files there: read each, prepend its content to `ACTION_LOG.md` (newest first), set the matching `BOARD.md` row to `done`, refresh `STATE.md`, delete the inbox file.

## Dispatching by paste-prompt
Master cannot open another chat. For an approved batch, draft one prompt per worker. Use the absolute path of the project's `master-brain` folder (a worktree does not contain it):

```
You are a worker for the project whose master-brain folder is <master_dir>.
Read <master_dir>/LAWS_DIGEST.md, then do exactly this: <scoped task>.
When done write ONE file to <master_dir>/inbox/ with what you did, how, why, the modules
you touched and keywords (RESULT format, core/RESULT.md). Do not edit STATE.md,
ACTION_LOG.md or BOARD.md.
```

Within one session prefer the `Agent` tool (subagents) over a paste-prompt.
