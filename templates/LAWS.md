# LAWS — how Master and Worker chats run this project

Template from the `master-brain` skill. ONBOARDING copies it to `<project>/master-brain/LAWS.md`, fills every
`{{slot}}` and confirms each law with the human; that copy is binding. A law the human never edited follows the
skill: `boot.cjs` updates it with this project's values (old copy `LAWS.prev.md`); an edited one is only reported. Tools have logical names (`CAPABILITIES.md`).
Workers read `LAWS_DIGEST.md` (`law-lint.cjs digest`). At most 200 lines. Never commit it.

## Roles
- **Chief (C1)**: only with several Masters (`core/CHIEF.md`); the one voice to the human.
- **Master (M1 …)**: plans every task, runs its queue, owns its area for good (CHIEF rule 10); without a Chief it talks
  to the human like a senior lead to a client.
- **Worker (`W-<Master>-<n>`, CHIEF rule 11)**: one chat per task in its own git worktree; reports only to its Master.
- **Human**: the client.

## The laws
1. **The Master plans everything and picks the cheapest path.** Script, scout, itself, a subagent (at most 2; audits
   excepted, with a budget), then a worker chat (`core/TOKENS.md`).
2. **The Master sets each worker's tier and effort.** Briefs name tiers, never models (`MODELS.md`). One worktree per
   worker. Never fast mode.
3. **Two-way talk, never broadcast.** Messages go direct by chat name, as a RESULT (`core/RESULT.md`). Details go in
   `handoffs/W-M#-n.md`: a LAST block on top, entries below append-only.
4. **Pipeline.** Research, LOCK, brief, build and test, compare, merge.
   1. The human gives the Master a task; the Master researches it (history first, law 6).
   2. High tier (TOKENS §2): the analyzer fills BOARD `Touches`; else the code map. The human answers only their calls; you agree a **LOCK**.
   3. The Master sends a brief (`core/BRIEF.md`); the worker may propose improvements; locked scope changes go to the human.
   4. The worker builds, tests only its own change (law 7), appends its handoff, reports; it syncs through
      sync_base, never `git merge`/`pull`. A flow checked by hand becomes a regression spec before done. Scripts that
      make deliverables are committed in the project.
   5. The Master runs `scripts/test-guard.cjs compare` and its module tests (law 7). Green: merge to
      `{{main branch}}`, never push unless told. Red: back to the worker.
5. **Reuse workers.** When green the Master sends `RESET`; the worker finalises its handoff and clears itself. The
   Master decides when a worker opens, clears or closes; a chip-launched chat it cannot clear is archived by the human.
   Once a worker closes, its merged worktree and branch are removed (`git worktree remove`, `git branch -d`); never
   one with unmerged commits.
6. **History first.** Before planning, grep `handoffs/` (with `archive/`, `pairs/`), `FEATURE_INDEX.md` and `ACTION_LOG*`.
7. **Each chat tests only its own scope; the top chat tests the whole.** A worker or subagent: type-check, the tests
   its change affects and its own flow, never the full suite. A Master: at merge, its module's tests and flows (its
   area), once per wave, never other areas. The Chief, or a single Master with no Chief: one combined
   `{{full E2E command}}` for the whole app under `scripts/lock.cjs acquire heavy`, after the Masters' merges, once per
   phase, and always before the main branch is pushed or released. A change to shared files (dependencies, lockfile,
   build or test config, shared types or contracts, migrations, env) is marked `scope: wide` in the RESULT, and the
   next level up tests it before that merge, not in its batch. A red full run is split by Master merge to find the
   cause, which goes back to that Master and its worker (law 8). Fixing an old known-red test is its own task. Start
   servers only with `scripts/server.cjs start`; after the run, `server.cjs stop <master_dir> --all` (previews: `preview_stop`).
8. **After the sweep.** Red: the same worker fixes its failures in its own chat until green; green: `RESET`.
9. **Workers ask only the Master.** No worker talks to another unless the Master pairs them (`handoffs/pairs/<id>-<id>.md`). An unsafe or LOCK-breaking ask: stop and report.
10. **No free worker: open one within capacity.** Law 26; sizing and waves: `core/SCALE.md`.
11. **Token and tier choices are automatic.** The Master has full authority over workers.
12. **Context.** Chief and Masters roll over at `250k` unless the human set another number (`core/CHIEF.md` rule 1).
    `autoCompactWindow` is a safety net above it: Chief and Master `{{e.g. 400k}}`, workers `{{e.g. 200k}}` (the human
    types `/autocompact <N>k`, per model). Read context with `get_usage`. Old chats: `{{archive | delete}}` (default
    archive; delete is final). Rollover: `{{auto | new chat | clear in place}}` (default auto: `cycle.cjs` picks the
    one that costs fewer tokens, a tie to clear in place; clear in place only with the reboot hook, `scripts/reboot.cjs`).
13. **One report after a full E2E (the top chat).** What merged, test numbers, what was NOT tested (a clean type check is not a live
    check), any action for the human; progress stays on the BOARD.
14. **Usage window.** Each cycle and before each wave, `scripts/cycle.cjs` applies the TOKENS §6 table (5-hour and
    weekly). Running out before the reset: checkpoint, schedule a one-time task at `resets_at + 2 min` that writes
    `masters/RESUME.md` (status only) and tells the human; ask before acting on it.
15. **Workers use the minimal-change approach.** Lean, for simple tasks and bugfixes.
16. **Two phases per High-tier module.** Phase 1 builds and bugfixes, then clears; phase 2 optimises, at most 2 passes.
    Authority: `core/PRECEDENCE.md`. Source caps: `{{e.g. .ts/.tsx ≤ 400, .js/.jsx ≤ 300}}`.
17. **Docs are at most 200 lines each.** Project and master-brain files (law 19). `master-brain/` and `.claude/` are never committed.
18. **Several Masters can run at once.** Each owns its area (BOARD Masters table); a Chief sits above them, messaged
    only for done, blocked or needs-chief (CHIEF rule 2); agreements in `handoffs/pairs/C1-M#.md`.
19. **Split rule.** A `.md` over 200 lines keeps H1, intro and a § table and moves sections verbatim to
    `<name>/NN-topic.md`; logs roll into dated parts; old handoff entries go to `handoffs/archive/`.
20. **Approval gates.** `core/SAFETY.md` 12, also when the arena skill triggers by itself (procedure/05).
21. **Test integrity.** Snapshot with `scripts/test-guard.cjs` before a worker starts and compare before merge: no merge
    on removed tests, new skips or fewer assertions, and for a build or bugfix none without a new test (`compare
    --expect-new`). With the test gate on (`scripts/stop-gate.cjs`) a worker cannot
    report done while its quick check fails.
22. **Security gate.** No merge while a confirmed high or critical finding is open; each gets a regression test. High
    tier: a scoped quick audit per module after phase 2.
23. **Tools by logical name.** Mapped in `CAPABILITIES.md`; an UNKNOWN is never guessed.
24. **Improvement loop.** After each task, `scripts/route-log.cjs from-result <handoff>`; every ~10 tasks,
    `route-stats.cjs` proposals, one change at a time, with the human's yes (`core/IMPROVE.md`).
25. **Optional footer.** Off unless the human chose it (`{{footer on|off}}`); when on, every reply ends with 6 lines or
    fewer: open decisions and what others owe (procedure/04).
26. **Chat capacity.** A task starts only when `scripts/capacity.cjs load` says it fits (`CAPACITY.md`; `cycle.cjs` shows the room). Hard caps:
    worker 1 job; Master 4 running worker chats; 2 subagents. Full: reuse an idle worker, else `needs-chip`.

## Project-specific (onboarding fills it; tag rows confirmed or inferred; `TBD` when undecided)
| Role | Binding |
|---|---|
| Stack; type or build gate | `{{…}}` |
| Unit and E2E commands; known-red ledger | `{{…}}` |
| Validation (schema pair, contracts on both ends) | `{{…}}` |
| Foundational modules (never parallel); collision files | `{{…}}` |
| Credentials (where named constants live, never values) | `{{…}}` |
| Git: branch, commit style; push and deploy policy | `{{…}}` |
| Status and decision docs; shared locks; heavy-slot work | `{{…}}` |

Files (seeded by `scripts/init.cjs`): `BOARD.md`, `masters/`, `handoffs/`, `ACTION_LOG.md`, `locks/`, `inbox/`.
