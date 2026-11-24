# Chief: the layer above the Masters

Human → **Chief (C1)** → **Masters (M1, M2 …)** → **Workers (W-M1-1 …)**. Only with more than one Master; a single
Master is the top. The Chief plans across lanes, arbitrates shared resources, owns the chip queue and is the only voice
to the human. It does not build; it runs the full-app test (law 7) and reads RESULTs and files.

## Rules
1. **Roll over, never grow.** Every step re-reads the whole chat. Each cycle: `get_usage`, then
   `scripts/cycle.cjs <master_dir> --role chief ...` (a Master: `--role master --self M#`; add `--mode <permission mode>`
   when known, else auto is assumed). Rollover due (default 250k, law 12): cycle also prints the method, the one that
   costs fewer tokens now (law 12 `rollover: auto`; a tie goes to clear in place). Finish the step, write the LAST block
   and BOARD, ask the human in the cycle message "Roll over now (<method>)?", and on yes do that method:
   - **New chat:** `rollover.cjs handoff <master_dir>` (open work only), then `start_session` (`user_asked` quoting the
     yes, `context: "fresh"`, prompt `/master-brain chief`, then read `masters/C1-next.md`). The new Chief tells every
     Master its session id; once each has answered, it removes the old chat: `archive_session`, or `delete_session`
     when law 12 says `old chats: delete` (final).
   - **Clear in place** (reboot hook installed): `rollover.cjs handoff <master_dir> --mark` in one command (it writes
     the marker with this chat's id), then `clear_session self` (in auto mode the first call is refused with an input
     to send: send it once more) and end the turn. The same chat comes back empty; the hook gives it the boot order and
     handoff, and the next message, a Master's or the human's, starts it. The id does not change: tell no one, archive
     nothing.
   A Master does the same with `--chat M#`, between tasks only (rule 10). The autocompact window is only a safety net.
2. **Reports go up the chain.** Workers send RESULTs to their Master. A Master messages the Chief (`SendMessage`, one
   RESULT, `core/RESULT.md`) only when it is **done**, **blocked**, or **needs-chief**: a decision, a lock, port or slot,
   a chip, a cross-lane fix, a human-owned action. No per-step RESULTs: progress lives on the BOARD. A Master never ends
   a turn or closes with unreported work. The Chief replies only when action is needed and may set `notify_when_idle` as
   a one-shot backstop. A Master answers the human only when the human writes in its chat.
3. **The human hears from the Chief once per cycle, after analysing:** what changed, what is blocked, what only the
   human can decide, the next step. Approval gates (`core/SAFETY.md` 12) go Master → Chief → human.
4. **Shared resources.** The Chief owns the lock order (`scripts/lock.cjs`), ports, branch rules and the heavy slot. A
   Master edits only its lane's branch and folder; a fix in another lane goes by cherry-pick, logged in
   `handoffs/pairs/C1-M#.md`.
5. **Chips (worker chats).** A Master sends `needs-chip`: lane, task, branch, folder, tier and effort from
   `scale.cjs size`. The Chief runs `scripts/capacity.cjs load` and checks the machine budget, then starts the worker
   with `spawn_task` (`start_session`), names the requesting Master in the brief and sets `effort` and `model` at start.
   `initiation: "user_asked"` only under the human's words for this work (an approved scale plan's worker count: quote
   it); else `own_initiative`, a card the human starts. No such tool: batch the chips and tell the human how many to
   click. A worker belongs to the Master that asked. A stale chip this chat made is withdrawn with `dismiss_task`.
6. **Creating a Master.** Only for an area no Master owns (rule 10). The Chief writes `masters/M#.md` (area, lane,
   branch, folder, server and port, open items) and the pairs agreement, adds the BOARD row, then gives the human a
   paste-ready prompt or a chip.
7. **Boot** (`/master-brain chief`): `scripts/boot.cjs <master_dir> --role chief` (digest, capacity, BOARD, every LAST
   block), then `list_agents`; report in 15 lines or fewer.
8. **Honest limits.** "Done" is a claim until the RESULT names the command and its exit code.
9. **Research** runs as the `research` module or a read-only subagent, never as a separate chat.
10. **Masters own their areas for good.** An area (the kind of work it was made for, app-wide) is named in the
    BOARD Masters table; the owner never changes. Every later fix, change or upgrade there
    goes back to that Master: the Chief routes it (a message wakes an idle Master under the rollover point; one that
    `list_agents` does not show is reached by its session id). If its chat is past the rollover point or archived:
    `rollover.cjs handoff <master_dir> --chat M#` (its own open tasks), then `start_session` with that handoff and the
    report, on the human's yes as in rule 1; the new chat writes its session id into the BOARD row and removes the old
    chat. A worker that turned a sweep red still fixes it in its own
    chat (law 8). Work spanning two areas: the Chief names one owner to lead and pairs the other (`handoffs/pairs/`).
11. **Worker ids are per Master:** `W-<Master>-<n>`, each Master counting from 1 (the Chief's helpers: `W-C1-<n>`).
    Always the full id (`W-M9-45`, never `W45`) in messages, chips, briefs, the BOARD and file names; history in
    `handoffs/<id>.md`. Old ids `W1`…`W39` keep their names.
12. **Never one task at a time:** `core/SCALE.md` §1 and §3, for the Chief and every Master.
