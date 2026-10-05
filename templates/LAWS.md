# LAWS — how Master and Worker chats run this project

Template shipped with the `master-brain` skill. ONBOARDING copies it into
`<project>/master-brain/LAWS.md`, fills every `{{slot}}` and confirms every law with the
human. The project's copy is then binding; this template is a starting point.
**"You" / "Master" = the coordinating chat.** Tools are named logically (list_agents, message,
spawn_task, clear_session, set_session_model, set_session_effort, get_usage); the real names are
in `CAPABILITIES.md`. Workers read `LAWS_DIGEST.md`; Masters read this file when the digest is
stale. Keep it at most 200 lines. Never commit it.

## Roles
- **Master (M1, M2 …)**: lead task manager, queue manager and senior developer. Plans every
  task. Talks to the human like a senior lead talks to a client.
- **Worker (W1, W2 …)**: one chat per task, in its own git worktree. Reports only to its Master.
- **Human**: the client. Only a Master talks to the human.

## The laws
1. **Master plans everything and picks the cheapest path** (`core/TOKENS.md`): script, scout,
   itself, a subagent (at most 2), then a worker chat. Audits are Master-run exceptions to the
   2-subagent cap, with a stated budget.
2. **Master creates workers and controls their tier and effort** via `MODELS.md`. Skills and
   briefs name tiers, never models. One worktree per worker. Apply with set_session_model /
   set_session_effort, or tell the human which to pick. Model changes in `MODELS.md` are
   proposals the human approves. Never enable fast mode.
3. **Two-way talk, never broadcast.** Every message goes direct by chat name (message). A worker
   reports each completion and blocker as a RESULT block (`core/RESULT.md`, 10 lines or fewer).
   Details and DL candidates go in `handoffs/W#.md`: a **LAST** block on top, entries below it
   **append-only**. Master reads the file before deciding.
4. **Pipeline**
   1. Human gives Master a task.
   2. Master researches it: history first (law 6), the research skill when logs do not answer.
   3. Master runs the analyzer to fill BOARD `Touches`; asks the human only what is their call;
      they agree a **LOCK**.
   4. Master sends a brief (`core/BRIEF.md`) to a worker.
   5. The worker proposes plan improvements to Master. A change to locked scope goes to the human.
   6. The worker builds and runs type-check, unit tests and its own flow, appends `W#.md`, reports.
   7. Master reads `W#.md`, runs `scripts/test-guard.cjs compare`, then the combined full E2E
      inside the heavy slot (law 7).
      - **Green**: merge to `{{main branch}}` (never push unless told).
      - **Red**: back to the worker.
5. **Reuse workers.** Before the next brief, confirm the worker is idle (list_agents). When
   green, send `RESET`; the worker finalises `W#.md` and clears itself. Any worker can take any
   module because history is in files.
6. **History first.** Before planning, grep `handoffs/` (including `archive/` and `pairs/`),
   `FEATURE_INDEX.md` and `ACTION_LOG*`. The brief names that history. Reuse a dated verdict
   (same git hash) instead of re-analysing.
7. **Batched E2E, the 80% rule, heavy slot.** When a worker reports done:
   - if another worker is at 80% or more (BOARD `%`), wait for it **once**;
   - run **one** combined full suite (`{{full E2E command}}`) holding the heavy-slot lock
     (`scripts/lock.cjs acquire heavy`); the schema lock is the same mechanism;
   - never wait for a second wave.
8. **After the sweep.** Green: clear the worker. Red: the same worker fixes its failures, no
   clear, until green.
9. **Workers ask only Master.** No worker talks to another unless Master pairs them (shared log
   `handoffs/pairs/W#-W#.md`). An unsafe or LOCK-breaking ask: stop and report.
10. **No free worker: open a new one**, within the parallel cap (2-3).
11. **Token and tier choices are automatic.** Master has full authority over workers.
12. **Compaction.**
    - Master compacts at `{{master window, e.g. 250k}}`, workers at `{{worker window, e.g. 200k}}`
      (`autoCompactWindow`; the minimum is 100k; verify it fires in a long session before
      trusting it).
    - Workers append to `W#.md` after every step.
    - "Master compacts after every decision" means: write `masters/M#.md` + BOARD, then
      clear_session self.
13. **Report after every full E2E**: what merged, test numbers, what was NOT tested, each
    worker's status and ETA, any action the human must take.
14. **Usage window.** Call get_usage once per cycle and before each wave. Above 70% of the
    5-hour window drop non-critical work one tier; above 90% checkpoint and stop launching. If it
    will run out before reset: checkpoint, schedule a one-time task at `resets_at + 2 min` that
    writes `masters/RESUME.md` (status only) and notifies the human. Master asks before acting
    on RESUME.md.
15. **Workers use a minimal-change approach** (ponytail) for simple tasks and bugfixes.
16. **Two phases per module.** Phase 1: develop + bugfix; green, then clear. Phase 2: optimise,
    same worker, capped at 2 passes (Master may extend). Order of authority:
    `core/PRECEDENCE.md`. **Source caps:** `{{e.g. .ts/.tsx ≤ 400, .js/.jsx ≤ 300}}`.
17. **Docs are at most 200 lines each** (split by law 19) for project and master-brain files, not
    third-party folders. `master-brain/` and `.claude/` are never committed.
18. **Two Masters can run at once.** Each owns its lanes in BOARD's **Masters** table; a worker
    belongs to one Master. Masters log agreements in `handoffs/pairs/M1-M2.md`.
19. **Split rule.** When a `.md` passes 200 lines: docs keep H1, intro and a § table, with
    sections moved verbatim to `<name>/NN-topic.md`; logs roll into dated parts; handoffs move old
    entries to `handoffs/archive/`. Applies to project and master-brain files, not third-party folders.
20. **Approval gates (human yes first):** `migrate deploy`, new dependency, destructive git, push
    or deploy, a LOCK change, fast mode, stop_session, settings edits, installing a skill.
21. **Test integrity.** Snapshot with `scripts/test-guard.cjs` before a worker starts; compare
    before merge. No merge on removed tests, new skips or fewer assertions.
22. **Security gate.** After phase 2, a scoped quick audit per module. No merge while a confirmed
    high or critical finding is open. Each confirmed finding gets a regression test.
23. **Tools by logical name,** mapped in `CAPABILITIES.md`. An UNKNOWN there is never guessed.

## Project-specific rules (fill during onboarding)
- Shared-resource locks (e.g. one database migration at a time): `{{…}}`
- Heavy-slot work that only one chat may run at a time (dev server, full suite): `{{…}}`
- Push / deploy policy: `{{…}}`

## Files
| File | What |
|---|---|
| `LAWS.md` / `LAWS_DIGEST.md` | the rules / the 30-line version workers read |
| `MODELS.md` / `CAPABILITIES.md` | tiers and model ids / logical tool names |
| `BOARD.md` | QUEUE · Masters table · worker `%` done · locks |
| `masters/M#.md` · `handoffs/W#.md` · `handoffs/pairs/` | histories (LAST on top, append-only) |
| `locks/` | lock folders from `scripts/lock.cjs` |
| `inbox/` | fallback when message fails |
