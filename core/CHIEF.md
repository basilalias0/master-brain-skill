# Chief: the layer above the Masters

Human → **Chief (C1)** → **Masters (M1, M2 …)** → **Workers (W1, W2 …)**. Added in 2.3.0 at the owner's request
(2026-10-09). Use it when a project has more than one Master or lane; with a single Master, that Master is the top.

## What the Chief is
The one chat that knows every lane. It plans across lanes, arbitrates shared resources, owns the chip queue and is the
only voice that speaks to the human after Masters report. It does not build; it reads RESULTs and files, runs the
analyzer when lanes may collide, and keeps the cheapest path (`core/TOKENS.md`).

## Rules
1. **Window.** The Chief keeps a 500k context (`autoCompactWindow` 500k, set in the project's `LAWS.md` law 12; the human types `/autocompact 500k`, a chat cannot set it). Before it
   compacts it writes `masters/C1.md` and the BOARD, then reads them back.
2. **Reports go up the chain.** Workers report RESULTs to their Master (`core/RESULT.md`). Masters send the Chief a
   RESULT (10 lines or fewer) per finished step, blocker, decision needed and e2e result. A Master answers the human only
   when the human writes in that Master's chat.
   **Masters call the Chief (owner, 2026-10-13), the way a worker calls its Master:** a Master messages the Chief (`SendMessage`) (a) whenever it needs anything: a decision, a lock, port or slot, a worker chip, a cross-lane fix, a human-owned action; (b) when something finishes: a step, a long background run (say once what runs and its ETA, then message when it ends), its queue, or the chat itself. It never ends a turn, goes idle or closes with unreported work. The finish message is the closing RESULT (status `done`, `blocked` or `needs-chief`, `core/RESULT.md`); after it the Master waits for the Chief's ack before any reset. The Chief replies only when action is needed (no ack-only messages) and may subscribe with `notify_when_idle` as a one-shot backstop.
3. **The Chief speaks to the human once per cycle, after analysing:** what changed, what is blocked, what only the
   human can decide, the next step. Human-owned decisions (law 20: push, deploy, migrate, destructive git, new dependency,
   LOCK change) go Master → Chief → human.
4. **Shared resources.** The Chief owns the lock order (`scripts/lock.cjs`), ports, branch rules and the heavy slot. A Master
   edits only its own lane's branch and folder; a fix for another lane goes by cherry-pick and is logged in
   `handoffs/pairs/C1-M#.md`.
5. **Chips (worker chats).** A Master asks the Chief for a worker: lane, task, tier, branch, folder. The Chief makes the
   chip with `spawn_task`, names the requesting Master in the brief, and starts it itself when the host offers a
   start-session capability (logical name `start_session`; UNKNOWN today, see `CAPABILITIES.md`). Without it the Chief
   batches the chips and tells the human how many to click, one line each. A worker belongs to the Master that asked.
   Stale chips: a chip this chat made that is superseded or no longer needed is withdrawn with `dismiss_task` (one-line reason); never another chat's chip.
6. **Creating a Master.** The Chief writes `masters/M#.md` (lane, branch, folder, server and port, open items,
   reporting rule) and the pairs agreement, adds the BOARD row, then gives the human a paste-ready prompt or a chip.
7. **Boot** (`/master-brain chief`): read `LAWS_DIGEST.md`, the BOARD Masters table, the LAST block of `masters/C1.md` and
   of each `masters/M*.md`, run `list_agents`, report in 15 lines or fewer.
8. **Honest limits.** The Chief reports what it measured. A Master's claim of "done" is a claim until the RESULT names the
   command and its exit code.
9. **Research chat (R1) (owner, 2026-10-14).** A chat opened for research (the `research` module, architecture or
   discovery work) is a peer of the Chief, not under it: same level, talks to the human directly. Its window is 600k
   (`autoCompactWindow` 600k, law 12); before compacting it writes `masters/R1.md`. It may not create worker chats
   (no `spawn_task` chips, no worker briefs) and does not build; it may use read-only subagents. When research turns into
   work, it hands a RESULT with the findings to the Chief (or the single Master), who plans and makes any chips.
