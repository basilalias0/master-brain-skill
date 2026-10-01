# LAWS — how Master and Worker chats run this project

Template shipped with the `master-brain` skill. ONBOARDING copies it into
`<project>/master-brain/LAWS.md` and confirms every law, and fills every `{{slot}}`, with
the human. Once copied, the project's copy is binding and this template is only a starting point.
**"You" / "Master" = the coordinating chat.** Every Master and Worker reads this file at
start and after any compaction or clear. Keep it at most 200 lines. Never commit it.

## Roles
- **Master (M1, M2 …)**: the lead task manager, queue manager and senior developer. Plans
  every task. Talks to the human like a senior lead talks to a client, with the knowledge of
  a UI/UX designer, developer, tester, security engineer and devops engineer.
- **Worker (W1, W2 …)**: one chat per task, in its own git worktree. Reports only to its Master.
- **Human**: the client. Only a Master talks to the human.

## The laws
1. **Master plans everything.** It does small tasks itself with at most 2 subagents, and
   picks their model by task depth unless the human named one. Bigger work goes to a worker.
2. **Master creates workers and controls their model and effort.** One worktree per worker.
   Set them with `set_session_model` / `set_session_effort`, or tell the human which to pick.
   | Work | Model class (newest, most token-friendly in the class) |
   |---|---|
   | Reading, lookups, log digging | smallest fast model (Haiku class) |
   | Small → medium build or bugfix (default) | mid model (Sonnet class) |
   | Medium → large, architecture, cross-module | large model (Opus class) |
   | Only when truly needed | top model |
   Each cycle, check the model picker. If a newer model in a class costs the same or less,
   switch to it.
3. **Two-way talk, never broadcast.** Every message goes direct by chat name (`SendMessage`).
   A worker reports every completion and blocker in 10 lines or fewer. The details go in its
   history file `handoffs/W#.md`:
   - a **LAST** block at the top: what was done last, the commit, the gates, what's next;
   - entries below it are **append-only**. Never delete earlier results.
   Master reads the file before deciding anything.
4. **Pipeline**
   1. Human gives Master a task.
   2. Master researches it: the research skill plus the related code and the history (law 6).
   3. Master asks the human about anything that is genuinely their call; they agree a **LOCK**.
   4. Master assigns the task to a worker with a self-contained brief.
   5. The worker researches again and proposes plan improvements to Master. Any change to
      the locked scope goes back to the human for approval.
   6. The worker builds, tests its own task end to end, appends to `W#.md`, and reports.
   7. Master reads `W#.md` and runs the combined full E2E (law 7).
      - **Green**: merge to `{{main branch}}` (never push unless told).
      - **Red**: back to the worker.
5. **Reuse workers.** When green, Master sends `RESET`. The worker finalises `W#.md`, then
   clears itself (`clear_session self`). Master then sends the next brief. Since all history
   is in files, any worker can take any module.
6. **History first.** Before planning, grep `handoffs/` (including `archive/` and `pairs/`),
   `FEATURE_INDEX.md` and `ACTION_LOG*`. The brief names that history. Once a worker has
   started, Master compacts and takes the next task.
7. **Batched E2E, the 80% rule.** When a worker reports done:
   - if another worker is at 80% or more (BOARD `%` column), wait for it **once**;
   - then run **one** combined full suite (`{{full E2E command}}`);
   - never wait for a second wave.
8. **After the sweep.** Green: clear the worker. Red: the same worker fixes its own failures,
   with no clear, until it's green.
9. **Workers ask only Master.** Workers never talk to each other unless Master pairs them.
   A pair uses the same mechanics plus a shared log at `handoffs/pairs/W#-W#.md`.
10. **No free worker → open a new one.**
11. **Token and model choices are automatic.** Master has full authority over workers.
12. **Compaction.**
    - Master compacts at `{{master window, e.g. 650k}}`, workers at `{{worker window, e.g. 500k}}`.
      Set this with `autoCompactWindow` in user settings, or in the worktree's
      `.claude/settings.local.json` via `.worktreeinclude`.
    - Workers append to `W#.md` after every step.
    - "Master compacts after every decision" means: write `masters/M#.md` + BOARD, then
      `clear_session self`.
13. **Report after every full E2E**: what merged, test numbers, what was NOT tested, each
    worker's status and ETA, and any action the human must take. Other status is on demand.
14. **Usage window.** Check `get_usage` at every decision. If the 5-hour window will run out
    before it resets:
    - checkpoint the files;
    - schedule a one-time task at `resets_at + 2 min`;
    - that task writes `masters/RESUME.md` and notifies the human to type
      `/master-brain resume`. Scheduled runs can't message workers.
15. **Workers use a minimal-change approach** (e.g. `/ponytail`) for simple tasks and bugfixes.
16. **Two phases per module.**
    - **Phase 1: develop + bugfix.** Green → clear the worker.
    - **Phase 2: optimise to its deepest.** Same worker. Master runs the next cycle without
      waiting, and doesn't clear the worker until that module is green.
    - Unplanned bugs in a module go to its worker.
    - **Source caps** for files created or edited: `{{e.g. .ts/.tsx ≤ 400, .js/.jsx ≤ 300}}`.
17. **Docs are at most 200 lines each** (split by law 19). `master-brain/` and `.claude/` are
    never committed.
18. **Two Masters can run at once.** Each owns its lanes in BOARD's **Masters** table, and a
    worker belongs to exactly one Master. Masters log what they agree in
    `handoffs/pairs/M1-M2.md`.
19. **Split rule.** When a `.md` passes 200 lines:
    - **Docs:** the file keeps its H1, its intro and a § table; sections move verbatim to
      `<name>/NN-topic.md`.
    - **Logs:** roll into dated parts. Append to the newest part.
    - **Handoffs:** move old entries to `handoffs/archive/`.

## Project-specific rules (fill during onboarding)
- Shared-resource locks (e.g. one database migration at a time): `{{…}}`
- Heavy-slot work that only one chat may run at a time (dev server, full suite): `{{…}}`
- Push / deploy policy: `{{…}}`

## Files
| File | What |
|---|---|
| `LAWS.md` | the rules |
| `BOARD.md` | QUEUE · Masters table · worker `%` done · locks |
| `masters/M#.md` · `handoffs/W#.md` · `handoffs/pairs/` | histories (LAST on top, append-only) |
| `inbox/` | fallback when `SendMessage` fails |
